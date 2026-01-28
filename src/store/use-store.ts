import { create } from 'zustand';
import { DeviceInfo } from '../lib/device-manager';
import { P2PConnection } from '../lib/webrtc';
import { getDefaultDeviceName } from '../lib/device-detector';

// 传输任务状态
export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';

// 文件信息
export interface FileInfo {
  name: string;
  size: number;
  type: string;
  file?: File;
}

// 传输任务
export interface TransferTask {
  transferId: string;
  type: 'file' | 'text';
  fromDeviceId: string;
  toDeviceId: string;
  fromDeviceName: string;
  toDeviceName: string;
  direction: 'sent' | 'received';
  files?: FileInfo[];
  text?: string;
  status: TransferStatus;
  progress: number;
  speed: number;
  timestamp: number;
  connection?: P2PConnection;
}

// 历史记录
export interface HistoryItem {
  id: string;
  type: 'file' | 'text';
  timestamp: number;
  deviceName: string;
  direction: 'sent' | 'received';
  fileName?: string;
  fileSize?: number;
  text?: string;
}

// 设置
export interface Settings {
  deviceName: string;
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

interface StoreState {
  // 设备
  myDevice: DeviceInfo | null;
  devices: DeviceInfo[];
  isConnected: boolean;

  // 传输任务
  transfers: TransferTask[];

  // 历史记录
  history: HistoryItem[];

  // 设置
  settings: Settings;

  // UI 状态
  selectedDevice: DeviceInfo | null;

  // Actions
  setMyDevice: (device: DeviceInfo | null) => void;
  setDevices: (devices: DeviceInfo[]) => void;
  addDevice: (device: DeviceInfo) => void;
  removeDevice: (deviceId: string) => void;
  setIsConnected: (connected: boolean) => void;

  // 传输任务操作
  addTransfer: (transfer: TransferTask) => void;
  updateTransfer: (transferId: string, updates: Partial<TransferTask>) => void;
  removeTransfer: (transferId: string) => void;

  // 历史记录操作
  addHistory: (item: HistoryItem) => void;
  deleteHistory: (id: string) => void;
  clearHistory: () => void;

  // 设置操作
  updateSettings: (settings: Partial<Settings>) => void;

  // UI 操作
  setSelectedDevice: (device: DeviceInfo | null) => void;

  // 查找设备
  getDeviceById: (deviceId: string) => DeviceInfo | undefined;
}

export const useStore = create<StoreState>((set) => ({
  // 初始状态
  myDevice: null,
  devices: [],
  isConnected: false,
  transfers: [],
  history: [],
  settings: {
    deviceName: getDefaultDeviceName(),
    theme: 'system',
    soundEnabled: false,
    notificationsEnabled: false,
  },
  selectedDevice: null,

  // 设备操作
  setMyDevice: (device) => set({ myDevice: device }),
  setDevices: (devices) => set({ devices }),
  addDevice: (device) =>
    set((state) => ({
      devices: [...state.devices.filter((d) => d.deviceId !== device.deviceId), device],
    })),
  removeDevice: (deviceId) =>
    set((state) => ({
      devices: state.devices.filter((d) => d.deviceId !== deviceId),
    })),
  setIsConnected: (connected) => set({ isConnected: connected }),

  // 传输任务操作
  addTransfer: (transfer) =>
    set((state) => ({
      transfers: [...state.transfers, transfer],
    })),
  updateTransfer: (transferId, updates) =>
    set((state) => ({
      transfers: state.transfers.map((t) =>
        t.transferId === transferId ? { ...t, ...updates } : t
      ),
    })),
  removeTransfer: (transferId) =>
    set((state) => ({
      transfers: state.transfers.filter((t) => t.transferId !== transferId),
    })),

  // 历史记录操作
  addHistory: (item) =>
    set((state) => {
      const newHistory = [item, ...state.history];
      // 只保留最近 100 条
      if (newHistory.length > 100) {
        newHistory.pop();
      }
      return { history: newHistory };
    }),
  deleteHistory: (id) =>
    set((state) => ({
      history: state.history.filter((h) => h.id !== id),
    })),
  clearHistory: () => set({ history: [] }),

  // 设置操作
  updateSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),

  // UI 操作
  setSelectedDevice: (device) => set({ selectedDevice: device }),

  // 查找设备
  getDeviceById: (deviceId) => {
    const state = useStore.getState();
    return state.devices.find((d) => d.deviceId === deviceId);
  },
}));
