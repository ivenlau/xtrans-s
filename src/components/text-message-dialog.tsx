import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { MessageSquare, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TextMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  senderName: string;
  message: string;
  onCopy: () => void;
}

export function TextMessageDialog({
  open,
  onOpenChange,
  senderName,
  message,
  onCopy,
}: TextMessageDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        onCopy();
        setTimeout(() => setCopied(false), 2000);
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = message;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        onCopy();
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      // 最后的降级方案：提示用户手动复制
      toast.error('复制失败，请手动选择文字复制');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            收到新消息
          </DialogTitle>
          <DialogDescription>
            来自 <span className="font-medium">{senderName}</span> 的消息
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <div className="max-h-60 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCopy}
            className="flex-1 sm:flex-none"
          >
            {copied ? (
              <>
                <Check className="size-4 mr-2" />
                已复制
              </>
            ) : (
              <>
                <Copy className="size-4 mr-2" />
                复制
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
            }}
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
