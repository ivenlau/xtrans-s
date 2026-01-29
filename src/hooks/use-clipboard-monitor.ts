import { useState, useEffect } from "react";

interface UseClipboardMonitorOptions {
  onDetect: (text: string) => void;
  validator: (text: string) => boolean;
  interval?: number;
}

interface UseClipboardMonitorReturn {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  hasPermission: boolean;
}

/**
 * 剪贴板监听 Hook
 * 定期检查剪贴板内容，当检测到有效内容时触发回调
 */
export function useClipboardMonitor({
  onDetect,
  validator,
  interval = 3000,
}: UseClipboardMonitorOptions): UseClipboardMonitorReturn {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let intervalId: NodeJS.Timeout | null = null;

    const checkClipboard = async () => {
      if (!active) return;

      try {
        // 读取剪贴板内容
        const text = await navigator.clipboard.readText();

        // 验证内容
        if (validator(text)) {
          onDetect(text);
          // 检测到后停止监控
          setEnabled(false);
        }
      } catch (err: any) {
        // 权限被拒绝或其他错误
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setHasPermission(false);
          console.warn('剪贴板读取权限被拒绝');
        }
        // 其他错误忽略，可能只是剪贴板为空
      }
    };

    // 请求剪贴板读取权限
    const requestPermission = async () => {
      try {
        // 尝试检查权限状态
        if ('permissions' in navigator) {
          const permissionStatus = await navigator.permissions.query({
            name: 'clipboard-read' as PermissionName,
          });

          setHasPermission(permissionStatus.state === 'granted');

          // 监听权限变化
          permissionStatus.onchange = () => {
            setHasPermission(permissionStatus.state === 'granted');
          };

          // 如果权限已授予，开始监控
          if (permissionStatus.state === 'granted') {
            // 立即检查一次
            await checkClipboard();
            // 定期检查
            intervalId = setInterval(checkClipboard, interval);
          }
        } else {
          // 如果不支持 permissions API，直接尝试读取
          await checkClipboard();
          intervalId = setInterval(checkClipboard, interval);
          setHasPermission(true);
        }
      } catch (err) {
        console.error('请求剪贴板权限失败:', err);
        setHasPermission(false);
      }
    };

    requestPermission();

    return () => {
      active = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [enabled, interval, onDetect, validator]);

  return { enabled, setEnabled, hasPermission };
}
