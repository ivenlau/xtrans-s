import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Copy, Check, Share2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const currentUrl = window.location.href;

  const handleCopy = async () => {
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(currentUrl);
        setCopied(true);
        toast.success("链接已复制到剪贴板");
        setTimeout(() => setCopied(false), 2000);
      } else {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = currentUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        toast.success("链接已复制到剪贴板");
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      toast.error('复制失败，请手动复制链接');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5" />
            分享应用
          </DialogTitle>
          <DialogDescription>
            扫描二维码或在同一网络下访问此链接
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-4">
          {/* 二维码 */}
          <div className="p-4 bg-white rounded-lg border border-gray-200 dark:border-gray-800">
            <QRCodeSVG
              value={currentUrl}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="white"
              fgColor="black"
            />
          </div>

          {/* URL 显示区域 */}
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <LinkIcon className="size-4" />
              <span>当前链接</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                <p className="text-sm break-all font-mono">
                  {currentUrl}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* 提示信息 */}
          <div className="w-full p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              <strong>提示：</strong>确保对方设备与当前设备在同一网络，或使用公网地址访问。
              如果使用 localhost/127.0.0.1，其他设备将无法访问。
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
