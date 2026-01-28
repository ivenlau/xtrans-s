import LZString from 'lz-string';

/**
 * SDP 压缩器
 * 用于压缩 WebRTC 的 SDP (Session Description Protocol) 数据
 * 以缩短连接码长度，提升用户体验
 */
export class SDPCompressor {
  // 压缩格式版本前缀
  private readonly VERSION_PREFIX = 'X1:';

  // 旧版本前缀（向后兼容）
  private readonly LEGACY_PREFIX = 'XTRANS:';

  /**
   * 压缩 SDP
   * @param sdp 原始 SDP 字符串
   * @returns 压缩后的编码（带版本前缀）
   */
  compress(sdp: string): string {
    try {
      // 步骤 1: 优化 SDP（移除冗余的 ICE candidates）
      const optimized = this.optimizeSDP(sdp);

      // 步骤 2: 使用 LZ-String 压缩
      const compressed = LZString.compressToEncodedURIComponent(optimized);

      // 步骤 3: 添加版本前缀
      return this.VERSION_PREFIX + compressed;
    } catch (error) {
      console.error('SDP 压缩失败:', error);
      throw new Error(`SDP 压缩失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 解压 SDP
   * @param code 压缩的编码
   * @returns 原始 SDP 字符串，失败返回 null
   */
  decompress(code: string): string | null {
    try {
      // 新格式（压缩版本）
      if (code.startsWith(this.VERSION_PREFIX)) {
        const compressed = code.slice(this.VERSION_PREFIX.length);
        const decompressed = LZString.decompressFromEncodedURIComponent(compressed);

        if (!decompressed) {
          throw new Error('LZ-String 解压返回空值');
        }

        return decompressed;
      }

      // 旧格式（向后兼容）
      if (code.startsWith(this.LEGACY_PREFIX)) {
        return this.decompressLegacy(code);
      }

      // 尝试直接解析 JSON（可能是原始 SDP）
      if (code.trim().startsWith('{')) {
        return code.trim();
      }

      // 无效格式
      console.error('无法识别的连接码格式');
      return null;
    } catch (error) {
      console.error('SDP 解压失败:', error);
      return null;
    }
  }

  /**
   * 优化 SDP
   * 移除冗余的 ICE candidates 以减少数据大小
   * @param sdp 原始 SDP
   * @returns 优化后的 SDP
   */
  private optimizeSDP(sdp: string): string {
    const lines = sdp.split('\n');
    let hostCount = 0;
    const maxHostCandidates = 2; // 只保留前 2 个 host candidates（局域网地址）

    const optimized = lines.filter(line => {
      // 处理 ICE candidates
      if (line.startsWith('a=candidate:')) {
        // 保留前 N 个 host candidates（局域网地址）
        if (line.includes('typ host')) {
          hostCount++;
          return hostCount <= maxHostCandidates;
        }

        // 保留所有 srflx candidates（STUN 服务器返回的公网 IP）
        if (line.includes('typ srflx')) {
          return true;
        }

        // 保留 relay candidates（TURN 服务器中继）
        if (line.includes('typ relay')) {
          return true;
        }

        // 移除其他 candidates（prflx 等）
        return false;
      }

      // 保留所有其他行
      return true;
    });

    return optimized.join('\n');
  }

  /**
   * 解压旧格式（Base64 编码）
   * 用于向后兼容
   * @param code 旧格式的连接码
   * @returns 原始 SDP 字符串
   */
  private decompressLegacy(code: string): string | null {
    try {
      const base64 = code.slice(this.LEGACY_PREFIX.length);
      const binString = atob(base64);
      const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
      return new TextDecoder().decode(bytes);
    } catch (error) {
      console.error('旧格式解压失败:', error);
      return null;
    }
  }

  /**
   * 检查连接码是否为压缩格式
   * @param code 连接码
   * @returns 是否为压缩格式
   */
  isCompressed(code: string): boolean {
    return code.startsWith(this.VERSION_PREFIX);
  }

  /**
   * 获取压缩统计信息（用于调试）
   * @param original 原始 SDP
   * @param compressed 压缩后的编码
   * @returns 统计信息
   */
  getCompressionStats(original: string, compressed: string): {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    reduction: string;
  } {
    const originalSize = original.length;
    const compressedSize = compressed.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100);

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      reduction: `${compressionRatio.toFixed(1)}%`
    };
  }
}

// 导出单例
export const sdpCompressor = new SDPCompressor();
