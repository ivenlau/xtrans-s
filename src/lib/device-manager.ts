// 设备信息
export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  platform: string;
  browser: string;
  avatar?: string;
  ipAddress: string;
  online: boolean;
  lastSeen: number;
}

// 事件类型
export type DeviceEvent =
  | { type: 'devices_updated'; devices: DeviceInfo[] }
  | { type: 'device_joined'; device: DeviceInfo }
  | { type: 'device_left'; deviceId: string }
  | { type: 'device_name_updated'; deviceId: string; deviceName: string }
  | { type: 'offer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice_candidate'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'transfer_request'; from: string; files: any[]; transferId: string }
  | { type: 'transfer_response'; transferId: string; accepted: boolean }
  | { type: 'text_message'; from: string; message: any };
