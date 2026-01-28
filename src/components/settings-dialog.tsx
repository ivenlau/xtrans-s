import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useState, useEffect } from "react";
import { checkNotificationPermission } from "../lib/notifications";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceName: string;
  onDeviceNameChange: (name: string) => void;
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  notificationsEnabled: boolean;
  onNotificationsEnabledChange: (enabled: boolean) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  deviceName,
  onDeviceNameChange,
  theme,
  onThemeChange,
  soundEnabled,
  onSoundEnabledChange,
  notificationsEnabled,
  onNotificationsEnabledChange,
}: SettingsDialogProps) {
  // 使用内部状态跟踪编辑中的设备名称
  const [editingDeviceName, setEditingDeviceName] = useState(deviceName);

  // 当对话框打开时，重置编辑中的名称为当前名称
  useEffect(() => {
    if (open) {
      setEditingDeviceName(deviceName);
    }
  }, [open, deviceName]);

  const handleDone = () => {
    // 只在名称真正改变时才触发更新
    if (editingDeviceName !== deviceName) {
      onDeviceNameChange(editingDeviceName);
    }
    onOpenChange(false);
  };

  const handleNotificationChange = async (enabled: boolean) => {
    onNotificationsEnabledChange(enabled);

    // 如果启用通知，请求权限
    if (enabled) {
      const hasPermission = await checkNotificationPermission();
      if (hasPermission) {
        toast.success('桌面通知已启用');
      } else {
        toast.error('无法启用桌面通知，请检查浏览器权限');
      }
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>
            自定义您的 XTrans 体验
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 设备名称 */}
          <div className="space-y-2">
            <Label htmlFor="device-name">设备名称</Label>
            <Input
              id="device-name"
              value={editingDeviceName}
              onChange={(e) => setEditingDeviceName(e.target.value)}
              placeholder="我的设备"
            />
            <p className="text-xs text-gray-500">
              其他设备将看到此名称
            </p>
          </div>

          {/* 主题 */}
          <div className="space-y-2">
            <Label>主题</Label>
            <Select value={theme} onValueChange={onThemeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">浅色</SelectItem>
                <SelectItem value="dark">深色</SelectItem>
                <SelectItem value="system">跟随系统</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 声音 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>声音提示</Label>
              <p className="text-xs text-gray-500">
                收到文件、消息时播放提示音
              </p>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={onSoundEnabledChange}
            />
          </div>

          {/* 通知 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>桌面通知</Label>
              <p className="text-xs text-gray-500">
                在系统托盘显示通知（即使应用最小化也能看到）
              </p>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationChange}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleDone}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
