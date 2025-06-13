import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Upload, X, File, Image } from "lucide-react";

interface FileUploadProps {
  onUploadComplete: (attachmentIds: Id<"attachments">[]) => void;
  onCancel: () => void;
}

export function FileUpload({ onUploadComplete, onCancel }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const createAttachment = useMutation(api.attachments.createAttachment);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate file types and sizes
    const validFiles = selectedFiles.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type.`);
        return false;
      }
      
      return true;
    });

    setFiles(validFiles);
  };

  const uploadFile = async (file: File): Promise<Id<"attachments"> | null> => {
    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();
      
      // Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await response.json();

      // Create attachment record
      const attachmentId = await createAttachment({
        storageId,
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      return attachmentId;
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      toast.error(`Failed to upload ${file.name}`);
      return null;
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const attachmentIds: Id<"attachments">[] = [];

    for (const file of files) {
      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
      
      // Simulate progress (since we can't get real progress from fetch)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: Math.min((prev[file.name] || 0) + 10, 90)
        }));
      }, 100);

      const attachmentId = await uploadFile(file);
      clearInterval(progressInterval);
      
      if (attachmentId) {
        attachmentIds.push(attachmentId);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      } else {
        setUploadProgress(prev => ({ ...prev, [file.name]: -1 }));
      }
    }

    if (attachmentIds.length > 0) {
      onUploadComplete(attachmentIds);
      toast.success(`${attachmentIds.length} file(s) uploaded successfully`);
    }

    setUploading(false);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileSelect({ target: { files: droppedFiles } } as any);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--c3-bg-elevated)] rounded-xl border border-[var(--c3-border-primary)] max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-[var(--c3-border-subtle)]">
          <h2 className="text-xl font-semibold text-[var(--c3-text-primary)]">Upload Files</h2>
          <p className="text-sm text-[var(--c3-text-tertiary)] mt-1">
            Upload images or PDFs to include in your message
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {files.length === 0 ? (
            <div
              className="border-2 border-dashed border-[var(--c3-border-primary)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--c3-primary)] transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-[var(--c3-surface-primary)] rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-[var(--c3-primary)]" />
                </div>
                <div>
                  <p className="text-[var(--c3-text-primary)] font-medium">
                    Drop files here or click to browse
                  </p>
                  <p className="text-sm text-[var(--c3-text-tertiary)] mt-1">
                    Images (JPEG, PNG, GIF, WebP) or PDFs up to 10MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {files.map((file, index) => {
                const progress = uploadProgress[file.name] || 0;
                const failed = progress === -1;
                
                return (
                  <div
                    key={index}
                    className="bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3">
                      {/* File Icon */}
                      <div className="w-10 h-10 bg-[var(--c3-bg-tertiary)] rounded-lg flex items-center justify-center flex-shrink-0">
                        {file.type.startsWith('image/') ? (
                          <Image className="w-5 h-5 text-[var(--c3-text-secondary)]" />
                        ) : (
                          <File className="w-5 h-5 text-[var(--c3-text-secondary)]" />
                        )}
                      </div>
                      
                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--c3-text-primary)] truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-[var(--c3-text-tertiary)]">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      
                      {/* Remove Button */}
                      {!uploading && (
                        <button
                          onClick={() => removeFile(index)}
                          className="text-[var(--c3-text-tertiary)] hover:text-[var(--c3-error)] transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    {uploading && (
                      <div className="mt-3">
                        <div className="h-1 bg-[var(--c3-bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              failed 
                                ? 'bg-[var(--c3-error)]' 
                                : progress === 100 
                                  ? 'bg-[var(--c3-success)]' 
                                  : 'bg-[var(--c3-primary)]'
                            }`}
                            style={{ width: `${Math.abs(progress)}%` }}
                          />
                        </div>
                        <p className="text-xs text-[var(--c3-text-tertiary)] mt-1">
                          {failed ? 'Upload failed' : progress === 100 ? 'Complete' : `${progress}%`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--c3-border-subtle)] flex gap-3">
          <button
            onClick={onCancel}
            disabled={uploading}
            className="c3-button c3-button-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={files.length > 0 ? handleUpload : () => fileInputRef.current?.click()}
            disabled={uploading && files.length > 0}
            className="c3-button c3-button-primary flex-1"
          >
            {uploading ? (
              <>
                <div className="c3-spinner" />
                Uploading...
              </>
            ) : files.length > 0 ? (
              `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`
            ) : (
              'Choose Files'
            )}
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
