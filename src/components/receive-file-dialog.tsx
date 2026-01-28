import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { File, Download, X } from "lucide-react";
import { Progress } from "./ui/progress";

interface ReceiveFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileSize: number;
  senderName: string;
  receiving?: boolean;
  progress?: number;
  onAccept: () => void;
  onReject: () => void;
}

export function ReceiveFileDialog({
  open,
  onOpenChange,
  fileName,
  fileSize,
  senderName,
  receiving = false,
  progress = 0,
  onAccept,
  onReject,
}: ReceiveFileDialogProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {receiving ? "正在接收文件..." : "接收文件"}
          </DialogTitle>
          <DialogDescription>
            {receiving
              ? `正在从 ${senderName} 接收文件`
              : `${senderName} 想要发送文件给您`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <File className="size-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{fileName}</p>
            <p className="text-sm text-gray-500">
              {receiving
                ? `${progress}% - ${formatSize(fileSize)}`
                : formatSize(fileSize)}
            </p>
          </div>
        </div>

        {receiving && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-gray-500">
              {progress}% 完成
            </p>
          </div>
        )}

        {!receiving && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onReject();
                onOpenChange(false);
              }}
            >
              拒绝
            </Button>
            <Button
              onClick={() => {
                onAccept();
              }}
            >
              <Download className="size-4 mr-2" />
              接收
            </Button>
          </DialogFooter>
        )}

        {receiving && (
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onReject();
                onOpenChange(false);
              }}
              disabled
            >
              正在接收...
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
