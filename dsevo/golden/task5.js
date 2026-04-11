/**
 * Golden Task 5: 文档生成
 * 模拟文档编写场景
 */

import { recordCacheUsage } from '../../src/services/cache-stats.js';

console.log('Task 5: 文档生成 - 第1轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 15,
  prompt_tokens: 120
});

console.log('Task 5: 文档生成 - 第2轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 60,
  prompt_tokens: 120
});

console.log('Task 5: 文档生成 - 第3轮');
recordCacheUsage({
  prompt_cache_hit_tokens: 90,
  prompt_tokens: 120
});

console.log('Task 5 完成');