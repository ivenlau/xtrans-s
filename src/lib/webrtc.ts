// WebRTC 配置
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Google STUN
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // 其他公共 STUN
    { urls: 'stun:stun.miwifi.com' },
    { urls: 'stun:stun.qq.com' },
    { urls: 'stun:stun.chat.bilibili.com' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
  ],
};

// 文件分片大小 (16KB)
export const CHUNK_SIZE = 16 * 1024;

// 数据包协议
const PACKET_MAGIC = 0x4244544C; // Magic Number "BDTL" (Binary Data Transfer Link) - 4 bytes
const HEADER_SIZE = 44; // Magic(4) + fileId(36) + chunkIndex(4)

// 创建数据包头部
function createPacketHeader(fileId: string, chunkIndex: number): Uint8Array {
  const header = new ArrayBuffer(HEADER_SIZE);
  const view = new DataView(header);

  // Magic Number (4 bytes)
  view.setUint32(0, PACKET_MAGIC, false); // big-endian

  // fileId (36 bytes) - UUID 字符串
  const fileIdBytes = new TextEncoder().encode(fileId.padEnd(36, '\0'));
  const headerArray = new Uint8Array(header);
  headerArray.set(fileIdBytes, 4);

  // chunkIndex (4 bytes)
  view.setUint32(40, chunkIndex, false); // big-endian

  return headerArray;
}

// 解析数据包头部
function parsePacketHeader(data: Uint8Array): { fileId: string; chunkIndex: number } | null {
  if (data.byteLength < HEADER_SIZE) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, HEADER_SIZE);

  // 验证 Magic Number
  const magic = view.getUint32(0, false); // big-endian
  if (magic !== PACKET_MAGIC) {
    return null;
  }

  // 提取 fileId (36 bytes)
  const fileIdBytes = data.slice(4, 40);
  const fileId = new TextDecoder().decode(fileIdBytes).replace(/\0+$/, ''); // 移除填充的 null

  // 提取 chunkIndex (4 bytes)
  const chunkIndex = view.getUint32(40, false); // big-endian

  return { fileId, chunkIndex };
}

// 消息类型
export enum MessageType {
  Metadata = 'metadata',
  Chunk = 'chunk',
  End = 'end',
  Text = 'text',
  Ack = 'ack',
  FileAccept = 'file_accept',
  FileReject = 'file_reject',
  FileCancel = 'file_cancel',
}

// 文件元数据
export interface FileMetadata {
  type: MessageType.Metadata;
  fileId: string;
  name: string;
  size: number;
  fileType: string;
  chunks: number;
}

// 文件分片
export interface FileChunk {
  type: MessageType.Chunk;
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
}

// 文件传输结束
export interface FileEnd {
  type: MessageType.End;
  fileId: string;
}

// 文字消息
export interface TextMessage {
  type: MessageType.Text;
  messageId: string;
  content: string;
  timestamp: number;
}

// 确认消息
export interface AckMessage {
  type: MessageType.Ack;
  messageId: string;
}

// 文件接受消息
export interface FileAcceptMessage {
  type: MessageType.FileAccept;
  fileId: string;
}

// 文件拒绝消息
export interface FileRejectMessage {
  type: MessageType.FileReject;
  fileId: string;
}

// 文件取消消息
export interface FileCancelMessage {
  type: MessageType.FileCancel;
  fileId: string;
}

export type DataMessage =
  | FileMetadata
  | FileChunk
  | FileEnd
  | TextMessage
  | AckMessage
  | FileAcceptMessage
  | FileRejectMessage
  | FileCancelMessage;

// 传输进度回调
export type TransferProgress = (
  transferred: number,
  total: number,
  speed: number
) => void;

// 传输状态回调
export type TransferStatus = (
  status: 'connecting' | 'connected' | 'transferring' | 'completed' | 'failed'
) => void;

// 接收消息回调
export type ReceiveMessage = (message: DataMessage) => void;

