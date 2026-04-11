/**
 * Golden Task 3: 多文件重构
 * 模拟代码重构场景
 */

import { recordCacheUsage } from '../../src/services/cache-stats.js';

console.log('Task 3: 多文件重构 - 第1轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 20,
  prompt_tokens: 200
});

console.log('Task 3: 多文件重构 - 第2轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 100,
  prompt_tokens: 200
});

console.log('Task 3: 多文件重构 - 第3轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 140,
  prompt_tokens: 200
});

console.log('Task 3 完成');