import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { X, Download, Eye, FileText, Image as ImageIcon, File, Maximize2 } from "lucide-react";

interface AttachmentViewerProps {
  attachment: {
    _id: Id<"attachments">;
    filename: string;
    contentType: string;
    size: number;
    url?: string;
  };
  onRemove?: () => void;
}

export function AttachmentViewer({ attachment, onRemove }: AttachmentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (attachment.contentType.startsWith("image/")) return ImageIcon;
    if (attachment.contentType === "application/pdf") return FileText;
    return File;
  };

  const FileIcon = getFileIcon();
  const isImage = attachment.contentType.startsWith("image/") && !imageError;
  const isPDF = attachment.contentType === "application/pdf";
  const hasUrl = !!attachment.url;

  return (
    <>
      <div className="inline-block">
        <div className="bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] rounded-[var(--c3-radius-md)] overflow-hidden">
          {/* Preview Area */}
          {isImage && hasUrl ? (
            <div
              className="relative cursor-pointer group"
              onClick={() => setIsExpanded(true)}
            >
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="max-h-64 max-w-full object-contain"
                onError={() => setImageError(true)}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="w-6 h-6 text-white" />
              </div>
            </div>
          ) : isPDF && hasUrl ? (
            <div className="p-6 flex flex-col items-center justify-center min-w-[200px]">
              <FileIcon className="w-12 h-12 text-[var(--c3-text-tertiary)] mb-2" />
              <p className="text-xs text-[var(--c3-text-secondary)] text-center max-w-[200px] truncate">
                {attachment.filename}
              </p>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center min-w-[200px]">
              <FileIcon className="w-12 h-12 text-[var(--c3-text-tertiary)] mb-2" />
              <p className="text-xs text-[var(--c3-text-secondary)] text-center max-w-[200px] truncate">
                {attachment.filename}
              </p>
            </div>
          )}

          {/* File Info */}
          <div className="p-3 border-t border-[var(--c3-border-subtle)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--c3-text-primary)] truncate">
                  {attachment.filename}
                </p>
                <p className="text-[10px] text-[var(--c3-text-tertiary)]">
                  {formatFileSize(attachment.size)}
                </p>
              </div>

              <div className="flex items-center gap-1">
                {hasUrl ? (
                  <>
                    {isPDF && (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-[var(--c3-surface-hover)] rounded transition-colors"
                        title="View PDF"
                      >
                        <Eye className="w-3.5 h-3.5 text-[var(--c3-text-tertiary)]" />
                      </a>
                    )}
                    <a
                      href={attachment.url}
                      download={attachment.filename}
                      className="p-1 hover:bg-[var(--c3-surface-hover)] rounded transition-colors"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--c3-text-tertiary)]" />
                    </a>
                  </>
                ) : (
                  <span className="text-[10px] text-[var(--c3-text-tertiary)] px-2">Loading...</span>
                )}
                {onRemove && (
                  <button
                    onClick={onRemove}
                    className="p-1 hover:bg-[var(--c3-surface-hover)] rounded transition-colors"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5 text-[var(--c3-text-tertiary)]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for images */}
      {isExpanded && isImage && hasUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-full max-h-full">
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
