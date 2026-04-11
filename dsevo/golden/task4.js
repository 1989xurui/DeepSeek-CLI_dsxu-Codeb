/**
 * Golden Task 4: 调试分析
 * 模拟调试场景
 */

import { recordCacheUsage } from '../../src/services/cache-stats.js';

console.log('Task 4: 调试分析 - 第1轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 5,
  prompt_tokens: 80
});

console.log('Task 4: 调试分析 - 第2轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 30,
  prompt_tokens: 80
});

console.log('Task 4: 调试分析 - 第3轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 50,
  prompt_tokens: 80
});

console.log('Task 4 完成');