import { useState, useEffect } from "react";
import { DeviceCard } from "./components/device-card";
import { showNotification } from "./lib/notifications";
import { FileTransferDialog } from "./components/file-transfer-dialog";
import { TextTransferDialog } from "./components/text-transfer-dialog";
import { IncomingFilesDialog } from "./components/incoming-files-dialog";
import { TextMessageDialog } from "./components/text-message-dialog";
import { HistoryDialog, HistoryItem } from "./components/history-dialog";
import { SettingsDialog } from "./components/settings-dialog";
import { ShareDialog } from "./components/share-dialog";
import { ManualConnectionDialog } from "./components/manual-connection-dialog";
import { ConnectionHistoryDialog } from "./components/connection-history-dialog";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Toaster } from "./components/ui/sonner";
import { Settings, History, Wifi, Info, Share2, QrCode, Clock } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "./store/use-store";
import { HybridConnectionManager, P2PMessage } from "./lib/hybrid-connection-manager";
import { P2PConnection } from "./lib/webrtc";
import { DeviceInfo } from "./lib/device-manager";
import { v4 as uuidv4 } from 'uuid';

let connectionManager: HybridConnectionManager | null = null;
const p2pConnections = new Map<string, P2PConnection>();
const fileMetadataCache = new Map<string, any>();

