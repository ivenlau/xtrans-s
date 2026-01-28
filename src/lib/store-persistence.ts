import { indexedDBAdapter } from './indexeddb-adapter';
import { IndexedDBUtils, PerformanceMonitor, ErrorHandler } from './indexeddb-utils';
import { DeviceInfo } from './device-manager';
import { HistoryItem, Settings, TransferTask } from '../store/use-store';
import { create, StateCreator } from 'zustand';

/**
 * 创建带有持久化功能的Zustand store
 */
export function createPersistentStore<T>(
  name: string,
  stateCreator: StateCreator<T>,
  options: {
    persist?: boolean;
    syncToCloud?: boolean;
    performanceTracking?: boolean;
  } = {}
) {
  const { persist = true, syncToCloud = false, performanceTracking = false } = options;
  
  return create<T>((set, get, api) => {
    // 包装原始状态创建器
    const wrappedSet = async (args: any) => {
      try {
        // 应用状态更新
        set(args);
        
        // 如果启用了持久化，保存到IndexedDB
        if (persist) {
          const state = get();
          await saveStateToIndexedDB(name, state);
        }
        
        // 如果启用了云同步，同步到云端
        if (syncToCloud) {
          await indexedDBAdapter.syncToCloud();
        }
      } catch (error) {
        ErrorHandler.logError(`Failed to persist state for ${name}`, error as Error);
      }
    };
    
    // 如果启用了性能跟踪，包装api方法
    const wrappedApi = performanceTracking
      ? wrapApiWithPerformanceTracking(api, name)
      : api;
    
    // 调用原始状态创建器，使用包装后的set和api
    const initialState = stateCreator(wrappedSet, get, wrappedApi);
    
    // 返回初始状态
    return initialState;
  });
}

/**
 * 保存状态到IndexedDB
 */
async function saveStateToIndexedDB(name: string, state: any): Promise<void> {
  const operation = async () => {
    switch (name) {
      case 'devices':
        if (state.devices) {
          // 保存设备列表
          await IndexedDBUtils.batchOperations(
            state.devices,
            (device: DeviceInfo) => indexedDBAdapter.saveDevice(device)
          );
        }
        break;
        
      case 'history':
        if (state.history) {
          // 保存历史记录
          await IndexedDBUtils.batchOperations(
            state.history,
            (item: HistoryItem) => indexedDBAdapter.addHistory(item)
          );
        }
        break;
        
      case 'settings':
        if (state.settings) {
          // 保存设置
          await indexedDBAdapter.saveSettings(state.settings);
        }
        break;
        
      case 'transfers':
        if (state.transfers) {
          // 保存传输任务
          await IndexedDBUtils.batchOperations(
            state.transfers,
            (transfer: TransferTask) => indexedDBAdapter.saveTransfer(transfer)
          );
        }
        break;
        
      default:
        // 对于其他状态，保存到设置中
        await indexedDBAdapter.saveSettings({ [name]: state });
    }
  };
  
  // 使用重试机制执行操作
  await IndexedDBUtils.executeWithRetry(operation, 3, 100);
}

/**
 * 从IndexedDB加载状态
 */
export async function loadStateFromIndexedDB(name: string): Promise<any> {
  try {
    switch (name) {
      case 'devices':
        const deviceData = await indexedDBAdapter.loadInitialData();
        return { devices: deviceData.devices };
        
      case 'history':
        const historyData = await indexedDBAdapter.loadInitialData();
        return { history: historyData.history };
        
      case 'settings':
        const settingsData = await indexedDBAdapter.loadInitialData();
        return { settings: settingsData.settings };
        
      case 'transfers':
        const transferData = await indexedDBAdapter.loadInitialData();
        return { transfers: transferData.transfers };
        
      default:
        // 对于其他状态，从设置中获取
        const data = await indexedDBAdapter.loadInitialData();
        return data.settings[name] || {};
    }
  } catch (error) {
    ErrorHandler.logError(`Failed to load state for ${name}`, error as Error);
    return null;
  }
}

/**
 * 包装API方法以添加性能跟踪
 */
