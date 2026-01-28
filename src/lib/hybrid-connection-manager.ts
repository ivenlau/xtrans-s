import { P2PConnection } from './webrtc';
import { DeviceInfo } from './device-manager';

// 连接类型枚举
export enum ConnectionType {
  WEBRTC = 'webrtc',
  WEBSOCKET = 'websocket',
  HYBRID = 'hybrid'
}

// 连接状态
export interface ConnectionState {
  type: ConnectionType;
  status: 'connecting' | 'connected' | 'failed' | 'disconnected';
  deviceId: string;
  latency?: number;
  lastActive: number;
}

// 连接策略
export interface ConnectionStrategy {
  preferredType: ConnectionType;
  fallbackTypes: ConnectionType[];
  timeout: number;
  retryAttempts: number;
}

// 消息类型
export interface P2PMessage {
  type: 'text' | 'file' | 'control' | 'handshake';
  data: any;
  timestamp: number;
  id: string;
}

export class HybridConnectionManager {
  private connections = new Map<string, P2PConnection | WebSocketConnection>();
  private connectionStates = new Map<string, ConnectionState>();
  private messageHandlers = new Map<string, (message: P2PMessage) => void>();
  private eventListeners = new Set<(event: ConnectionEvent) => void>();
  private localDeviceInfo: DeviceInfo | null = null;

  constructor(private strategy: ConnectionStrategy = {
    preferredType: ConnectionType.WEBRTC,
    fallbackTypes: [ConnectionType.WEBSOCKET],
    timeout: 10000,
    retryAttempts: 3
  }) {}

  setLocalDeviceInfo(info: DeviceInfo) {
    console.log("设置本地设备信息:", info);
    this.localDeviceInfo = info;
  }

  // 广播设备信息更新
  async broadcastDeviceInfoUpdate() {
    if (!this.localDeviceInfo) return;

    console.log("广播设备信息更新...");
    const activeConnections = this.getActiveConnections();

    for (const state of activeConnections) {
      this.sendMessage(state.deviceId, {
        type: 'handshake',
        data: this.localDeviceInfo,
        timestamp: Date.now(),
        id: this.generateMessageId()
      });
    }
  }

  // 发送握手信息的辅助方法
  private sendHandshake(deviceId: string) {
    if (this.localDeviceInfo) {
      console.log(`向 ${deviceId} 发送握手信息...`);
      this.sendMessage(deviceId, {
        type: 'handshake',
        data: this.localDeviceInfo,
        timestamp: Date.now(),
        id: this.generateMessageId()
      }).then(success => {
        console.log(`握手发送结果 (${deviceId}):`, success);
      });
    } else {
      console.warn("无法发送握手：本地设备信息未设置");
    }
  }

  // 手动创建连接 Offer
  async createManualConnection(targetDeviceId: string): Promise<string> {
    const connection = new P2PConnection(
      this.getLocalDeviceId(),
      targetDeviceId,
      true
    );

    // 存储连接实例
    this.connections.set(targetDeviceId, connection);

    // 设置状态监听
    connection.onStatus((status) => {
      console.log(`连接状态变更 (${targetDeviceId}):`, status);
      if (status === 'connected') {
        this.setupConnectionHandlers(targetDeviceId, connection);

        // 发送握手信息 (多次尝试以确保送达)
        // 使用闭包变量 currentDeviceId 来确保总是向最新的 ID 发送（如果需要的话）
        // 但实际上，如果 ID 变了，说明握手已经成功了，就不需要再发了。
        // 所以我们只在 ID 没变的情况下重试。

        const sendHandshakeWithCheck = () => {
           // 检查连接是否还存在于 connections 中（使用原始 targetDeviceId）
           // 注意：如果握手成功，targetDeviceId (临时ID) 会被从 connections 中移除
           if (this.connections.has(targetDeviceId)) {
              this.sendHandshake(targetDeviceId);
           }
        };

        sendHandshakeWithCheck();
        setTimeout(sendHandshakeWithCheck, 1000);
        setTimeout(sendHandshakeWithCheck, 3000);

        const state: ConnectionState = {
          type: ConnectionType.WEBRTC,
          status: 'connected',
          deviceId: targetDeviceId,
          lastActive: Date.now()
        };
        this.connectionStates.set(targetDeviceId, state);
        this.emitEvent({ type: 'connectionStateChanged', deviceId: targetDeviceId, state });
      } else if (status === 'failed') {
        // ...
      }
    });

    // 创建压缩的离线 Offer
    return await connection.createCompressedOffer();
  }

