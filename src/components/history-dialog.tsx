import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Trash2, Download } from "lucide-react";
import { toast } from "sonner";

export interface HistoryItem {
  id: string;
  type: "file" | "text";
  timestamp: number;
  deviceName: string;
  direction: "sent" | "received";
  fileName?: string;
  fileSize?: number;
  text?: string;
}

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistoryItem[];
  onDelete: (id: string) => void;
}

export function HistoryDialog({
  open,
  onOpenChange,
  history,
  onDelete,
}: HistoryDialogProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = async (text: string, id: string) => {
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success("已复制到剪贴板");
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedId(id);
        toast.success("已复制到剪贴板");
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (error) {
      toast.error('复制失败，请手动选择文字复制');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>传输历史</DialogTitle>
          <DialogDescription>
            查看最近的文件和文字传输记录
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无传输记录
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            item.direction === "sent"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          }`}
                        >
                          {item.direction === "sent" ? "发送" : "接收"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(item.timestamp), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.deviceName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {item.type === "file" ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-950 rounded">
                      <Download className="size-4 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.fileName}
                        </p>
                        {item.fileSize && (
                          <p className="text-xs text-gray-500">
                            {formatSize(item.fileSize)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-100 dark:bg-gray-950 rounded">
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {item.text}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleCopyText(item.text!, item.id)}
                      >
                        {copiedId === item.id ? "已复制" : "复制"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
