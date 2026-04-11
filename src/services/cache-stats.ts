/**
 * R5-19: Cache hit 埋点 + telemetry
 *
 * 目标：在 deepseek-proxy 抓取上游响应中的 `prompt_cache_hit_tokens` 字段，
 * 导出到 OTEL + 内存计数器，并暴露给后续 R5-11 prefix 优化器使用。
 *
 * FMEA 风险：
 * 1. 上游字段名变更 → 字段名做配置常量，加 fallback 解析
 * 2. 并发计数器 race → 用 BigInt + atomic（或单线程 actor 模型）
 * 3. OTEL exporter 阻塞 → 异步 export + 队列 + 丢弃策略
 * 4. snapshot 丢失 → 周期性持久化到 `.dsxu/cache-stats.json`
 * 5. OOM（计数器无上限累积）→ 24h 自动 reset 或 BigInt
 */

export interface CacheStats {
  /** 累计命中 tokens */
  hit: number;
  /** 累计未命中 tokens */
  miss: number;
  /** 命中率：hit / (hit + miss) */
  ratio(): number;
  /** 重置计数器 */
  reset(): void;
  /** 快照：当前状态 */
  snapshot(): { hit: number; miss: number; ratio: number; ts: number };
}

export interface CacheUsage {
  prompt_cache_hit_tokens?: number;
  prompt_tokens?: number;
}

class CacheStatsImpl implements CacheStats {
  private _hit: number = 0;
  private _miss: number = 0;
  private _lastResetTime: number = Date.now();
  private readonly RESET_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24小时
  private _resetCheckInterval: NodeJS.Timeout | null = null;

  constructor(private skipDiskLoad: boolean = false) {
    if (!skipDiskLoad) {
      // 加载持久化数据
      this.loadFromDisk();
      // 启动定期重置检查
      this.startResetCheck();
    }
  }

  get hit(): number {
    return this._hit;
  }

  get miss(): number {
    return this._miss;
  }

  ratio(): number {
    const total = this._hit + this._miss;
    return total > 0 ? this._hit / total : 0;
  }

  reset(): void {
    this._hit = 0;
    this._miss = 0;
    this._lastResetTime = Date.now();
    this.saveToDisk();
  }

  snapshot(): { hit: number; miss: number; ratio: number; ts: number } {
    return {
      hit: this._hit,
      miss: this._miss,
      ratio: this.ratio(),
      ts: Date.now()
    };
  }

  /**
   * 记录缓存使用情况
   * @param usage 上游返回的 usage 对象
   */
  record(usage: CacheUsage): void {
    const hitTokens = typeof usage.prompt_cache_hit_tokens === 'number' ? usage.prompt_cache_hit_tokens : 0;
    const totalTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
    const missTokens = Math.max(0, totalTokens - hitTokens);

    // 原子操作：先加 miss 再加 hit，避免竞态条件
    // 注意：在单线程 Node.js 中这是安全的，但如果未来改为多线程需要加锁
    this._miss += missTokens;
    this._hit += hitTokens;

    // 导出到 OTEL
    this.exportToOtel(hitTokens, missTokens);

    // 每100次记录持久化一次
    if ((this._hit + this._miss) % 100 === 0) {
      this.saveToDisk();
    }
  }

