import { DeviceInfo } from './device-manager';
import { HistoryItem, Settings } from '../store/use-store';

// 数据库版本和配置
const DB_NAME = 'xtrans-db';
const DB_VERSION = 1;

// 存储名称
const STORES = {
  DEVICES: 'devices',
  HISTORY: 'history',
  SETTINGS: 'settings',
  TRANSFERS: 'transfers'
} as const;

// 键名常量
const KEYS = {
  SETTINGS: 'app-settings',
  LAST_SYNC: 'last-sync'
} as const;

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
}

// 设备记录（在IndexedDB中的存储格式）
interface DeviceRecord extends DeviceInfo {
  // 添加一些本地字段
  lastSeenLocal: number; // 本地最后看到的时间
  isFavorite: boolean;   // 是否为收藏设备
}

// 历史记录（在IndexedDB中的存储格式）
interface HistoryRecord extends HistoryItem {
  // 添加一些本地字段
  syncedToCloud?: boolean; // 是否已同步到云端
}

// 传输记录（在IndexedDB中的存储格式）
interface TransferRecord extends TransferTask {
  // 添加一些本地字段
  filePath?: string; // 本地文件路径（如果是接收的文件）
  syncedToCloud?: boolean; // 是否已同步到云端
}

/**
 * XTrans专用的IndexedDB管理器
 */
