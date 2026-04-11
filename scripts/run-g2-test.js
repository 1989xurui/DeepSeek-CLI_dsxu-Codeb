#!/usr/bin/env node

/**
 * G2 差分基线测试脚本
 * 运行 golden 任务 3 轮，验证缓存命中率提升
 * 通过条件：
 * 1. 第1轮命中率 > 0%
 * 2. 第2轮命中率 > 第1轮 + 10%
 * 3. 第3轮命中率 > 30%
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { globalCacheStats } from '../src/services/cache-stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 重置全局状态
globalCacheStats.reset();

console.log('=== G2 差分基线测试开始 ===');
console.log('运行 5 个 golden 任务，每轮 3 次调用\n');

const goldenTasks = [
  'task1.js',
  'task2.js',
  'task3.js',
  'task4.js',
  'task5.js'
];

// 存储每轮的结果
const roundResults = {
  round1: { hit: 0, miss: 0, ratio: 0 },
  round2: { hit: 0, miss: 0, ratio: 0 },
  round3: { hit: 0, miss: 0, ratio: 0 }
};

// 第1轮：冷启动
console.log('--- 第1轮：冷启动 ---');
for (const task of goldenTasks) {
  const module = await import(join(__dirname, '../dsevo/golden', task));
}
roundResults.round1.hit = globalCacheStats.hit;
roundResults.round1.miss = globalCacheStats.miss;
roundResults.round1.ratio = globalCacheStats.ratio();
console.log(`第1轮结果: 命中 ${roundResults.round1.hit}, 未命中 ${roundResults.round1.miss}, 命中率 ${(roundResults.round1.ratio * 100).toFixed(1)}%\n`);

// 第2轮：缓存预热
console.log('--- 第2轮：缓存预热 ---');
for (const task of goldenTasks) {
  const module = await import(join(__dirname, '../dsevo/golden', task));
}
roundResults.round2.hit = globalCacheStats.hit - roundResults.round1.hit;
roundResults.round2.miss = globalCacheStats.miss - roundResults.round1.miss;
roundResults.round2.ratio = roundResults.round2.hit / (roundResults.round2.hit + roundResults.round2.miss);
console.log(`第2轮结果: 命中 ${roundResults.round2.hit}, 未命中 ${roundResults.round2.miss}, 命中率 ${(roundResults.round2.ratio * 100).toFixed(1)}%\n`);

// 第3轮：稳态
console.log('--- 第3轮：稳态 ---');
for (const task of goldenTasks) {
  const module = await import(join(__dirname, '../dsevo/golden', task));
}
const totalHit = globalCacheStats.hit;
const totalMiss = globalCacheStats.miss;
roundResults.round3.hit = totalHit - (roundResults.round1.hit + roundResults.round2.hit);
roundResults.round3.miss = totalMiss - (roundResults.round1.miss + roundResults.round2.miss);
roundResults.round3.ratio = roundResults.round3.hit / (roundResults.round3.hit + roundResults.round3.miss);
console.log(`第3轮结果: 命中 ${roundResults.round3.hit}, 未命中 ${roundResults.round3.miss}, 命中率 ${(roundResults.round3.ratio * 100).toFixed(1)}%\n`);

// 验证通过条件
console.log('=== 验证通过条件 ===');
let allPassed = true;

// 条件1: 第1轮命中率 > 0%
const condition1 = roundResults.round1.ratio > 0;
console.log(`条件1 - 第1轮命中率 > 0%: ${(roundResults.round1.ratio * 100).toFixed(1)}% ${condition1 ? '✓ 通过' : '✗ 失败'}`);
if (!condition1) allPassed = false;

// 条件2: 第2轮命中率 > 第1轮 + 10%
const improvement = roundResults.round2.ratio - roundResults.round1.ratio;
const condition2 = improvement > 0.1;
console.log(`条件2 - 第2轮比第1轮提升 > 10%: 提升 ${(improvement * 100).toFixed(1)}% ${condition2 ? '✓ 通过' : '✗ 失败'}`);
if (!condition2) allPassed = false;

// 条件3: 第3轮命中率 > 30%
const condition3 = roundResults.round3.ratio > 0.3;
console.log(`条件3 - 第3轮命中率 > 30%: ${(roundResults.round3.ratio * 100).toFixed(1)}% ${condition3 ? '✓ 通过' : '✗ 失败'}`);
if (!condition3) allPassed = false;

// 总结
console.log('\n=== 测试总结 ===');
console.log(`总命中 tokens: ${totalHit}`);
console.log(`总未命中 tokens: ${totalMiss}`);
console.log(`最终命中率: ${(globalCacheStats.ratio() * 100).toFixed(1)}%`);

if (allPassed) {
  console.log('\n✅ G2 差分基线测试通过！');
  process.exit(0);
} else {
  console.log('\n❌ G2 差分基线测试失败！');
  process.exit(1);
}