  // 接受手动连接 Offer
  async acceptManualConnection(targetDeviceId: string, offerSdp: string): Promise<string> {
    const connection = new P2PConnection(
      this.getLocalDeviceId(),
      targetDeviceId,
      false
    );

    // 存储连接实例
    this.connections.set(targetDeviceId, connection);

    // 设置状态监听
    connection.onStatus((status) => {
      console.log(`连接状态变更 (${targetDeviceId}):`, status);
      if (status === 'connected') {
        this.setupConnectionHandlers(targetDeviceId, connection);

        // 发送握手信息 (多次尝试)
        const sendHandshakeWithCheck = () => {
           if (this.connections.has(targetDeviceId)) {
              this.sendHandshake(targetDeviceId);
           }
        };

        sendHandshakeWithCheck();
        setTimeout(sendHandshakeWithCheck, 1000);
        setTimeout(sendHandshakeWithCheck, 3000);

        const state: ConnectionState = {
          type: ConnectionType.WEBRTC,
          status: 'connected',
          deviceId: targetDeviceId,
          lastActive: Date.now()
        };
        this.connectionStates.set(targetDeviceId, state);
        this.emitEvent({ type: 'connectionStateChanged', deviceId: targetDeviceId, state });
      } else if (status === 'failed') {
        // ...
      }
    });

    // 创建压缩的离线 Answer
    return await connection.createCompressedAnswer(offerSdp);
  }

  // 完成手动连接 (发起方接收 Answer)
  async finalizeManualConnection(targetDeviceId: string, answerSdp: string): Promise<void> {
    const connection = this.connections.get(targetDeviceId);
    if (!connection || !(connection instanceof P2PConnection)) {
      throw new Error('Connection not found or invalid type');
    }

    // 使用压缩版本处理 Answer
    await connection.handleCompressedAnswer(answerSdp);
  }

  async connectToDevice(deviceId: string, deviceInfo: DeviceInfo): Promise<boolean> {
    // 检查是否已有活跃连接
    const existingConnection = this.connections.get(deviceId);
    const existingState = this.connectionStates.get(deviceId);

    if (existingConnection && existingState && existingState.status === 'connected') {
      console.log(`设备 ${deviceId} 已有活跃连接，复用连接`);
      return true;
    }

    const state: ConnectionState = {
      type: this.strategy.preferredType,
      status: 'connecting',
      deviceId,
      lastActive: Date.now()
    };
    
    this.connectionStates.set(deviceId, state);
    this.emitEvent({ type: 'connectionStateChanged', deviceId, state });

    let success = await this.tryConnection(deviceId, deviceInfo, this.strategy.preferredType);
    
    if (!success) {
      for (const fallbackType of this.strategy.fallbackTypes) {
        success = await this.tryConnection(deviceId, deviceInfo, fallbackType);
        if (success) break;
      }
    }

    if (success) {
      const state = this.connectionStates.get(deviceId)!;
      state.status = 'connected';
      this.connectionStates.set(deviceId, state);
      this.emitEvent({ type: 'connectionStateChanged', deviceId, state });
      return true;
    } else {
      const state = this.connectionStates.get(deviceId)!;
      state.status = 'failed';
      this.connectionStates.set(deviceId, state);
      this.emitEvent({ type: 'connectionStateChanged', deviceId, state });
      return false;
    }
  }