export class P2PConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private remoteCandidates: RTCIceCandidateInit[] = [];
  private isConnected = false;
  private readonly deviceId: string;
  private readonly remoteDeviceId: string;

  // 回调函数
  private messageListeners: Set<ReceiveMessage> = new Set();
  private onStatusCallback?: TransferStatus;
  private onIceCandidateCallback?: (candidate: RTCIceCandidateInit) => void;

  constructor(
    localDeviceId: string,
    remoteDeviceId: string,
    isInitiator: boolean
  ) {
    this.deviceId = localDeviceId;
    this.remoteDeviceId = remoteDeviceId;

    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    this.setupPeerConnection();

    // 如果是发起方，创建数据通道
    if (isInitiator) {
      this.createDataChannel();
    } else {
      // 接收方，等待对方创建数据通道
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  private setupPeerConnection() {
    if (!this.peerConnection) return;

    // 监听 ICE 候选
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidateCallback?.(event.candidate.toJSON());
      }
    };

    // 监听连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      switch (this.peerConnection?.connectionState) {
        case 'connected':
          // 注意：不在这里触发 connected，等待 dataChannel.onopen
          break;
        case 'disconnected':
        case 'failed':
          this.isConnected = false;
          this.onStatusCallback?.('failed');
          break;
        case 'connecting':
          this.onStatusCallback?.('connecting');
          break;
      }
    };

    // 监听 ICE 连接状态
    this.peerConnection.oniceconnectionstatechange = () => {
    };
  }

  private createDataChannel() {
    if (!this.peerConnection) return;

    this.dataChannel = this.peerConnection.createDataChannel('file-transfer', {
      ordered: true,
      protocol: 'xtrans-v1',
    });

    this.setupDataChannel();
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.isConnected = true;
      this.onStatusCallback?.('connected');
    };

    this.dataChannel.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.dataChannel.onerror = (error) => {
      this.isConnected = false;
      this.onStatusCallback?.('failed');
    };

    this.dataChannel.onclose = () => {
      this.isConnected = false;
      this.onStatusCallback?.('failed');
    };
  }

  private handleMessage(data: ArrayBuffer | string) {
    try {
      console.log('P2PConnection received data:', typeof data, typeof data === 'string' ? data.substring(0, 100) : 'binary');
      let message: DataMessage;

      // 如果是字符串，尝试解析为 JSON
      if (typeof data === 'string') {
        try {
          message = JSON.parse(data);
          console.log('Parsed message type:', message.type);
        } catch (e) {
          console.error('Failed to parse JSON message:', e);
          return;
        }
      } else {
        // 二进制数据 - 尝试解析协议头部
        const uint8Array = new Uint8Array(data);
        const headerInfo = parsePacketHeader(uint8Array);

        if (headerInfo) {
          // 成功解析协议头部
          const chunkData = uint8Array.slice(HEADER_SIZE);
          message = {
            type: MessageType.Chunk,
            fileId: headerInfo.fileId,
            chunkIndex: headerInfo.chunkIndex,
            data: chunkData.buffer,
          };
        } else {
          // 无法解析头部，可能是旧格式或其他数据
          message = {
            type: MessageType.Chunk,
            fileId: '',
            chunkIndex: 0,
            data,
          };
        }
      }

      console.log(`Dispatching message to ${this.messageListeners.size} listeners`);

      // 通知所有监听器
      this.messageListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (error) {
          console.error('Error in message listener:', error);
        }
      });
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  // 创建 Offer
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return offer;
  }

  // 创建离线 Offer (等待 ICE 收集完成)
  async createOfflineOffer(): Promise<string> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // 等待 ICE 收集完成
    await this.waitForIceGathering();

    if (!this.peerConnection.localDescription) {
      throw new Error('Failed to generate local description');
    }

    return JSON.stringify(this.peerConnection.localDescription);
  }

  // 创建 Answer
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer;
  }

  // 创建离线 Answer (等待 ICE 收集完成)
  async createOfflineAnswer(offerSdp: string): Promise<string> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const offerDesc = JSON.parse(offerSdp);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerDesc));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // 等待 ICE 收集完成
    await this.waitForIceGathering();

    if (!this.peerConnection.localDescription) {
      throw new Error('Failed to generate local description');
    }

    return JSON.stringify(this.peerConnection.localDescription);
  }

  // 处理离线 Answer
  async handleOfflineAnswer(answerSdp: string): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    const answerDesc = JSON.parse(answerSdp);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerDesc));
  }

  // 等待 ICE 收集完成
  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.peerConnection || this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (this.peerConnection && this.peerConnection.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      this.peerConnection!.addEventListener('icegatheringstatechange', checkState);

      // 设置超时，防止无限等待
      setTimeout(() => {
        if (this.peerConnection) {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
        }
        resolve();
      }, 2000); // 2秒超时通常足够收集局域网 candidates
    });
  }

  // 设置远程描述
  async setRemoteDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerConnection) throw new Error('Peer connection not initialized');

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(description)
    );

    // 添加待处理的 ICE 候选
    if (this.peerConnection.remoteDescription) {
      for (const candidate of this.remoteCandidates) {
        await this.addIceCandidate(candidate);
      }
      this.remoteCandidates = [];
    }
  }

  // 添加 ICE 候选
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    // 如果远程描述还未设置，保存候选
    if (!this.peerConnection.remoteDescription) {
      this.remoteCandidates.push(candidate);
      return;
    }

    await this.peerConnection.addIceCandidate(
      new RTCIceCandidate(candidate)
    );
  }

  // 发送文件
  async sendFile(
    file: File,
    onProgress?: TransferProgress
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Data channel not connected');
    }

    const fileId = Math.random().toString(36).substring(7);
    const fileSize = file.size;
    const chunkSize = CHUNK_SIZE;
    const chunks = Math.ceil(fileSize / chunkSize);

    // 检查连接状态的函数
    const checkConnection = () => {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        throw new Error(`Data channel not ready (state: ${this.dataChannel?.readyState})`);
      }
      if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
        throw new Error(`Peer connection not ready (state: ${this.peerConnection?.connectionState})`);
      }
    };

    // 发送文件元数据
    const metadata: FileMetadata = {
      type: MessageType.Metadata,
      fileId,
      name: file.name,
      size: file.size,
      fileType: file.type,
      chunks,
    };

  
    try {
      checkConnection();
      this.dataChannel.send(JSON.stringify(metadata));
    } catch (error) {
      throw new Error(`发送元数据失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 等待接收方确认
    let acceptListener: (() => void) | null = null;
    const acceptPromise = new Promise<{ accepted: boolean }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (acceptListener) acceptListener();

        // 发送取消消息给接收端
        try {
          const cancelMessage: FileCancelMessage = {
            type: MessageType.FileCancel,
            fileId,
          };
          this.dataChannel!.send(JSON.stringify(cancelMessage));
        } catch (sendError) {

        }

        reject(new Error('等待接收方确认超时（60秒）'));
      }, 60000); // 60秒超时

      acceptListener = this.onMessage((message: DataMessage) => {
        if (message.type === MessageType.FileAccept && message.fileId === fileId) {
          clearTimeout(timeout);
          resolve({ accepted: true });
        } else if (message.type === MessageType.FileReject && message.fileId === fileId) {
          clearTimeout(timeout);
          resolve({ accepted: false });
        }
      });
    });

    let accepted: boolean;
    try {
      const result = await acceptPromise;
      accepted = result.accepted;
    } catch (error) {
      throw error;
    }

    if (!accepted) {
      throw new Error(`${file.name} 被接收方拒绝`);
    }

    // 再次检查连接状态
    checkConnection();

    // 分片发送文件内容
    let offset = 0;
    let chunkIndex = 0;
    const startTime = Date.now();

    try {
      while (offset < fileSize) {
        // 每次发送前检查连接状态
        checkConnection();

        const chunk = file.slice(offset, offset + chunkSize);
        const arrayBuffer = await chunk.arrayBuffer();

        // 创建协议头部
        const header = createPacketHeader(fileId, chunkIndex);

        // 合并头部和数据
        const packet = new Uint8Array(HEADER_SIZE + arrayBuffer.byteLength);
        packet.set(header, 0);
        packet.set(new Uint8Array(arrayBuffer), HEADER_SIZE);

        // 等待发送队列有空间（backpressure）
        const MAX_BUFFER_SIZE = 16 * 1024 * 1024; // 16MB
        while (this.dataChannel!.bufferedAmount > MAX_BUFFER_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        try {
          // 发送完整的数据包
          this.dataChannel.send(packet.buffer);
        } catch (sendError: any) {
          // 检查错误类型
          if (sendError.name === 'InvalidStateError') {
            throw new Error(`连接已断开，无法发送数据 (DataChannel状态: ${this.dataChannel?.readyState})`);
          }

          throw sendError;
        }

        offset += chunkSize;
        chunkIndex++;

        // 计算进度
        if (onProgress) {
          const transferred = offset;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = elapsed > 0 ? transferred / elapsed : 0;
          onProgress(transferred, fileSize, speed);
        }

        // 根据缓冲区大小动态调整延迟
        const bufferSize = this.dataChannel!.bufferedAmount;
        const delay = bufferSize > 1024 * 1024 ? 10 : 0; // 缓冲区>1MB时延迟10ms
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // 发送结束标记
      checkConnection();
      const endMessage: FileEnd = {
        type: MessageType.End,
        fileId,
      };

      this.dataChannel.send(JSON.stringify(endMessage));

      return fileId;
    } catch (error) {
      throw error;
    }
  }

  // 接收文件
  receiveFile(
    fileId: string,
    onProgress?: TransferProgress,
    initialMetadata?: FileMetadata
  ): Promise<{ file: File; metadata: FileMetadata }> {
    return new Promise((resolve, reject) => {
      let metadata: FileMetadata | null = initialMetadata || null;
      let chunks: ArrayBuffer[] = [];
      let receivedSize = 0;
      const startTime = Date.now();

      const listener = (message: DataMessage) => {
        // 对于 Metadata 和 End，检查 fileId
        // 对于 Chunk，也要检查 fileId（支持多文件并发）
        if (message.type === MessageType.Chunk && message.fileId !== fileId) {
          return; // 不是这个文件的 chunk，忽略
        }
        if (message.type === MessageType.Metadata && message.fileId !== fileId) {
          return; // 不是这个文件的 metadata，忽略
        }
        if (message.type === MessageType.End && message.fileId !== fileId) {
          return; // 不是这个文件的 end，忽略
        }

        switch (message.type) {
          case MessageType.Metadata:
            if (message.fileId === fileId) {
              metadata = message;
              chunks = [];
              receivedSize = 0;
            }
            break;

          case MessageType.Chunk:
            if (metadata && message.fileId === fileId) {
              chunks.push(message.data);
              receivedSize += message.data.byteLength;

              // 更新进度
              if (onProgress) {
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = elapsed > 0 ? receivedSize / elapsed : 0;
                onProgress(receivedSize, metadata.size, speed);
              }
            } else if (message.fileId === fileId) {
            }
            break;

          case MessageType.End:
            if (metadata && message.fileId === fileId) {
              // 组装文件
              const blob = new Blob(chunks, { type: metadata.fileType });
              const file = new File([blob], metadata.name, {
                type: metadata.fileType,
              });

  
              // 移除监听器
              this.messageListeners.delete(listener);
              resolve({ file, metadata });
            }
            break;
        }
      };

      // 添加监听器
      this.messageListeners.add(listener);

      // 超时处理
      setTimeout(() => {
        this.messageListeners.delete(listener);
        reject(new Error('File transfer timeout'));
      }, 300000); // 5 分钟超时
    });
  }

  // 发送文字
  sendText(content: string): string {
    if (!this.isReady()) {
      throw new Error('Data channel not connected');
    }

    try {
      const messageId = Math.random().toString(36).substring(7);
      const message: TextMessage = {
        type: MessageType.Text,
        messageId,
        content: content,
        timestamp: Date.now(),
      };

      this.dataChannel.send(JSON.stringify(message));

      return messageId;
    } catch (error: any) {
      if (error.name === 'InvalidStateError') {
        throw new Error(`连接已断开 (DataChannel状态: ${this.dataChannel?.readyState})`);
      }
      throw error;
    }
  }

  // 发送自定义消息 (如握手)
  sendCustomMessage(message: any) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not connected');
    }
    try {
      this.dataChannel.send(JSON.stringify(message));
    } catch (error: any) {
      if (error.name === 'InvalidStateError') {
        throw new Error(`连接已断开 (DataChannel状态: ${this.dataChannel?.readyState})`);
      }
      throw error;
    }
  }

  // 发送消息（通用方法）
  sendMessage(message: DataMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not connected');
    }

    try {
      this.dataChannel.send(JSON.stringify(message));
    } catch (error: any) {
      if (error.name === 'InvalidStateError') {
        throw new Error(`连接已断开 (DataChannel状态: ${this.dataChannel?.readyState})`);
      }
      throw error;
    }
  }

  // 设置回调函数
  onMessage(callback: ReceiveMessage) {
    this.messageListeners.add(callback);
    // 返回一个取消订阅的函数
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  onStatus(callback: TransferStatus) {
    this.onStatusCallback = callback;
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit) => void) {
    this.onIceCandidateCallback = callback;
  }

  // 关闭连接
  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isConnected = false;
  }

  // 检查连接状态
  getConnectionState(): string {
    return this.peerConnection?.connectionState || 'closed';
  }

  isReady(): boolean {
    const ready = this.isConnected &&
      this.dataChannel?.readyState === 'open' &&
      this.peerConnection?.connectionState === 'connected';

    if (!ready && this.isConnected) {
    }

    return ready;
  }

  // 获取详细状态信息
  getStatusDetails(): string {
    if (!this.peerConnection) return 'No peer connection';
    if (!this.dataChannel) return 'No data channel';

    return `PC: ${this.peerConnection.connectionState}, ` +
           `DC: ${this.dataChannel.readyState}, ` +
           `ICE: ${this.peerConnection.iceConnectionState}, ` +
           `Connected: ${this.isConnected}`;
  }
}
