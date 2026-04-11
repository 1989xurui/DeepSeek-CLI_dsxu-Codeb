#!/usr/bin/env bun
/**
 * TASK-GUARD-1 测试脚本
 * 测试 check-protected.ts 的逻辑
 */

import { isProtected } from './check-protected';

console.log('=== TASK-GUARD-1 测试 ===\n');

const testCases = [
  // 白名单路径 - 应该通过
  { path: 'src/services/foo.ts', expected: false, desc: '白名单路径 (src/services/)' },
  { path: 'src/coordinator/bar.ts', expected: false, desc: '白名单路径 (src/coordinator/)' },
  { path: 'scripts/test.js', expected: false, desc: '白名单路径 (scripts/)' },
  { path: '.dsevo/logs/test.log', expected: false, desc: '白名单路径 (.dsevo/)' },

  // 一级保护 - 应该拦截
  { path: 'package.json', expected: true, desc: '一级保护文件' },
  { path: 'tsconfig.json', expected: true, desc: '一级保护文件' },
  { path: '.gitignore', expected: true, desc: '一级保护文件' },
  { path: 'deepseek-proxy.ts', expected: true, desc: '一级保护文件' },

  // 二级保护 - 应该拦截
  { path: '.claude/settings.json', expected: true, desc: '二级保护文件' },
  { path: '.dsxu/specs/test.md', expected: true, desc: '二级保护文件' },

  // 禁止创建的模式 - 应该拦截
  { path: 'test-foo.js', expected: true, desc: '禁止创建模式 (test-*.js)' },
  { path: 'quick-start.md', expected: true, desc: '禁止创建模式 (quick-start*)' },
  { path: 'my-proxy-setup.cmd', expected: true, desc: '禁止创建模式 (*setup*.cmd)' },

  // 不在白名单内 - 应该拦截
  { path: 'root-file.ts', expected: true, desc: '不在白名单内' },
  { path: 'docs/new-feature.md', expected: true, desc: '不在白名单内 (docs/ 不在白名单)' },
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = isProtected(test.path);
  const success = result.protected === test.expected;

  console.log(`${success ? '✅' : '❌'} ${test.desc}`);
  console.log(`  路径: ${test.path}`);
  console.log(`  预期: ${test.expected ? '拦截' : '通过'}`);
  console.log(`  实际: ${result.protected ? '拦截' : '通过'} (原因: ${result.reason})`);
  console.log();

  if (success) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`\n=== 测试结果 ===`);
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${testCases.length}`);

if (failed > 0) {
  process.exit(1);
}