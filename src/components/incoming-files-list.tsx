import { File, Download, X, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface IncomingFile {
  fileName: string;
  fileSize: number;
  senderName: string;
  status: 'pending' | 'receiving' | 'completed' | 'rejected';
  progress: number;
}

interface IncomingFilesListProps {
  files: Map<string, IncomingFile>;
  onAccept: (fileId: string) => void;
  onReject: (fileId: string) => void;
}

export function IncomingFilesList({
  files,
  onAccept,
  onReject,
}: IncomingFilesListProps) {
  if (files.size === 0) {
    return null;
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-h-[80vh] overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="font-semibold flex items-center gap-2">
            <File className="size-5" />
            接收文件 ({files.size})
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {Array.from(files.entries()).map(([fileId, file]) => (
            <div key={fileId} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <File className="size-4 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.fileName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {file.senderName} · {formatSize(file.fileSize)}
                  </p>
                </div>
              </div>

              {file.status === 'receiving' && (
                <div className="space-y-2">
                  <Progress value={file.progress} className="h-2" />
                  <p className="text-xs text-center text-gray-500">
                    {file.progress}% 完成
                  </p>
                </div>
              )}

              {file.status === 'completed' && (
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 py-2">
                  <Check className="size-4" />
                  <span className="text-sm font-medium">接收完成</span>
                </div>
              )}

              {file.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onReject(fileId)}
                  >
                    拒绝
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => onAccept(fileId)}
                  >
                    <Download className="size-4 mr-1" />
                    接收
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
