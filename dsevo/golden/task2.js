/**
 * Golden Task 2: 复杂算法推理
 * 模拟数学计算场景
 */

import { recordCacheUsage } from '../../src/services/cache-stats.js';

console.log('Task 2: 复杂算法推理 - 第1轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 10,
  prompt_tokens: 150
});

console.log('Task 2: 复杂算法推理 - 第2轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 60,
  prompt_tokens: 150
});

console.log('Task 2: 复杂算法推理 - 第3轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 90,
  prompt_tokens: 150
});

console.log('Task 2 完成');