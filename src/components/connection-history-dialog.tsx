import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { History, Trash2, RefreshCw, Clock, Wifi, Globe } from "lucide-react";
import { toast } from "sonner";
import { useStore, ConnectionHistoryItem } from "../store/use-store";

interface ConnectionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect: (deviceId: string, deviceName: string) => void;
}

export function ConnectionHistoryDialog({
  open,
  onOpenChange,
  onReconnect,
}: ConnectionHistoryDialogProps) {
  const { connectionHistory, removeConnectionHistory, clearConnectionHistory } = useStore();
  const [reconnectingId, setReconnectingId] = useState<string | null>(null);

  // 格式化时间
  const formatLastConnected = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return new Date(timestamp).toLocaleDateString("zh-CN");
  };

  // 获取连接类型图标和标签
  const getConnectionTypeInfo = (type: ConnectionHistoryItem['connectionType']) => {
    switch (type) {
      case 'lan':
        return { icon: Wifi, label: '局域网', variant: 'success' as const };
      case 'wan':
        return { icon: Globe, label: '互联网', variant: 'info' as const };
      default:
        return { icon: Wifi, label: '未知', variant: 'secondary' as const };
    }
  };

  // 处理重连
  const handleReconnect = (deviceId: string, deviceName: string) => {
    setReconnectingId(deviceId);
    onReconnect(deviceId, deviceName);
    // 关闭对话框
    onOpenChange(false);
    // 延迟重置状态
    setTimeout(() => setReconnectingId(null), 1000);
  };

  // 处理删除单个历史记录
  const handleRemove = (deviceId: string, deviceName: string) => {
    removeConnectionHistory(deviceId);
    toast.success(`已删除 "${deviceName}" 的连接记录`);
  };

  // 处理清空所有历史
  const handleClearAll = () => {
    if (confirm("确定要清空所有连接历史吗？")) {
      clearConnectionHistory();
      toast.success("已清空所有连接历史");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5" />
            连接历史
          </DialogTitle>
          <DialogDescription>
            查看和快速重连之前连接过的设备
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {connectionHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="size-12 text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">暂无连接历史</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                连接设备后会自动记录在这里
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {connectionHistory.map((item) => {
                  const ConnectionIcon = getConnectionTypeInfo(item.connectionType).icon;
                  const connectionLabel = getConnectionTypeInfo(item.connectionType).label;

                  return (
                    <div
                      key={item.deviceId}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">
                            {item.deviceName}
                          </h4>
                          <Badge variant={getConnectionTypeInfo(item.connectionType).variant} className="text-xs">
                            <ConnectionIcon className="size-3 mr-1" />
                            {connectionLabel}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatLastConnected(item.lastConnected)}
                          </span>
                          <span>连接 {item.connectionCount} 次</span>
                          {item.latency && (
                            <span>延迟 {item.latency}ms</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleReconnect(item.deviceId, item.deviceName)}
                          disabled={reconnectingId === item.deviceId}
                        >
                          {reconnectingId === item.deviceId ? (
                            <>
                              <RefreshCw className="size-4 mr-2 animate-spin" />
                              连接中
                            </>
                          ) : (
                            <>
                              <RefreshCw className="size-4 mr-2" />
                              重连
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(item.deviceId, item.deviceName)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {connectionHistory.length > 0 && (
          <DialogFooter className="flex justify-between">
            <Button
              variant="ghost"
              onClick={handleClearAll}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="size-4 mr-2" />
              清空历史
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