function App() {
  const {
    myDevice,
    devices,
    isConnected,
    setMyDevice,
    setDevices,
    addDevice,
    removeDevice,
    setIsConnected,
    transfers,
    addTransfer,
    updateTransfer,
    history,
    addHistory,
    deleteHistory,
    settings,
    updateSettings,
    getDeviceById,
    connectionHistory,
    addConnectionHistory,
  } = useStore();

  const [fileTransferDialog, setFileTransferDialog] = useState<{
    open: boolean;
    device: DeviceInfo | null;
  }>({ open: false, device: null });

  const [textTransferDialog, setTextTransferDialog] = useState<{
    open: boolean;
    device: DeviceInfo | null;
  }>({ open: false, device: null });

  const [incomingFiles, setIncomingFiles] = useState<Map<string, {
    fileName: string;
    fileSize: number;
    senderName: string;
    remoteDeviceId: string;
    status: 'pending' | 'receiving' | 'completed' | 'rejected';
    progress: number;
  }>>(new Map());
  const [incomingFilesDialogOpen, setIncomingFilesDialogOpen] = useState(false);

  const [receivedTextMessage, setReceivedTextMessage] = useState<{
    open: boolean;
    senderName: string;
    message: string;
  }>({
    open: false,
    senderName: '',
    message: '',
  });

  const [historyDialog, setHistoryDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [manualConnectionDialog, setManualConnectionDialog] = useState(false);
  const [connectionHistoryDialog, setConnectionHistoryDialog] = useState(false);

  // 初始化P2P发现和连接管理
  useEffect(() => {
    // 从 localStorage 加载连接历史
    const savedHistory = localStorage.getItem('xtrans-connection-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // 更新 store 中的连接历史
        useStore.setState({ connectionHistory: parsed });
      } catch (error) {
        console.error('加载连接历史失败:', error);
      }
    }

    const initP2P = async () => {
      // 初始化连接管理器
      connectionManager = new HybridConnectionManager({
        preferredType: 'webrtc',
        fallbackTypes: ['websocket'],
        timeout: 10000,
        retryAttempts: 3,
      });

      // 确保本地设备信息存在
      let deviceId = localStorage.getItem('xtrans-device-id');
      if (!deviceId) {
        deviceId = uuidv4();
        localStorage.setItem('xtrans-device-id', deviceId);
      }

      const deviceName = localStorage.getItem('xtrans-device-name') || settings.deviceName || 'Unknown Device';

      const currentDevice: DeviceInfo = {
        deviceId,
        deviceName,
        deviceType: 'desktop', // 简单起见，或者使用检测逻辑
        platform: 'web',
        browser: 'chrome',
        ipAddress: '',
        online: true,
        lastSeen: Date.now(),
      };

      // 更新 Store 和 ConnectionManager
      setMyDevice(currentDevice);
      connectionManager.setLocalDeviceInfo(currentDevice);
      console.log("初始化完成，本地设备信息已设置:", currentDevice);

      // 监听连接管理器事件
      connectionManager.addEventListener((event) => {
        console.log("App收到事件:", event.type, event);
        if (event.type === 'handshakeReceived' && event.message?.data) {
          const device = event.message.data as DeviceInfo;
          console.log("处理握手数据，添加设备:", device);
          addDevice(device);

          // 保存到连接历史
          addConnectionHistory(device);

          toast.success(`已连接到设备: ${device.deviceName}`);
          showNotification('设备已连接', `${device.deviceName} 已上线`, { sound: true });
        } else if (event.type === 'messageReceived' && event.message) {
          const { type, data } = event.message;
          const senderId = event.deviceId;
          const senderDevice = getDeviceById(senderId);
          const senderName = senderDevice?.deviceName || '未知设备';

          if (type === 'text') {
            // 处理文本消息
            const textContent = data.content || (typeof data === 'string' ? data : JSON.stringify(data));
            setReceivedTextMessage({
              open: true,
              senderName,
              message: textContent,
            });
            showNotification('收到新消息', `${senderName}: ${textContent}`, { sound: true });

            // 添加到历史记录
            addHistory({
              id: Date.now().toString(),
              type: "text",
              timestamp: Date.now(),
              deviceName: senderName,
              direction: "received",
              text: textContent,
            });
          } else if (type === 'file') {
            // data 是原始的 DataMessage
            const msg = data as any;
            if (msg.type === 'metadata') {
               // 收到文件传输请求
               const fileId = msg.fileId;
               const fileName = msg.name;
               const fileSize = msg.size;

               // 更新 incomingFiles 状态，显示接收弹窗
               setIncomingFiles((prev) => {
                 const newMap = new Map(prev);
                 newMap.set(fileId, {
                   fileName,
                   fileSize,
                   senderName,
                   remoteDeviceId: senderId,
                   status: 'pending',
                   progress: 0
                 });
                 return newMap;
               });
               setIncomingFilesDialogOpen(true);
               showNotification('收到文件请求', `${senderName} 想要发送文件: ${fileName}`, { sound: true });

               // 缓存元数据，以便后续接收使用
               fileMetadataCache.set(fileId, msg);
            }
          }
        }
      });

      setIsConnected(true);
    };

    initP2P();

    return () => {
      connectionManager = null;
    };
  }, []);

  // 监听主题变化
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (settings.theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // 监听设置变化，更新连接管理器的设备信息
  useEffect(() => {
    if (connectionManager && myDevice) {
      const updatedDevice = {
        ...myDevice,
        deviceName: settings.deviceName
      };
      connectionManager.setLocalDeviceInfo(updatedDevice);

      // 同时更新 myDevice 以保持一致
      if (myDevice.deviceName !== settings.deviceName) {
        setMyDevice(updatedDevice);
        // 广播更新给所有已连接的设备
        connectionManager.broadcastDeviceInfoUpdate();
      }
    }
  }, [settings.deviceName, myDevice]);

  // 发送文件
  const handleSendFile = (device: DeviceInfo) => {
    setFileTransferDialog({ open: true, device });
  };

  // 发送文字
  const handleSendText = (device: DeviceInfo) => {
    setTextTransferDialog({ open: true, device });
  };

  // 文字发送
  const handleTextSend = (text: string, device: DeviceInfo) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      type: "text",
      timestamp: Date.now(),
      deviceName: device.deviceName,
      direction: "sent",
      text,
    };
    addHistory(newItem);
  };

  // 文件传输处理
  useEffect(() => {
    const handleTransferFiles = async (e: CustomEvent) => {
      const { targetDevice, files, onProgress } = e.detail;

      // 尝试建立连接
      const connected = await connectionManager?.connectToDevice(targetDevice.deviceId, targetDevice);
      if (!connected) {
        toast.error("无法连接到设备");
        return;
      }

      // 传输文件
      for (const file of files) {
        try {
          const fileId = await connectionManager?.sendMessage(targetDevice.deviceId, {
            type: 'file',
            data: file,
            timestamp: Date.now(),
            id: Math.random().toString(36).substring(7),
          });

          if (fileId) {
            toast.success(`文件 ${file.name} 发送成功`);
            showNotification('文件发送成功', `文件 ${file.name} 已发送到 ${targetDevice.deviceName}`, { sound: true });

            addHistory({
              id: Date.now().toString(),
              type: "file",
              timestamp: Date.now(),
              deviceName: targetDevice.deviceName,
              direction: "sent",
              fileName: file.name,
              fileSize: file.size,
            });
          }
        } catch (error) {
          toast.error(`文件传输失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
    };

    const handleTransferText = async (e: CustomEvent) => {
      const { targetDevice, text } = e.detail;

      const connected = await connectionManager?.connectToDevice(targetDevice.deviceId, targetDevice);
      if (!connected) {
        toast.error("无法连接到设备");
        return;
      }

      try {
        await connectionManager?.sendMessage(targetDevice.deviceId, {
          type: 'text',
          data: text,
          timestamp: Date.now(),
          id: Math.random().toString(36).substring(7),
        });
        toast.success("文字发送成功");
      } catch (error) {
        toast.error(`文字发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };

    window.addEventListener("transfer-files", handleTransferFiles as EventListener);
    window.addEventListener("transfer-text", handleTransferText as EventListener);

    return () => {
      window.removeEventListener("transfer-files", handleTransferFiles as EventListener);
      window.removeEventListener("transfer-text", handleTransferText as EventListener);
    };
  }, [myDevice]);

  // 接受文件
  const handleAcceptFile = async (fileId: string) => {
    const file = incomingFiles.get(fileId);
    if (!file) return;

    try {
      // 更新状态为接收中
      setIncomingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileId, { ...file, status: 'receiving', progress: 0 });
        return newMap;
      });

      const metadata = fileMetadataCache.get(fileId);

      if (!connectionManager) throw new Error("Connection manager not initialized");

      const receivedFile = await connectionManager.receiveFile(
        file.remoteDeviceId,
        fileId,
        metadata,
        (progress) => {
          setIncomingFiles((prev) => {
            const newMap = new Map(prev);
            const current = newMap.get(fileId);
            if (current) {
              newMap.set(fileId, { ...current, progress });
            }
            return newMap;
          });
        }
      );

      const url = URL.createObjectURL(receivedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = receivedFile.name;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`文件 ${receivedFile.name} 接收成功`);
      showNotification('文件接收成功', `文件 ${receivedFile.name} 已接收`, { sound: true });

      fileMetadataCache.delete(fileId);

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        type: "file",
        timestamp: Date.now(),
        deviceName: file.senderName,
        direction: "received",
        fileName: file.fileName,
        fileSize: file.fileSize,
      };
      addHistory(newItem);

      setIncomingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileId, { ...file, status: 'completed', progress: 100 });
        setTimeout(() => {
          setIncomingFiles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            if (newMap.size === 0) {
              setIncomingFilesDialogOpen(false);
            }
            return newMap;
          });
        }, 3000);
        return newMap;
      });
    } catch (error) {
      console.error(error);
      toast.error(`接收文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
      fileMetadataCache.delete(fileId);
    }
  };

  // 拒绝文件
  const handleRejectFile = (fileId: string) => {
    const file = incomingFiles.get(fileId);
    if (file && file.remoteDeviceId) {
      connectionManager?.sendMessage(file.remoteDeviceId, {
        type: 'file',
        data: { action: 'reject', fileId },
        timestamp: Date.now(),
        id: Math.random().toString(36).substring(7),
      });

      fileMetadataCache.delete(fileId);
    }

    setIncomingFiles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      if (newMap.size === 0) {
        setIncomingFilesDialogOpen(false);
      }
      return newMap;
    });
  };

  const onlineDevices = devices.filter((d) => d.online);

  // 处理快速重连
  const handleQuickReconnect = async (deviceId: string, deviceName: string) => {
    toast.info(`正在重连到 ${deviceName}...`);
    // TODO: 实现快速重连逻辑
    // 这需要保存之前的连接码或重新建立连接
    console.log('快速重连:', deviceId, deviceName);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Toaster position="top-center" />

      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Wifi className="size-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  XTrans
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  无服务器P2P传输
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShareDialog(true)}>
                <Share2 className="size-4 mr-2" />
                分享
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConnectionHistoryDialog(true)}>
                <Clock className="size-4 mr-2" />
                连接历史
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setHistoryDialog(true)}>
                <History className="size-4 mr-2" />
                历史
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSettingsDialog(true)}>
                <Settings className="size-4 mr-2" />
                设置
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  我的设备
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {settings.deviceName}
                </p>
                <p className="text-xs text-gray-500">
                  {isConnected ? (
                    <span className="text-green-600">已就绪</span>
                  ) : (
                    <span className="text-red-600">未就绪</span>
                  )}
                </p>
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-gray-800" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  在线设备
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">
                    {onlineDevices.length} 台
                  </Badge>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setManualConnectionDialog(true)}>
              <QrCode className="size-4 mr-2" />
              连接设备
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                无服务器P2P模式。点击"连接设备"通过二维码或连接码与局域网或互联网上的设备建立直连。
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            我的设备
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myDevice && (
              <DeviceCard device={{ ...myDevice, isSelf: true }} />
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            可用设备
          </h2>
          {onlineDevices.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <Wifi className="size-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                未连接其他设备
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                点击"连接设备"按钮开始连接
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onlineDevices.map((device) => (
                <DeviceCard
                  key={device.deviceId}
                  device={device}
                  onSendFile={handleSendFile}
                  onSendText={handleSendText}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <FileTransferDialog
        open={fileTransferDialog.open}
        onOpenChange={(open) =>
          setFileTransferDialog({ open, device: fileTransferDialog.device })
        }
        targetDevice={fileTransferDialog.device}
      />

      <TextTransferDialog
        open={textTransferDialog.open}
        onOpenChange={(open) =>
          setTextTransferDialog({ open, device: textTransferDialog.device })
        }
        targetDevice={textTransferDialog.device}
        onSend={handleTextSend}
      />

      <IncomingFilesDialog
        open={incomingFilesDialogOpen}
        onOpenChange={setIncomingFilesDialogOpen}
        files={incomingFiles}
        onAccept={handleAcceptFile}
        onReject={handleRejectFile}
      />

      <TextMessageDialog
        open={receivedTextMessage.open}
        onOpenChange={(open) => {
          if (!open) {
            setReceivedTextMessage((prev) => {
              if (prev.senderName && prev.message) {
                const newItem: HistoryItem = {
                  id: Date.now().toString(),
                  type: "text",
                  timestamp: Date.now(),
                  deviceName: prev.senderName,
                  direction: "received",
                  text: prev.message,
                };
                addHistory(newItem);
              }
              return { ...prev, open };
            });
          } else {
            setReceivedTextMessage((prev) => ({ ...prev, open }));
          }
        }}
        senderName={receivedTextMessage.senderName}
        message={receivedTextMessage.message}
        onCopy={() => {}}
      />

      <HistoryDialog
        open={historyDialog}
        onOpenChange={setHistoryDialog}
        history={history}
        onDelete={deleteHistory}
      />

      <SettingsDialog
        open={settingsDialog}
        onOpenChange={setSettingsDialog}
        deviceName={settings.deviceName}
        onDeviceNameChange={(name) => {
          updateSettings({ deviceName: name });
          localStorage.setItem('xtrans-device-name', name);
        }}
        theme={settings.theme}
        onThemeChange={(theme) => updateSettings({ theme })}
        soundEnabled={settings.soundEnabled}
        onSoundEnabledChange={(enabled) => updateSettings({ soundEnabled: enabled })}
        notificationsEnabled={settings.notificationsEnabled}
        onNotificationsEnabledChange={(enabled) =>
          updateSettings({ notificationsEnabled: enabled })
        }
      />

      <ShareDialog
        open={shareDialog}
        onOpenChange={setShareDialog}
      />

      <ManualConnectionDialog
        open={manualConnectionDialog}
        onOpenChange={setManualConnectionDialog}
        connectionManager={connectionManager}
      />

      <ConnectionHistoryDialog
        open={connectionHistoryDialog}
        onOpenChange={setConnectionHistoryDialog}
        onReconnect={handleQuickReconnect}
      />
    </div>
  );
}

export default App;