import { useState, useRef, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { Upload, X, FileText, Image, File } from 'lucide-react';

interface FileUploadProps {
  threadId?: string;
  onUploadComplete?: (attachmentIds: Id<"attachments">[]) => void;
}

interface UploadedFile {
  id: Id<"attachments">;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export function FileUpload({ threadId, onUploadComplete }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const createAttachment = useMutation(api.attachments.createAttachment);
  const deleteAttachment = useMutation(api.attachments.deleteAttachment);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum size is 10MB.`);
          continue;
        }

        // Get upload URL
        const uploadUrl = await generateUploadUrl();
        
        // Upload file to storage
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const { storageId } = await response.json();

        // Create attachment record
        const attachmentId = await createAttachment({
          storageId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          threadId: threadId as Id<"threads"> | undefined,
        });

        newFiles.push({
          id: attachmentId,
          name: file.name,
          size: file.size,
          type: file.type,
        });

        toast.success(`${file.name} uploaded successfully`);
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      
      if (onUploadComplete && newFiles.length > 0) {
        onUploadComplete(newFiles.map(f => f.id));
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = async (fileId: Id<"attachments">) => {
    try {
      await deleteAttachment({ attachmentId: fileId });
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success("File removed");
    } catch (error) {
      toast.error("Failed to remove file");
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type === 'application/pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-all ${
          dragActive
            ? 'border-[var(--c3-primary)] bg-[var(--c3-primary)]/5'
            : 'border-[var(--c3-border-subtle)] hover:border-[var(--c3-border-primary)]'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          accept="image/*,application/pdf,.txt,.md,.doc,.docx"
        />
        
        <div
          className="flex flex-col items-center justify-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-10 h-10 text-[var(--c3-text-tertiary)] mb-3" />
          <p className="text-sm text-[var(--c3-text-primary)] font-medium">
            {isUploading ? 'Uploading...' : 'Drop files here or click to upload'}
          </p>
          <p className="text-xs text-[var(--c3-text-tertiary)] mt-1">
            Images, PDFs, and text files up to 10MB
          </p>
        </div>
      </div>

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-[var(--c3-surface-secondary)] rounded-lg border border-[var(--c3-border-subtle)]"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--c3-surface-primary)] rounded">
                  {getFileIcon(file.type)}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--c3-text-primary)] truncate max-w-[250px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[var(--c3-text-tertiary)]">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => removeFile(file.id)}
                className="p-1.5 text-[var(--c3-text-tertiary)] hover:text-[var(--c3-error)] hover:bg-[var(--c3-surface-hover)] rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}