function wrapApiWithPerformanceTracking(api: any, storeName: string): any {
  const wrappedApi: any = {};
  
  for (const key in api) {
    if (typeof api[key] === 'function') {
      wrappedApi[key] = async (...args: any[]) => {
        const methodName = `${storeName}.${key}`;
        return PerformanceMonitor.measure(methodName, () => api[key](...args));
      };
    } else {
      wrappedApi[key] = api[key];
    }
  }
  
  return wrappedApi;
}

/**
 * 为现有store添加持久化功能
 */
export function addPersistenceToStore<T>(
  store: any,
  name: string,
  options: {
    persist?: boolean;
    syncToCloud?: boolean;
    performanceTracking?: boolean;
  } = {}
): void {
  const { persist = true, syncToCloud = false, performanceTracking = false } = options;
  
  // 获取原始状态
  const originalState = store.getState();
  
  // 包装setState方法
  const originalSetState = store.setState;
  store.setState = async (args: any) => {
    try {
      // 应用状态更新
      originalSetState(args);
      
      // 如果启用了持久化，保存到IndexedDB
      if (persist) {
        const state = store.getState();
        await saveStateToIndexedDB(name, state);
      }
      
      // 如果启用了云同步，同步到云端
      if (syncToCloud) {
        await indexedDBAdapter.syncToCloud();
      }
    } catch (error) {
      ErrorHandler.logError(`Failed to persist state for ${name}`, error as Error);
    }
  };
  
  // 如果启用了性能跟踪，包装API方法
  if (performanceTracking) {
    for (const key in store) {
      if (typeof store[key] === 'function' && key !== 'setState') {
        const originalFn = store[key];
        store[key] = async (...args: any[]) => {
          const methodName = `${name}.${key}`;
          return PerformanceMonitor.measure(methodName, () => originalFn(...args));
        };
      }
    }
  }
}

/**
 * 创建数据同步工具
 */
export class DataSynchronizer {
  private static instance: DataSynchronizer;
  private syncInProgress = false;
  private lastSyncTime = 0;
  private syncInterval: NodeJS.Timeout | null = null;
  
  private constructor() {}
  
  static getInstance(): DataSynchronizer {
    if (!DataSynchronizer.instance) {
      DataSynchronizer.instance = new DataSynchronizer();
    }
    return DataSynchronizer.instance;
  }
  
  /**
   * 启动定期同步
   */
  startPeriodicSync(intervalMs: number = 5 * 60 * 1000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      this.sync().catch(error => {
        ErrorHandler.logError('Periodic sync failed', error as Error);
      });
    }, intervalMs);
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
   * 执行同步
   */
  async sync(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      // 检查距离上次同步的时间
      const now = Date.now();
      const minSyncInterval = 30 * 1000; // 30秒最小同步间隔
      
      if (now - this.lastSyncTime < minSyncInterval) {
        return;
      }
      
      // 执行同步逻辑
      await indexedDBAdapter.syncToCloud();
      await indexedDBAdapter.syncFromCloud();
      
      // 更新最后同步时间
      this.lastSyncTime = now;
      
      console.log('Data synchronized successfully');
    } catch (error) {
      ErrorHandler.logError('Sync failed', error as Error);
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * 强制同步
   */
  async forceSync(): Promise<void> {
    this.lastSyncTime = 0;
    await this.sync();
  }
}

// 导出数据同步器实例
export const dataSynchronizer = DataSynchronizer.getInstance();

/**
 * 持久化中间件
 */
export const persistenceMiddleware = (config: any) => (set: any, get: any, api: any) => {
  // 初始化IndexedDB
  indexedDBAdapter.initialize().catch(error => {
    ErrorHandler.logError('Failed to initialize IndexedDB', error);
  });
  
  // 从IndexedDB加载初始数据
  indexedDBAdapter.loadInitialData().then(data => {
    if (data) {
      set(data);
    }
  }).catch(error => {
    ErrorHandler.logError('Failed to load initial data', error);
  });
  
  return config(
    (args: any) => {
      // 应用状态更新
      set(args);
      
      // 异步保存到IndexedDB
      const state = get();
      IndexedDBUtils.exe
