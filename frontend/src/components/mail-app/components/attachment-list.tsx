import { Download, FileUp, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface AttachmentListProps {
  attachments?:
    | File[]
    | Array<{ id: string; name: string; size: number; contentType: string }>;
  onFilesSelected?: (files: File[]) => void;
  onRemove?: (index: number) => void;
  onDownload?: (attachmentId: string, fileName: string) => Promise<void>;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  readOnly?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / k ** i) * 100) / 100 + " " + sizes[i];
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "📄";
    case "doc":
    case "docx":
      return "📝";
    case "xls":
    case "xlsx":
      return "📊";
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
      return "🖼️";
    case "zip":
    case "rar":
    case "7z":
      return "📦";
    default:
      return "📎";
  }
};

const isFileList = (data: unknown): data is File[] =>
  Array.isArray(data) && data.length > 0 && data[0] instanceof File;

const isAttachmentObject = (
  data: unknown
): data is Array<{
  id: string;
  name: string;
  size: number;
  contentType: string;
}> =>
  Array.isArray(data) &&
  data.length > 0 &&
  typeof data[0] === "object" &&
  "id" in data[0] &&
  "name" in data[0];

export function AttachmentList({
  attachments = [],
  onFilesSelected,
  onRemove,
  onDownload,
  maxFiles = 20,
  maxFileSize = 25 * 1024 * 1024, // 25MB default
  readOnly = false,
}: AttachmentListProps) {
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (readOnly) return;

      // Validate file count
      if (
        isFileList(attachments) &&
        attachments.length + acceptedFiles.length > maxFiles
      ) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Validate file sizes
      const validFiles = acceptedFiles.filter((file) => {
        if (file.size > maxFileSize) {
          alert(
            `File ${file.name} is too large. Maximum size: ${formatFileSize(maxFileSize)}`
          );
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        onFilesSelected?.([...attachments, ...validFiles]);
      }
    },
    [attachments, maxFiles, maxFileSize, readOnly, onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: readOnly || uploading,
    maxSize: maxFileSize,
  });

  const handleDownload = async (attachmentId: string, fileName: string) => {
    if (!onDownload) return;

    setDownloadingId(attachmentId);
    try {
      await onDownload(attachmentId, fileName);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download attachment");
    } finally {
      setDownloadingId(null);
    }
  };

  const attachmentCount = isFileList(attachments)
    ? attachments.length
    : isAttachmentObject(attachments)
      ? attachments.length
      : 0;

  return (
    <div className="space-y-3">
      {/* File List */}
      {attachmentCount > 0 && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700">
          {isFileList(attachments) &&
            attachments.map((file, index) => (
              <div
                className="flex items-center justify-between rounded-lg bg-white p-2 dark:bg-gray-600"
                key={`${file.name}-${index}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getFileIcon(file.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </p>
                    <p className="text-gray-500 text-xs dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <button
                    aria-label={`Remove ${file.name}`}
                    className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-500 dark:hover:text-white"
                    onClick={() => onRemove?.(index)}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

          {isAttachmentObject(attachments) &&
            attachments.map((attachment) => (
              <div
                className="flex items-center justify-between rounded-lg bg-white p-2 dark:bg-gray-600"
                key={attachment.id}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {getFileIcon(attachment.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 dark:text-white">
                      {attachment.name}
                    </p>
                    <p className="text-gray-500 text-xs dark:text-gray-400">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onDownload && (
                    <button
                      aria-label={`Download ${attachment.name}`}
                      className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-500 dark:hover:text-white"
                      disabled={downloadingId === attachment.id}
                      onClick={() =>
                        handleDownload(attachment.id, attachment.name)
                      }
                      type="button"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  )}

                  {!readOnly && (
                    <button
                      aria-label={`Remove ${attachment.name}`}
                      className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-500 dark:hover:text-white"
                      onClick={() =>
                        onRemove?.(attachments.indexOf(attachment))
                      }
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Upload Area */}
      {!readOnly && (
        <div
          {...getRootProps()}
          className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500"
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-2">
            {isDragActive ? (
              <>
                <Upload className="h-8 w-8 text-blue-500" />
                <p className="font-medium text-blue-600">Drop files here...</p>
              </>
            ) : (
              <>
                <FileUp className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    Drag files here or click to browse
                  </p>
                  <p className="text-gray-500 text-xs dark:text-gray-400">
                    Max {maxFiles} files, {formatFileSize(maxFileSize)} each
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {attachmentCount > 0 && (
        <p className="text-gray-500 text-xs dark:text-gray-400">
          {attachmentCount} file{attachmentCount !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
