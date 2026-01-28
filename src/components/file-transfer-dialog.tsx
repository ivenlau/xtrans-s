import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Upload, File, X } from "lucide-react";
import { DeviceInfo } from "../lib/device-manager";
import { toast } from "sonner";

interface FileTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetDevice: DeviceInfo | null;
}

export function FileTransferDialog({
  open,
  onOpenChange,
  targetDevice,
}: FileTransferDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [transferring, setTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!targetDevice || files.length === 0) return;

    setTransferring(true);
    setProgress(0);

    try {
      // 触发文件传输事件
      const event = new CustomEvent('transfer-files', {
        detail: {
          targetDevice,
          files,
          onProgress: (p: number) => setProgress(p),
        },
      });
      window.dispatchEvent(event);

      // 移除成功 toast，传输完成后直接关闭对话框
      setFiles([]);
      setProgress(0);
      onOpenChange(false);
    } catch (error) {
      toast.error('文件发送失败');
    } finally {
      setTransferring(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">发送文件到 {targetDevice?.deviceName}</DialogTitle>
          <DialogDescription>
            选择要发送的文件，支持拖拽上传
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 文件选择区域 */}
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-12 mx-auto mb-4 text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              点击选择文件或拖拽文件到这里
            </p>
            <p className="text-xs text-gray-500">
              支持所有文件类型，单个文件最大 5GB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <File className="size-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p
                      className="text-sm font-medium truncate max-w-[200px] sm:max-w-[250px]"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(index)}
                    className="flex-shrink-0"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* 进度条 */}
          {transferring && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-center text-gray-500">
                发送中... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={transferring}
          >
            取消
          </Button>
          <Button
            onClick={handleSend}
            disabled={files.length === 0 || transferring}
          >
            {transferring ? '发送中...' : '发送'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