  private async tryConnection(deviceId: string, deviceInfo: DeviceInfo, type: ConnectionType): Promise<boolean> {
    try {
      switch (type) {
        case ConnectionType.WEBRTC:
          return await this.tryWebRTCConnection(deviceId, deviceInfo);
        case ConnectionType.WEBSOCKET:
          return await this.tryWebSocketConnection(deviceId, deviceInfo);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Connection attempt failed for type ${type}:`, error);
      return false;
    }
  }

  private async tryWebRTCConnection(deviceId: string, deviceInfo: DeviceInfo): Promise<boolean> {
    return new Promise((resolve) => {
      const connection = new P2PConnection(
        this.getLocalDeviceId(),
        deviceId,
        true
      );

      const timeout = setTimeout(() => {
        connection.close();
        resolve(false);
      }, this.strategy.timeout);

      connection.onStatus((status) => {
        if (status === 'connected') {
          clearTimeout(timeout);
          this.connections.set(deviceId, connection);
          this.setupConnectionHandlers(deviceId, connection);
          
          const state = this.connectionStates.get(deviceId)!;
          state.type = ConnectionType.WEBRTC;
          state.latency = Date.now() - state.lastActive;
          this.connectionStates.set(deviceId, state);
          
          resolve(true);
        } else if (status === 'failed') {
          clearTimeout(timeout);
          connection.close();
          resolve(false);
        }
      });

      this.initiateWebRTCConnection(connection, deviceInfo).catch(() => {
        clearTimeout(timeout);
        connection.close();
        resolve(false);
      });
    });
  }

  private async tryWebSocketConnection(deviceId: string, deviceInfo: DeviceInfo): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const wsUrl = this.getWebSocketUrl(deviceInfo);
        const wsConnection = new WebSocketConnection(wsUrl);

        const timeout = setTimeout(() => {
          wsConnection.close();
          resolve(false);
        }, this.strategy.timeout);

        wsConnection.onOpen(() => {
          clearTimeout(timeout);
          this.connections.set(deviceId, wsConnection);
          this.setupWebSocketHandlers(deviceId, wsConnection);
          
          const state = this.connectionStates.get(deviceId)!;
          state.type = ConnectionType.WEBSOCKET;
          state.latency = Date.now() - state.lastActive;
          this.connectionStates.set(deviceId, state);
          
          resolve(true);
        });

        wsConnection.onError(() => {
          clearTimeout(timeout);
          wsConnection.close();
          resolve(false);
        });

        wsConnection.connect();
      } catch (error) {
        resolve(false);
      }
    });
  }

  private async initiateWebRTCConnection(connection: P2PConnection, deviceInfo: DeviceInfo): Promise<void> {
    const offer = await connection.createOffer();
    this.exchangeSignaling(deviceInfo.deviceId, { type: 'offer', sdp: offer });
  }

  private async exchangeSignaling(targetDeviceId: string, signal: any): Promise<any> {
    const signalKey = `signal_${targetDeviceId}`;
    const responseKey = `signal_response_${this.getLocalDeviceId()}`;
    
    localStorage.setItem(signalKey, JSON.stringify(signal));
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const response = localStorage.getItem(responseKey);
        if (response) {
          clearInterval(checkInterval);
          localStorage.removeItem(responseKey);
          resolve(JSON.parse(response));
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, this.strategy.timeout);
    });
  }

  private getWebSocketUrl(deviceInfo: DeviceInfo): string {
    const ports = [8080, 3000, 3001, 8081];
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${deviceInfo.ipAddress}:8080`;
  }

  private setupConnectionHandlers(deviceId: string, connection: P2PConnection) {
    let currentDeviceId = deviceId;

    connection.onMessage((message) => {
      console.log(`收到来自 ${currentDeviceId} (原: ${deviceId}) 的消息:`, message);
      // 处理握手消息
      const msgType = this.getMessageType(message);
      console.log(`消息类型: ${msgType}`);

      if (msgType === 'handshake') {
        const handshakeData = typeof message === 'string' ? JSON.parse(message).data : (message as any).data;
        console.log("握手数据:", handshakeData);

        if (handshakeData && handshakeData.deviceId) {
          const realDeviceId = handshakeData.deviceId;
          console.log(`识别到真实设备ID: ${realDeviceId}, 当前ID: ${currentDeviceId}`);

          // 如果是临时 ID，更新映射
          if (currentDeviceId.startsWith('manual-')) {
            console.log("正在更新设备映射...");
            this.connections.set(realDeviceId, connection);
            this.connections.delete(currentDeviceId);

            // 更新连接状态
            const state = this.connectionStates.get(currentDeviceId);
            if (state) {
              state.deviceId = realDeviceId;
              this.connectionStates.set(realDeviceId, state);
              this.connectionStates.delete(currentDeviceId);
            }

            console.log("触发 handshakeReceived 事件");
            // 触发握手事件，通知上层应用发现新设备
            this.emitEvent({
              type: 'handshakeReceived',
              deviceId: realDeviceId,
              message: { type: 'handshake', data: handshakeData, timestamp: Date.now(), id: '' }
            });

            // 重新设置消息处理器
            const handler = this.messageHandlers.get(currentDeviceId);
            if (handler) {
              this.messageHandlers.set(realDeviceId, handler);
              this.messageHandlers.delete(currentDeviceId);
            }

            // 更新当前 ID
            currentDeviceId = realDeviceId;

            return; // 握手消息不传递给普通消息处理器
          } else {
             console.log("当前ID不是临时ID，忽略映射更新");
             // 即使不是临时ID，如果是握手消息，也应该触发事件更新信息
             this.emitEvent({
              type: 'handshakeReceived',
              deviceId: realDeviceId,
              message: { type: 'handshake', data: handshakeData, timestamp: Date.now(), id: '' }
            });
          }
        }
      }

      const handler = this.messageHandlers.get(currentDeviceId);
      if (handler) {
        handler({
          type: msgType,
          data: message,
          timestamp: Date.now(),
          id: this.generateMessageId()
        });
      } else {
        // 如果没有特定设备的处理器，尝试触发通用事件
        // 或者即使有处理器，也触发事件（推荐）
        this.emitEvent({
          type: 'messageReceived',
          deviceId: currentDeviceId,
          message: {
            type: msgType,
            data: message,
            timestamp: Date.now(),
            id: this.generateMessageId()
          }
        });

        if (!handler) {
           console.warn(`未找到设备 ${currentDeviceId} 的消息处理器，已触发通用事件`);
        }
      }
    });
  }

  private getMessageType(message: any): 'text' | 'file' | 'control' | 'handshake' {
    if (typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        if (['text', 'file', 'control', 'handshake'].includes(parsed.type)) {
          return parsed.type;
        }
      } catch {
        return 'text';
      }
    }
    // 检查对象是否包含 type 属性
    if (message && typeof message === 'object' && 'type' in message) {
        // 将 WebRTC 底层协议消息归类为 file
        if (['metadata', 'chunk', 'end', 'ack', 'file_accept', 'file_reject', 'file_cancel'].includes(message.type)) {
            return 'file';
        }
        return message.type;
    }
    return 'file';
  }

  async sendMessage(deviceId: string, message: P2PMessage): Promise<boolean> {
    const connection = this.connections.get(deviceId);
    if (!connection) {
      return false;
    }

    try {
      if (connection instanceof P2PConnection) {
        if (message.type === 'text') {
          connection.sendText(message.data);
        } else if (message.type === 'handshake') {
          // 使用 sendCustomMessage 发送握手消息
          connection.sendCustomMessage(message);
        } else if (message.type === 'file') {
          return await this.sendFileViaWebRTC(connection, message.data);
        }
      } else if (connection instanceof WebSocketConnection) {
        return connection.send(JSON.stringify(message));
      }

      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  private async sendFileViaWebRTC(connection: P2PConnection, file: File): Promise<boolean> {
    try {
      await connection.sendFile(file);
      return true;
    } catch (error) {
      console.error('WebRTC file transfer failed:', error);
      return false;
    }
  }

  async receiveFile(deviceId: string, fileId: string, initialMetadata?: any, onProgress?: (progress: number) => void): Promise<File> {
    const connection = this.connections.get(deviceId);
    if (!connection || !(connection instanceof P2PConnection)) {
      throw new Error('Connection not found or not P2P');
    }

    // 发送接受确认
    connection.sendCustomMessage({
      type: 'file_accept',
      fileId: fileId
    });

    const { file } = await connection.receiveFile(fileId, (transferred, total) => {
      if (onProgress && total > 0) {
        onProgress(Math.round((transferred / total) * 100));
      }
    }, initialMetadata);

    return file;
  }

  disconnect(deviceId: string): void {
    const connection = this.connections.get(deviceId);
    if (connection) {
      if (connection instanceof P2PConnection) {
        connection.close();
      } else if (connection instanceof WebSocketConnection) {
        connection.close();
      }
      this.connections.delete(deviceId);
    }

    const state = this.connectionStates.get(deviceId);
    if (state) {
      state.status = 'disconnected';
      this.connectionStates.set(deviceId, state);
      this.emitEvent({ type: 'connectionStateChanged', deviceId, state });
    }
  }

  getConnectionState(deviceId: string): ConnectionState | undefined {
    return this.connectionStates.get(deviceId);
  }

  getActiveConnections(): ConnectionState[] {
    return Array.from(this.connectionStates.values())
      .filter(state => state.status === 'connected');
  }

  onMessage(deviceId: string, handler: (message: P2PMessage) => void): void {
    this.messageHandlers.set(deviceId, handler);
  }

  addEventListener(listener: (event: ConnectionEvent) => void): void {
    this.eventListeners.add(listener);
  }

  removeEventListener(listener: (event: ConnectionEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  private emitEvent(event: ConnectionEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }

  private getLocalDeviceId(): string {
    return localStorage.getItem('localDeviceId') || 'unknown-device';
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substring(7);
  }
}

class WebSocketConnection {
  private ws: WebSocket | null = null;
  private onOpenCallback?: () => void;
  private onMessageCallback?: (message: any) => void;
  private onErrorCallback?: () => void;
  private onCloseCallback?: () => void;

  constructor(private url: string) {}

  connect(): void {
    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
      this.onOpenCallback?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessageCallback?.(data);
      } catch (error) {
        this.onMessageCallback?.(event.data);
      }
    };

    this.ws.onerror = () => {
      this.onErrorCallback?.();
    };

    this.ws.onclose = () => {
      this.onCloseCallback?.();
    };
  }

  send(data: string): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onOpen(callback: () => void): void {
    this.onOpenCallback = callback;
  }

  onMessage(callback: (message: any) => void): void {
    this.onMessageCallback = callback;
  }

  onError(callback: () => void): void {
    this.onErrorCallback = callback;
  }

  onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }
}

export interface ConnectionEvent {
  type: 'connectionStateChanged' | 'messageReceived' | 'handshakeReceived';
  deviceId: string;
  state?: ConnectionState;
  message?: P2PMessage;
}