export class XTransIndexedDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  /**
   * 打开数据库连接
   */
  async open(): Promise<IDBDatabase> {
    // 如果已经初始化，直接返回
    if (this.db) {
      return this.db;
    }

    // 如果正在初始化，等待完成
    if (this.initPromise) {
      return this.initPromise;
    }

    // 开始初始化
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建设备存储
        if (!db.objectStoreNames.contains(STORES.DEVICES)) {
          const deviceStore = db.createObjectStore(STORES.DEVICES, { keyPath: 'deviceId' });
          deviceStore.createIndex('deviceName', 'deviceName', { unique: false });
          deviceStore.createIndex('lastSeenLocal', 'lastSeenLocal', { unique: false });
          deviceStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        }

        // 创建历史记录存储
        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          const historyStore = db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
          historyStore.createIndex('deviceName', 'deviceName', { unique: false });
          historyStore.createIndex('type', 'type', { unique: false });
        }

        // 创建设置存储
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        // 创建传输任务存储
        if (!db.objectStoreNames.contains(STORES.TRANSFERS)) {
          const transferStore = db.createObjectStore(STORES.TRANSFERS, { keyPath: 'transferId' });
          transferStore.createIndex('timestamp', 'timestamp', { unique: false });
          transferStore.createIndex('status', 'status', { unique: false });
          transferStore.createIndex('fromDeviceId', 'fromDeviceId', { unique: false });
          transferStore.createIndex('toDeviceId', 'toDeviceId', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * 获取事务对象
   */
  private async getTransaction(
    storeNames: string | string[],
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBTransaction> {
    if (!this.db) {
      await this.open();
    }
    return this.db!.transaction(storeNames, mode);
  }

  /**
   * 设备管理
   */

  // 保存设备
  async saveDevice(device: DeviceInfo, isFavorite: boolean = false): Promise<void> {
    const tx = await this.getTransaction(STORES.DEVICES, 'readwrite');
    const store = tx.objectStore(STORES.DEVICES);
    
    const deviceRecord: DeviceRecord = {
      ...device,
      lastSeenLocal: Date.now(),
      isFavorite
    };

    return new Promise((resolve, reject) => {
      const request = store.put(deviceRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取单个设备
  async getDevice(deviceId: string): Promise<DeviceRecord | null> {
    const tx = await this.getTransaction(STORES.DEVICES, 'readonly');
    const store = tx.objectStore(STORES.DEVICES);
    
    return new Promise((resolve, reject) => {
      const request = store.get(deviceId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // 获取所有设备
  async getAllDevices(): Promise<DeviceRecord[]> {
    const tx = await this.getTransaction(STORES.DEVICES, 'readonly');
    const store = tx.objectStore(STORES.DEVICES);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除设备
  async removeDevice(deviceId: string): Promise<void> {
    const tx = await this.getTransaction(STORES.DEVICES, 'readwrite');
    const store = tx.objectStore(STORES.DEVICES);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(deviceId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 清空设备列表
  async clearDevices(): Promise<void> {
    const tx = await this.getTransaction(STORES.DEVICES, 'readwrite');
    const store = tx.objectStore(STORES.DEVICES);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 更新设备收藏状态
  async updateDeviceFavorite(deviceId: string, isFavorite: boolean): Promise<void> {
    const device = await this.getDevice(deviceId);
    if (device) {
      device.isFavorite = isFavorite;
      await this.saveDevice(device, isFavorite);
    }
  }

  /**
   * 历史记录管理
   */

  // 添加历史记录
  async addHistory(item: HistoryItem): Promise<void> {
    const tx = await this.getTransaction(STORES.HISTORY, 'readwrite');
    const store = tx.objectStore(STORES.HISTORY);
    
    const historyRecord: HistoryRecord = {
      ...item,
      syncedToCloud: false
    };

    return new Promise((resolve, reject) => {
      const request = store.add(historyRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取历史记录
  async getHistory(limit?: number): Promise<HistoryRecord[]> {
    const tx = await this.getTransaction(STORES.HISTORY, 'readonly');
    const store = tx.objectStore(STORES.HISTORY);
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      let request: IDBRequest;
      
      if (limit) {
        request = index.getAll();
        request.onsuccess = () => {
          const results = request.result || [];
          // 按时间戳降序排序并限制数量
          resolve(results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit));
        };
      } else {
        request = index.getAll();
        request.onsuccess = () => {
          const results = request.result || [];
          // 按时间戳降序排序
          resolve(results.sort((a, b) => b.timestamp - a.timestamp));
        };
      }
      
      request.onerror = () => reject(request.error);
    });
  }

  // 删除历史记录
  async removeHistory(id: string): Promise<void> {
    const tx = await this.getTransaction(STORES.HISTORY, 'readwrite');
    const store = tx.objectStore(STORES.HISTORY);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 清空历史记录
  async clearHistory(): Promise<void> {
    const tx = await this.getTransaction(STORES.HISTORY, 'readwrite');
    const store = tx.objectStore(STORES.HISTORY);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 设置管理
  async saveSettings(settings: Settings): Promise<void> {
    const tx = await this.getTransaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key: KEYS.SETTINGS, ...settings });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取设置
  async getSettings(): Promise<Settings | null> {
    const tx = await this.getTransaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);
    
    return new Promise((resolve, reject) => {
      const request = store.get(KEYS.SETTINGS);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // 传输任务管理
  async saveTransfer(transfer: TransferTask): Promise<void> {
    const tx = await this.getTransaction(STORES.TRANSFERS, 'readwrite');
    const store = tx.objectStore(STORES.TRANSFERS);
    
    return new Promise((resolve, reject) => {
      const request = store.put(transfer);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取所有传输任务
  async getAllTransfers(): Promise<TransferRecord[]> {
    const tx = await this.getTransaction(STORES.TRANSFERS, 'readonly');
    const store = tx.objectStore(STORES.TRANSFERS);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除传输任务
  async removeTransfer(transferId: string): Promise<void> {
    const tx = await this.getTransaction(STORES.TRANSFERS, 'readwrite');
    const store = tx.objectStore(STORES.TRANSFERS);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(transferId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 清空传输任务
  async clearTransfers(): Promise<void> {
    const tx = await this.getTransaction(STORES.TRANSFERS, 'readwrite');
    const store = tx.objectStore(STORES.TRANSFERS);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 数据导出
  async exportData(): Promise<{
    devices: any[];
    history: any[];
    settings: Settings | null;
    transfers: any[];
  }> {
    const [devices, history, settings, transfers] = await Promise.all([
      this.getAllDevices(),
      this.getHistory(),
      this.getSettings(),
      this.getAllTransfers()
    ]);

    return {
      devices,
      history,
      settings,
      transfers
    };
  }

  // 数据导入
  async importData(data: {
    devices: any[];
    history: any[];
    settings: Settings;
    transfers: any[];
  }): Promise<void> {
    // 清空现有数据
    await Promise.all([
      this.clearDevices(),
      this.clearHistory(),
      this.clearTransfers()
    ]);

    // 导入新数据
    if (data.settings) {
      await this.saveSettings(data.settings);
    }

    for (const device of data.devices) {
      await this.saveDevice(device, device.isFavorite || false);
    }

    for (const item of data.history) {
      await this.addHistory(item);
    }

    for (const transfer of data.transfers) {
      await this.saveTransfer(transfer);
    }
  }

  // 获取最后同步时间
  async getLastSyncTime(): Promise<number | null> {
    const tx = await this.getTransaction(STORES.SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.SETTINGS);
    
    return new Promise((resolve, reject) => {
      const request = store.get(KEYS.LAST_SYNC);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // 更新最后同步时间
  async updateLastSyncTime(timestamp: number): Promise<void> {
    const tx = await this.getTransaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key: KEYS.LAST_SYNC, value: timestamp });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 清理过期数据
  async cleanupExpiredData(maxAgeDays: number = 30): Promise<void> {
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 清理过期的历史记录
    const history = await this.getHistory();
    for (const item of history) {
      if (now - item.timestamp > maxAge) {
        await this.removeHistory(item.id);
      }
    }

    // 清理过期的传输任务
    const transfers = await this.getAllTransfers();
    for (const transfer of transfers) {
      if (now - transfer.timestamp > maxAge) {
        await this.removeTransfer(transfer.transferId);
      }
    }
  }

  // 关闭数据库连接
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initPromise = null;
  }
}

// 导出单例实例
export const xtransIndexedDB = new XTransIndexedDB();