  private exportToOtel(hitTokens: number, missTokens: number): void {
    try {
      // OTEL 导出逻辑
      // 使用异步避免阻塞主线程
      setImmediate(() => {
        const span = globalThis.dsxuTracing?.getCurrentSpan();
        if (span) {
          span.setAttribute('dsxu.cache.hit_tokens', hitTokens);
          span.setAttribute('dsxu.cache.miss_tokens', missTokens);
          span.setAttribute('dsxu.cache.hit_ratio', this.ratio());
        }

        // 同时更新 metrics
        const meter = globalThis.dsxuMetrics?.getMeter('dsxu.cache');
        if (meter) {
          const hitCounter = meter.createCounter('cache_hit_tokens', {
            description: '累计缓存命中 tokens'
          });
          const missCounter = meter.createCounter('cache_miss_tokens', {
            description: '累计缓存未命中 tokens'
          });
          const ratioGauge = meter.createObservableGauge('cache_hit_ratio', {
            description: '缓存命中率'
          }, (observableResult) => {
            observableResult.observe(this.ratio());
          });

          hitCounter.add(hitTokens);
          missCounter.add(missTokens);
        }
      });
    } catch (error) {
      // OTEL 导出失败不影响主逻辑
      console.warn('[R5-19] OTEL export failed:', error);
    }
  }

  private saveToDisk(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(__dirname, '../../../.dsxu');
      const filePath = path.join(dataDir, 'cache-stats.json');

      const data = {
        hit: this._hit,
        miss: this._miss,
        lastResetTime: this._lastResetTime,
        savedAt: Date.now()
      };

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      // 持久化失败不影响主逻辑
      console.warn('[R5-19] Failed to save cache stats:', error);
    }
  }

  private loadFromDisk(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../../.dsxu/cache-stats.json');

      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this._hit = data.hit || 0;
        this._miss = data.miss || 0;
        this._lastResetTime = data.lastResetTime || Date.now();

        // 检查是否需要重置（超过24小时）
        const now = Date.now();
        if (now - this._lastResetTime > this.RESET_INTERVAL_MS) {
          this.reset();
        }
      }
    } catch (error) {
      // 加载失败不影响主逻辑
      console.warn('[R5-19] Failed to load cache stats:', error);
    }
  }

  private startResetCheck(): void {
    // 每小时检查一次是否需要重置
    setInterval(() => {
      const now = Date.now();
      if (now - this._lastResetTime > this.RESET_INTERVAL_MS) {
        console.log('[R5-19] Auto-resetting cache stats after 24h');
        this.reset();
      }
    }, 60 * 60 * 1000); // 1小时
  }
}

// 全局单例
export const globalCacheStats: CacheStats = new CacheStatsImpl();

// 导出实现类用于测试
export { CacheStatsImpl };

/**
 * proxy 注入点函数
 * @param usage 上游响应中的 usage 对象
 */
export function recordCacheUsage(usage: any): void {
  if (!usage || typeof usage !== 'object') {
    return;
  }

  const cacheUsage: CacheUsage = {
    prompt_cache_hit_tokens: typeof usage.prompt_cache_hit_tokens === 'number'
      ? usage.prompt_cache_hit_tokens
      : undefined,
    prompt_tokens: typeof usage.prompt_tokens === 'number'
      ? usage.prompt_tokens
      : undefined
  };

  globalCacheStats.record(cacheUsage);
}

/**
 * 自调优 hook 接口
 */
export interface SelfTuningHook {
  getParams(): Record<string, any>;
  proposeNext(failure: { ratio: number }): Record<string, any> | null;
  hasConverged(history: Array<{ ratio: number }>): boolean;
}

export const cacheTuningHook: SelfTuningHook = {
  getParams() {
    return {
      currentRatio: globalCacheStats.ratio(),
      hit: globalCacheStats.hit,
      miss: globalCacheStats.miss
    };
  },

  proposeNext(failure: { ratio: number }) {
    if (failure.ratio < 0.3) {
      return { action: 'rotate_prefix_order' };
    }
    return null;
  },

  hasConverged(history: Array<{ ratio: number }>) {
    if (history.length < 3) return false;

    const lastThree = history.slice(-3);
    const avg = lastThree.reduce((sum, h) => sum + h.ratio, 0) / lastThree.length;
    const variance = lastThree.reduce((sum, h) => sum + Math.pow(h.ratio - avg, 2), 0) / lastThree.length;

    return variance < 0.01; // 方差小于1%认为收敛
  }
};