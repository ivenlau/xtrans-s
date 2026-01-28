import { xtransIndexedDB } from './indexeddb-manager';

/**
 * IndexedDB性能优化和错误处理工具
 */
export class IndexedDBUtils {
  /**
   * 批量操作工具
   */
  static async batchOperations<T>(
    items: T[],
    operation: (item: T) => Promise<void>,
    batchSize: number = 10
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(operation));
    }
  }

  /**
   * 带重试的事务执行
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 事务超时包装器
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = 5000
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 检查IndexedDB可用性
   */
  static isIndexedDBAvailable(): boolean {
    return 'indexedDB' in self && indexedDB !== null;
  }

  /**
   * 估算存储使用情况
   */
  static async estimateStorageUsage(): Promise<{
    used: number;
    available: number;
    percentage: number;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const available = (estimate.quota || 0) - used;
        const percentage = estimate.quota ? (used / estimate.quota) * 100 : 0;
        
        return { used, available, percentage };
      } catch (error) {
        console.error('Failed to estimate storage usage:', error);
      }
    }
    
    // 回退到基本的估算
    return { used: 0, available: 0, percentage: 0 };
  }

  /**
   * 数据压缩工具 - 简单的JSON压缩
   */
  static compressData(data: any): string {
    // 简单的数据压缩 - 移除不必要的空格和换行符
    return JSON.stringify(data).replace(/\s+/g, ' ').trim();
  }

  /**
   * 数据解压缩工具
   */
  static decompressData(compressedData: string): any {
    try {
      return JSON.parse(compressedData);
    } catch (error) {
      console.error('Failed to decompress data:', error);
      throw new Error('Invalid compressed data');
    }
  }

  /**
   * 检查数据完整性
   */
  static async validateDataIntegrity(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // 检查历史记录
      const history = await xtransIndexedDB.getHistory();
      for (const item of history) {
        if (!item.id || !item.type || !item.timestamp) {
          errors.push(`Invalid history item: ${JSON.stringify(item)}`);
        }
      }
      
      // 检查设备记录
      const devices = await xtransIndexedDB.getAllDevices();
      for (const device of devices) {
        if (!device.deviceId || !device.deviceName) {
          errors.push(`Invalid device: ${JSON.stringify(device)}`);
        }
      }
      
      // 检查设置
      const settings = await xtransIndexedDB.getSettings();
      if (settings && (!settings.deviceName || !settings.theme)) {
        errors.push(`Invalid settings: ${JSON.stringify(settings)}`);
      }
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      errors.push(`Validation error: ${error}`);
      return {
        valid: false,
        errors
      };
    }
  }

  /**
   * 修复数据完整性问题
   */
  static async repairData(): Promise<{
    success: boolean;
    repaired: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let repaired = 0;
    
    try {
      // 修复历史记录
      const history = await xtransIndexedDB.getHistory();
      for (const item of history) {
        try {
          if (!item.id) {
            // 生成新的ID
            item.id = `repaired-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            await xtransIndexedDB.addHistory(item);
            repaired++;
          }
          
          if (!item.type) {
            // 设置默认类型
            item.type = 'file';
            await xtransIndexedDB.addHistory(item);
            repaired++;
          }
          
          if (!item.timestamp) {
            // 设置默认时间戳
            item.timestamp = Date.now();
            await xtransIndexedDB.addHistory(item);
            repaired++;
          }
        } catch (error) {
          errors.push(`Failed to repair history item ${item.id}: ${error}`);
        }
      }
      
      return {
        success: errors.length === 0,
        repaired,
        errors
      };
    } catch (error) {
      errors.push(`Repair error: ${error}`);
      return {
        success: false,
        repaired,
        errors
      };
    }
  }

  /**
   * 创建数据备份
   */
  static async createBackup(): Promise<{
    success: boolean;
    data: string | null;
    error: string | null;
  }> {
    try {
      const data = await xtransIndexedDB.exportData();
      const compressedData = this.compressData(data);
      
      return {
        success: true,
        data: compressedData,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `${error}`
      };
    }
  }

  /**
   * 从备份恢复数据
   */
  static async restoreFromBackup(compressedData: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      const data = this.decompressData(compressedData);
      await xtransIndexedDB.importData(data);
      
      return {
        success: true,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        error: `${error}`
      };
    }
  }
}

/**
 * 性能监控工具
 */
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  /**
   * 记录操作耗时
   */
  static recordMetric(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    // 只保留最近100次记录
    const records = this.metrics.get(name)!;
    if (records.length > 100) {
      records.shift();
    }
  }

  /**
   * 获取指标统计
   */
  static getMetricStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } | null {
    const records = this.metrics.get(name);
    if (!records || records.length === 0) {
      return null;
    }
    
    const sorted = [...records].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const average = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p95Index = Math.floor(0.95 * count);
    const p99Index = Math.floor(0.99 * count);
    const p95 = sorted[p95Index];
    const p99 = sorted[p99Index];
    
    return {
      count,
      average,
      min,
      max,
      p95,
      p99
    };
  }

  /**
   * 清除指标
   */
  static clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * 包装函数以测量执行时间
   */
  static async measure<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}-error`, duration);
      throw error;
    }
  }
}

/**
 * 错误处理和日志记录
 */
export class ErrorHandler {
  private static errorLog: Array<{
 
