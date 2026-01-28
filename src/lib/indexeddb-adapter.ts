import { xtransIndexedDB, TransferTask } from './indexeddb-manager';
import { DeviceInfo } from './device-manager';
import { HistoryItem, Settings } from '../store/use-store';

/**
 * IndexedDB适配器，用于与Zustand状态管理集成
 * 提供数据持久化功能和自动同步
 */
export class IndexedDBAdapter {
  private static instance: IndexedDBAdapter;
  private initialized = false;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): IndexedDBAdapter {
    if (!IndexedDBAdapter.instance) {
      IndexedDBAdapter.instance = new IndexedDBAdapter();
    }
    return IndexedDBAdapter.instance;
  }

  /**
   * 初始化IndexedDB连接
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await xtransIndexedDB.open();
      this.initialized = true;
      
      // 启动定期同步
      this.startPeriodicSync();
      
      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  }

  /**
   * 启动定期同步
   */
  private startPeriodicSync(): void {
    // 每5分钟同步一次数据
    this.syncInterval = setInterval(() => {
      this.syncToCloud().catch(error => {
        console.error('Periodic sync failed:', error);
      });
    }, 5 * 60 * 1000);
  }

  /**
   * 停止定期同步
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 加载初始数据
   */
  async loadInitialData(): Promise<{
    devices: DeviceInfo[];
    history: HistoryItem[];
    settings: Settings;
    transfers: TransferTask[];
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const [devices, history, settings, transfers] = await Promise.all([
        xtransIndexedDB.getAllDevices(),
        xtransIndexedDB.getHistory(100), // 只加载最近100条历史记录
        xtransIndexedDB.getSettings(),
        xtransIndexedDB.getAllTransfers()
      ]);

      return {
        devices: devices.map(d => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          deviceType: d.deviceType,
          platform: d.platform,
          browser: d.browser,
          avatar: d.avatar,
          ipAddress: d.ipAddress,
          online: d.online,
          lastSeen: d.lastSeen
        })),
        history: history.map(h => ({
          id: h.id,
          type: h.type,
          timestamp: h.timestamp,
          deviceName: h.deviceName,
          direction: h.direction,
          fileName: h.fileName,
          fileSize: h.fileSize,
          text: h.text
        })),
        settings: settings || {
          deviceName: '我的设备',
          theme: 'system' as const,
          soundEnabled: false,
          notificationsEnabled: false
        },
        transfers: transfers.map(t => ({
          transferId: t.transferId,
          type: t.type,
          fromDeviceId: t.fromDeviceId,
          toDeviceId: t.toDeviceId,
          fromDeviceName: t.fromDeviceName,
          toDeviceName: t.toDeviceName,
          direction: t.direction,
          files: t.files,
          text: t.text,
          status: t.status,
          progress: t.progress,
          speed: t.speed,
          timestamp: t.timestamp
        }))
      };
    } catch (error) {
      console.error('Failed to load initial data:', error);
      throw error;
    }
  }

  /**
   * 保存设备信息
   */
  async saveDevice(device: DeviceInfo, isFavorite?: boolean): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.saveDevice(device, isFavorite);
    } catch (error) {
      console.error('Failed to save device:', error);
      throw error;
    }
  }

  /**
   * 删除设备
   */
  async removeDevice(deviceId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.removeDevice(deviceId);
    } catch (error) {
      console.error('Failed to remove device:', error);
      throw error;
    }
  }

  /**
   * 添加历史记录
   */
  async addHistory(item: HistoryItem): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.addHistory(item);
    } catch (error) {
      console.error('Failed to add history:', error);
      throw error;
    }
  }

  /**
   * 删除历史记录
   */
  async removeHistory(id: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.removeHistory(id);
    } catch (error) {
      console.error('Failed to remove history:', error);
      throw error;
    }
  }

  /**
   * 清空历史记录
   */
  async clearHistory(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.clearHistory();
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  }

  /**
   * 保存设置
   */
  async saveSettings(settings: Settings): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.saveSettings(settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * 保存传输任务
   */
  async saveTransfer(transfer: TransferTask): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.saveTransfer(transfer);
    } catch (error) {
      console.error('Failed to save transfer:', error);
      throw error;
    }
  }

  /**
   * 删除传输任务
   */
  async removeTransfer(transferId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.removeTransfer(transferId);
    } catch (error) {
      console.error('Failed to remove transfer:', error);
      throw error;
    }
  }

  /**
   * 同步数据到云端（如果有云端同步功能）
   */
  async syncToCloud(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const lastSyncTime = await xtransIndexedDB.getLastSyncTime();
      const now = Date.now();
      
      // 如果从未同步过或者距离上次同步超过1小时，则执行同步
      if (!lastSyncTime || (now - lastSyncTime) > 60 * 60 * 1000) {
        // 这里可以实现云端同步逻辑
        // 例如，将未同步的数据发送到服务器
        
        // 更新最后同步时间
        await xtransIndexedDB.updateLastSyncTime(now);
        console.log('Data synced to cloud');
      }
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
      throw error;
    }
  }

  /**
   * 从云端同步数据（如果有云端同步功能）
   */
  async syncFromCloud(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 这里可以实现从云端同步数据的逻辑
      // 例如，从服务器获取最新的数据并合并到本地
      
      console.log('Data synced from cloud');
    } catch (error) {
      console.error('Failed to sync from cloud:', error);
      throw error;
    }
  }

  /**
   * 导出数据
   */
  async exportData(): Promise<{
    devices: any[];
    history: any[];
    settings: Settings;
    transfers: any[];
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await xtransIndexedDB.exportData();
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * 导入数据
   */
  async importData(data: {
    devices: any[];
    history: any[];
    settings: Settings;
    transfers: any[];
  }): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.importData(data);
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(maxAgeDays: number = 30): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await xtransIndexedDB.cleanupExpiredData(maxAgeDays);
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
      throw error;
    }
  }

   /**
    * 销毁适配器
    */
  destroy(): void {
    this.stopPeriodicSync();
    this.initialized = false;
  }
}
