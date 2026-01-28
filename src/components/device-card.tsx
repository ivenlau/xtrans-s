import { Smartphone, Monitor, Tablet, Circle } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { DeviceInfo } from "../lib/device-manager";

interface DeviceCardProps {
  device: DeviceInfo & { isSelf?: boolean };
  onSendFile?: (device: DeviceInfo) => void;
  onSendText?: (device: DeviceInfo) => void;
}

const deviceIcons: Record<string, typeof Smartphone> = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
};

export function DeviceCard({ device, onSendFile, onSendText }: DeviceCardProps) {
  const Icon = deviceIcons[device.deviceType] || Monitor;

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Icon className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{device.deviceName}</h3>
                {device.isSelf && (
                  <Badge variant="secondary" className="text-xs">
                    本机
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Circle
                  className={`size-2 ${
                    device.online
                      ? "fill-green-500 text-green-500"
                      : "fill-gray-400 text-gray-400"
                  }`}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {device.online ? "在线" : "离线"}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {device.platform} • {device.browser}
              </p>
            </div>
          </div>
        </div>

        {!device.isSelf && device.online && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onSendFile?.(device)}
            >
              发送文件
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onSendText?.(device)}
            >
              发送文字
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
