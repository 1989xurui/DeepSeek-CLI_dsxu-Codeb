/**
 * Golden Task 1: 简单代码生成
 * 模拟实际使用场景，记录缓存命中率
 */

import { recordCacheUsage } from '../../src/services/cache-stats.js';

// 模拟第1轮调用（冷启动）
console.log('Task 1: 简单代码生成 - 第1轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 0,
  prompt_tokens: 100
});

// 模拟第2轮调用（相同模式，应有更高命中率）
console.log('Task 1: 简单代码生成 - 第2轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 40,
  prompt_tokens: 100
});

// 模拟第3轮调用（稳态）
console.log('Task 1: 简单代码生成 - 第3轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 50,
  prompt_tokens: 100
});

console.log('Task 1 完成');