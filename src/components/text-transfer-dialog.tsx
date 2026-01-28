import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { DeviceInfo } from "../lib/device-manager";
import { toast } from "sonner";

interface TextTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetDevice: DeviceInfo | null;
  onSend?: (text: string, device: DeviceInfo) => void;
}

export function TextTransferDialog({
  open,
  onOpenChange,
  targetDevice,
  onSend,
}: TextTransferDialogProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!targetDevice || !text.trim()) return;

    // 触发文字传输事件
    const event = new CustomEvent('transfer-text', {
      detail: {
        targetDevice,
        text,
      },
    });
    window.dispatchEvent(event);

    onSend?.(text, targetDevice);
    toast.success("文字发送成功");
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>发送文字到 {targetDevice?.deviceName}</DialogTitle>
          <DialogDescription>
            输入要发送的文字内容（最多 10000 字符）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="在此输入文字内容..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={10000}
            rows={8}
            className="resize-none max-h-60 overflow-y-auto"
          />
          <p className="text-xs text-gray-500 text-right">
            {text.length} / 10000
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSend} disabled={!text.trim()}>
            发送
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
