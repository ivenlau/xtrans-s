import { useState, useEffect } from "react";
import { DeviceCard } from "./components/device-card";
import { showNotification, checkNotificationPermission } from "./lib/notifications";
import { FileTransferDialog } from "./components/file-transfer-dialog";
import { TextTransferDialog } from "./components/text-transfer-dialog";
import { IncomingFilesDialog } from "./components/incoming-files-dialog";
import { TextMessageDialog } from "./components/text-message-dialog";
import { HistoryDialog, HistoryItem } from "./components/history-dialog";
import { SettingsDialog } from "./components/settings-dialog";
import { ShareDialog } from "./components/share-dialog";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Toaster } from "./components/ui/sonner";
import { Settings, History, RefreshCw, Wifi, Info, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "./store/use-store";
import { DeviceManager } from "./lib/device-manager";
import { P2PConnection } from "./lib/webrtc";
import { DeviceInfo } from "./lib/device-manager";

// 设备管理器实例
let deviceManager: DeviceManager | null = null;
// P2P 连接映射
const p2pConnections = new Map<string, P2PConnection>();
// 文件元数据缓存（用于接收文件）
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
  } = useStore();

  const [fileTransferDialog, setFileTransferDialog] = useState<{
    open: boolean;
    device: DeviceInfo | null;
  }>({ open: false, device: null });

  const [textTransferDialog, setTextTransferDialog] = useState<{
    open: boolean;
    device: DeviceInfo | null;
  }>({ open: false, device: null });

  // 接收文件列表
  const [incomingFiles, setIncomingFiles] = useState<Map<string, {
    fileName: string;
    fileSize: number;
    senderName: string;
    remoteDeviceId: string;
    status: 'pending' | 'receiving' | 'completed' | 'rejected';
    progress: number;
  }>>(new Map());
  const [incomingFilesDialogOpen, setIncomingFilesDialogOpen] = useState(false);

  // 接收到的文字消息
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 初始化设备管理器
  useEffect(() => {
    const initDeviceManager = async () => {
      // 请求通知权限
      await checkNotificationPermission();

      // 动态生成WebSocket URL：从当前页面地址提取主机名（IP或域名）
      let websocketUrl = import.meta.env.VITE_WEBSOCKET_URL;

      if (!websocketUrl) {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        websocketUrl = `${protocol}//${hostname}:3002`;
      }

      deviceManager = new DeviceManager(websocketUrl);

      // 连接到服务器
      try {
        const deviceId = await deviceManager.connect(settings.deviceName);
        setIsConnected(true);
      } catch (error) {
        console.error('WebSocket连接失败:', error);
        toast.error("连接服务器失败");
        setIsConnected(false);
      }

      // 监听设备事件
      deviceManager.on((event) => {
        switch (event.type) {
          case "devices_updated":
            setDevices(event.devices);
            break;
          case "device_joined":
            addDevice(event.device);
            toast.success(`设备 ${event.device.deviceName} 已上线`);
            // 播放声音和显示桌面通知
            showNotification(
              '设备上线',
              `${event.device.deviceName} 已上线`,
              { sound: true, desktop: true }
            );
            break;
          case "device_left":
            removeDevice(event.deviceId);
            toast.info(`设备已离线`);
            break;
          case "device_name_updated":
            // 更新设备列表中的设备名称
            setDevices((prevDevices) =>
              prevDevices.map((device) =>
                device.deviceId === event.deviceId
                  ? { ...device, deviceName: event.deviceName }
                  : device
              )
            );
            toast.info(`设备名称已更新`);
            break;
          case "offer":
            handleWebRTCOffer(event);
            break;
          case "answer":
            handleWebRTCAnswer(event);
            break;
          case "ice_candidate":
            handleICECandidate(event);
            break;
          case "transfer_request":
            handleTransferRequest(event);
            break;
          // text_message 现在通过 WebRTC P2P 传输，不再通过 WebSocket
          // case "text_message":
          //   handleTextMessage(event);
          //   break;
        }
      });

      // 获取我的设备信息
      const myDevice = deviceManager.getMyDevice();
      if (myDevice) {
        setMyDevice(myDevice);
      }
      setIsConnected(deviceManager.isConnected());

      return () => {
        deviceManager?.disconnect();
        deviceManager = null;
      };
    };

    initDeviceManager();
  }, []);

  // 监听设置变化
  useEffect(() => {
    if (settings.deviceName && myDevice) {
      // 更新设备名称
      myDevice.deviceName = settings.deviceName;
      setMyDevice({ ...myDevice });
    }
  }, [settings.deviceName]);

  // 同步声音和通知设置到 localStorage
  useEffect(() => {
    // 初始化时设置默认值
    if (!localStorage.getItem('soundEnabled')) {
      localStorage.setItem('soundEnabled', String(settings.soundEnabled));
    }
    if (!localStorage.getItem('notificationsEnabled')) {
      localStorage.setItem('notificationsEnabled', String(settings.notificationsEnabled));
    }
  }, []);

  // 监听设置变化并同步到 localStorage
  useEffect(() => {
    localStorage.setItem('soundEnabled', String(settings.soundEnabled));
    localStorage.setItem('notificationsEnabled', String(settings.notificationsEnabled));
  }, [settings.soundEnabled, settings.notificationsEnabled]);

  // 应用主题
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [settings.theme]);

  // WebRTC Offer 处理
  const handleWebRTCOffer = async (event: any) => {
    const connection = new P2PConnection(
      myDevice?.deviceId || "",
      event.from,
      false
    );

    // 设置事件监听
    setupP2PConnection(connection, event.from);

    // 设置远程描述并创建 Answer
    await connection.setRemoteDescription(event.sdp);
    const answer = await connection.createAnswer();

    // 发送 Answer
    deviceManager?.sendSignaling("answer", event.from, answer);

    p2pConnections.set(event.from, connection);
  };

  // WebRTC Answer 处理
  const handleWebRTCAnswer = async (event: any) => {
    const connection = p2pConnections.get(event.from);
    if (connection) {
      await connection.setRemoteDescription(event.sdp);
    }
  };

  // ICE Candidate 处理
  const handleICECandidate = async (event: any) => {
    const connection = p2pConnections.get(event.from);
    if (connection) {
      await connection.addIceCandidate(event.candidate);
    }
  };

  // 设置 P2P 连接事件
  const setupP2PConnection = (connection: P2PConnection, remoteDeviceId: string) => {
    connection.onIceCandidate((candidate) => {
      deviceManager?.sendSignaling("ice_candidate", remoteDeviceId, candidate);
    });

    // 监听消息
    connection.onMessage((message) => {
      if (message.type === 'metadata') {
        // 保存到缓存
        fileMetadataCache.set(message.fileId, message);

        // 收到文件元数据，添加到接收列表
        const fromDevice = getDeviceById(remoteDeviceId);
        if (fromDevice) {

          // 播放声音和显示桌面通知
          showNotification(
            '收到文件',
            `${fromDevice.deviceName} 想要发送文件 "${message.name}" (${Math.round(message.size / 1024)}KB)`,
            { sound: true, desktop: true }
          );

          setIncomingFiles((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.fileId, {
              fileName: message.name,
              fileSize: message.size,
              senderName: fromDevice.deviceName,
              remoteDeviceId: remoteDeviceId,
              status: 'pending',
              progress: 0,
            });
            // 自动打开对话框
            setIncomingFilesDialogOpen(true);
            return newMap;
          });

          // 不再显示 toast，因为已经有弹窗列表了
        } else {
          // Device not found
        }
      } else if (message.type === 'file_cancel') {
        // 发送方超时取消了文件传输，从接收列表删除
        setIncomingFiles((prev) => {
          const newMap = new Map(prev);
          newMap.delete(message.fileId);
          // 如果列表为空，关闭对话框
          if (newMap.size === 0) {
            setIncomingFilesDialogOpen(false);
          }
          return newMap;
        });
        // 清理缓存
        fileMetadataCache.delete(message.fileId);
      } else if (message.type === 'text') {
        // 处理通过 WebRTC 接收的文字消息
        const fromDevice = getDeviceById(remoteDeviceId);
        if (fromDevice) {
          // 播放声音和显示桌面通知
          showNotification(
            `收到 ${fromDevice.deviceName} 的消息`,
            message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
            { sound: true, desktop: true }
          );

          // 显示文字消息对话框
          setReceivedTextMessage({
            open: true,
            senderName: fromDevice.deviceName,
            message: message.content,
          });

          // 添加到历史记录
          const newItem: HistoryItem = {
            id: Date.now().toString(),
            type: "text",
            timestamp: Date.now(),
            deviceName: fromDevice.deviceName,
            direction: "received",
            text: message.content,
          };
          addHistory(newItem);
        }
      }
    });
  };

  // 传输请求处理（现在不需要了，直接通过 P2P 接收）
  const handleTransferRequest = (event: any) => {
    // 不再需要这个处理，因为现在直接通过 P2P data channel 接收文件
  };

  // 文字消息处理 - 已废弃，现在通过 WebRTC P2P 传输
  // const handleTextMessage = (event: any) => {
  //   const message = event.message;
  //   const fromDevice = getDeviceById(event.from);
  //   if (fromDevice) {
  //     showNotification(
  //       `收到 ${fromDevice.deviceName} 的消息`,
  //       message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
  //       { sound: true, desktop: true }
  //     );
  //     setReceivedTextMessage({
  //       open: true,
  //       senderName: fromDevice.deviceName,
  //       message: message.content || message,
  //     });
  //   }
  // };

  // 刷新设备列表
  const handleRefresh = () => {
    setIsRefreshing(true);
    deviceManager?.refreshDevices();
    toast.info("正在刷新设备列表...");
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("设备列表已更新");
    }, 1000);
  };

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

  // 监听文件传输事件
  useEffect(() => {
    const handleTransferFiles = async (e: CustomEvent) => {
      const { targetDevice, files, onProgress } = e.detail;

      // 创建 P2P 连接
      const connection = new P2PConnection(
        myDevice?.deviceId || "",
        targetDevice.deviceId,
        true
      );

      setupP2PConnection(connection, targetDevice.deviceId);
      p2pConnections.set(targetDevice.deviceId, connection);

      // 等待连接建立
      connection.onStatus((status) => {
        if (status === "connected") {
          // 开始传输文件
          files.forEach(async (file: File) => {
            try {
              toast.info(`正在等待 ${targetDevice.deviceName} 接收文件...`);

              await connection.sendFile(file, (transferred, total, speed) => {
                const progress = (transferred / total) * 100;
                onProgress(progress);
              });

              toast.success(`文件 ${file.name} 发送成功`);

              // 播放声音提示传输完成
              showNotification(
                '文件发送成功',
                `文件 ${file.name} 已成功发送到 ${targetDevice.deviceName}`,
                { sound: true, desktop: false }
              );

              // 添加到历史
              addHistory({
                id: Date.now().toString(),
                type: "file",
                timestamp: Date.now(),
                deviceName: targetDevice.deviceName,
                direction: "sent",
                fileName: file.name,
                fileSize: file.size,
              });
            } catch (error) {
              toast.error(`文件传输失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
          });
        }
      });

      // 创建 Offer
      try {
        const offer = await connection.createOffer();
        deviceManager?.sendSignaling("offer", targetDevice.deviceId, offer);
      } catch (error) {
        // Failed to create offer
      }
    };

    const handleTransferText = async (e: CustomEvent) => {
      const { targetDevice, text } = e.detail;

      // 检查是否已存在 P2P 连接
      let connection = p2pConnections.get(targetDevice.deviceId);

      // 如果不存在连接，创建新的 P2P 连接
      if (!connection) {
        connection = new P2PConnection(
          myDevice?.deviceId || "",
          targetDevice.deviceId,
          true
        );

        setupP2PConnection(connection, targetDevice.deviceId);
        p2pConnections.set(targetDevice.deviceId, connection);

        // 创建 Offer 并发送
        try {
          const offer = await connection.createOffer();
          deviceManager?.sendSignaling("offer", targetDevice.deviceId, offer);
        } catch (error) {
          toast.error("创建连接失败");
          return;
        }
      }

      // 如果连接已经建立，直接发送
      if (connection.isReady()) {
        try {
          connection.sendText(text);
          toast.success("文字发送成功");
        } catch (error) {
          toast.error(`文字发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      } else {
        // 连接未建立，等待连接建立后发送
        const statusCallback = (status: 'connecting' | 'connected' | 'transferring' | 'completed' | 'failed') => {
          if (status === "connected") {
            try {
              connection.sendText(text);
              toast.success("文字发送成功");
            } catch (error) {
              toast.error(`文字发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
          } else if (status === "failed") {
            toast.error("连接失败，请重试");
          }
        };

        // 一次性监听状态变化
        connection.onStatus(statusCallback);
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
    if (!file) {
      // File not found
      return;
    }

    const connection = p2pConnections.get(file.remoteDeviceId);
    if (!connection) {
      toast.error("接收文件失败：连接不存在");
      return;
    }
    // 发送接受消息
    connection.sendMessage({
      type: 'file_accept',
      fileId: fileId,
    });
    // 更新状态为正在接收
    setIncomingFiles((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(fileId);
      if (existing) {
        newMap.set(fileId, { ...existing, status: 'receiving' });
      }
      return newMap;
    });

    try {
      // 从缓存获取 metadata（如果有的话）
      const cachedMetadata = fileMetadataCache.get(fileId);
      const { file: receivedFile } = await connection.receiveFile(
        fileId,
        (transferred, total, speed) => {
          // 更新进度
          const progress = Math.round((transferred / total) * 100);
          setIncomingFiles((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(fileId);
            if (existing) {
              newMap.set(fileId, { ...existing, progress });
            }
            return newMap;
          });
        },
        cachedMetadata // 传入缓存的 metadata
      );

      // File received, starting download
      // 下载文件
      const url = URL.createObjectURL(receivedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = receivedFile.name;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`文件 ${receivedFile.name} 接收成功`);

      // 播放声音提示接收完成
      showNotification(
        '文件接收成功',
        `文件 ${receivedFile.name} 已成功接收`,
        { sound: true, desktop: false }
      );

      // 清理缓存
      fileMetadataCache.delete(fileId);

      // 添加到历史
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

      // 更新状态为完成
      setIncomingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileId, { ...file, status: 'completed', progress: 100 });
        // 3秒后从列表移除
        setTimeout(() => {
          setIncomingFiles((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            // 如果列表为空，关闭对话框
            if (newMap.size === 0) {
              setIncomingFilesDialogOpen(false);
            }
            return newMap;
          });
        }, 3000);
        return newMap;
      });
    } catch (error) {
      toast.error("接收文件失败");
      fileMetadataCache.delete(fileId);

      // 更新状态为失败
      setIncomingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
    }
  };

  // 拒绝文件
  const handleRejectFile = (fileId: string) => {
    const file = incomingFiles.get(fileId);
    if (file && file.remoteDeviceId) {
      const connection = p2pConnections.get(file.remoteDeviceId);
      if (connection) {
        // 发送拒绝消息
        connection.sendMessage({
          type: 'file_reject',
          fileId: fileId,
        });
      }

      // 清理缓存
      fileMetadataCache.delete(fileId);
    }

    // 从列表移除（不显示 toast，因为文件已经从列表消失）
    setIncomingFiles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      // 如果列表为空，关闭对话框
      if (newMap.size === 0) {
        setIncomingFilesDialogOpen(false);
      }
      return newMap;
    });
  };

  const onlineDevices = devices.filter((d) => d.online);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Toaster position="top-center" />

      {/* Header */}
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
                  局域网文件传输
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShareDialog(true)}>
                <Share2 className="size-4 mr-2" />
                分享
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Bar */}
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
                    <span className="text-green-600">已连接</span>
                  ) : (
                    <span className="text-red-600">未连接</span>
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
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`size-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              刷新设备
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                确保所有设备连接到同一局域网。数据传输完全在本地进行，不经过任何第三方服务器。
              </p>
            </div>
          </div>
        </div>

        {/* My Device */}
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

        {/* Online Devices */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            可用设备
          </h2>
          {onlineDevices.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <Wifi className="size-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                未发现其他设备
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                请确保其他设备已连接到同一局域网并打开 XTrans
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

      {/* Dialogs */}
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
          // 关闭对话框时添加到历史记录
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
        onCopy={() => {
          // 复制已由对话框处理
        }}
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
          // 更新本地设置
          updateSettings({ deviceName: name });
          // 同步设备名称到服务器和其他设备
          if (deviceManager) {
            deviceManager.updateDeviceName(name);
          }
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
    </div>
  );
}

export default App;
