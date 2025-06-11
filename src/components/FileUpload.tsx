import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';

interface FileUploadProps {
  onUploadComplete: (attachmentIds: Id<"attachments">[]) => void;
  onCancel: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  attachmentId?: Id<"attachments">;
  error?: string;
}

export function FileUpload({ onUploadComplete, onCancel }: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const createAttachment = useMutation(api.attachments.createAttachment);

  const handleUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    
    // Initialize uploading state
    setUploadingFiles(fileArray.map(file => ({ file, progress: 0 })));

    const attachmentIds: Id<"attachments">[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      try {
        // Generate upload URL
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

        attachmentIds.push(attachmentId);

        // Update progress
        setUploadingFiles(prev => 
          prev.map((uf, idx) => 
            idx === i ? { ...uf, progress: 100, attachmentId } : uf
          )
        );
      } catch (error) {
        // Update error state
        setUploadingFiles(prev => 
          prev.map((uf, idx) => 
            idx === i ? { ...uf, error: "Upload failed" } : uf
          )
        );
        
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (attachmentIds.length > 0) {
      onUploadComplete(attachmentIds);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Upload Files</h3>
        
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-blue-600 hover:text-blue-700"
          >
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mt-2">Click to upload or drag and drop</p>
            <p className="text-sm text-gray-500">Images and PDFs up to 10MB</p>
          </label>
        </div>

        {uploadingFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadingFiles.map((uf, idx) => (
              <div key={idx} className="bg-gray-100 dark:bg-gray-700 rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uf.file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(uf.file.size)}</p>
                  </div>
                  {uf.error ? (
                    <span className="text-red-500 text-sm">{uf.error}</span>
                  ) : (
                    <span className="text-green-500 text-sm">{uf.progress}%</span>
                  )}
                </div>
                <div className="mt-2 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      uf.error ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${uf.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const successfulUploads = uploadingFiles
                .filter(uf => uf.attachmentId)
                .map(uf => uf.attachmentId!);
              if (successfulUploads.length > 0) {
                onUploadComplete(successfulUploads);
              }
            }}
            disabled={uploadingFiles.length === 0 || uploadingFiles.some(uf => !uf.attachmentId && !uf.error)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Attach Files
          </button>
        </div>
      </div>
    </div>
  );
}
