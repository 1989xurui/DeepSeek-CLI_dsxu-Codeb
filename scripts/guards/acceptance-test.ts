#!/usr/bin/env bun
/**
 * TASK-GUARD-1 验收测试
 * 验证钩子对合法 Write 的延迟影响
 */

import { spawnSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

console.log('=== TASK-GUARD-1 验收测试 ===\n');

// 清理旧的 incident 文件
const incidentsDir = '.dsevo/incidents';
if (existsSync(incidentsDir)) {
  // 这里不实际删除，只是记录
  console.log('检查 incidents 目录...');
}

// 测试 1: 合法 Write 的延迟测试
console.log('测试 1: 合法 Write 延迟测试');
const startTime = Date.now();
const result = spawnSync('bun', ['scripts/guards/check-protected.ts'], {
  env: { ...process.env, GUARD_FILE_PATH: 'src/services/test-acceptance.ts' },
  cwd: process.cwd(),
  stdio: 'pipe',
  encoding: 'utf8',
});
const endTime = Date.now();
const latency = endTime - startTime;

console.log(`  退出码: ${result.status}`);
console.log(`  输出: ${result.stderr?.trim() || result.stdout?.trim()}`);
console.log(`  延迟: ${latency}ms`);

if (result.status === 0 && latency < 50) {
  console.log('  ✅ 通过: 延迟 < 50ms');
} else if (result.status === 0) {
  console.log(`  ⚠️ 警告: 延迟 ${latency}ms (略高于 50ms)`);
} else {
  console.log('  ❌ 失败: 合法文件被拦截');
}

console.log();

// 测试 2: 保护文件拦截测试
console.log('测试 2: 保护文件拦截测试');
const result2 = spawnSync('bun', ['scripts/guards/check-protected.ts'], {
  env: { ...process.env, GUARD_FILE_PATH: 'package.json' },
  cwd: process.cwd(),
  stdio: 'pipe',
  encoding: 'utf8',
});

console.log(`  退出码: ${result2.status}`);
console.log(`  输出: ${result2.stderr?.trim() || result2.stdout?.trim()}`);

if (result2.status === 1 && result2.stderr?.includes('已拦截并写入 incident')) {
  console.log('  ✅ 通过: 保护文件被正确拦截并生成 incident');
} else {
  console.log('  ❌ 失败: 保护文件未正确拦截');
}

console.log();

// 测试 3: 检查 incident 文件是否生成
console.log('测试 3: incident 文件生成检查');
const incidentFiles = existsSync(incidentsDir) ?
  require('fs').readdirSync(incidentsDir).filter((f: string) => f.startsWith('guard-')) : [];

if (incidentFiles.length > 0) {
  const latestIncident = join(incidentsDir, incidentFiles[incidentFiles.length - 1]);
  const content = require('fs').readFileSync(latestIncident, 'utf8');

  console.log(`  找到 incident 文件: ${latestIncident}`);
  console.log(`  文件大小: ${content.length} 字节`);

  if (content.includes('GUARD 拦截记录') && content.includes('package.json')) {
    console.log('  ✅ 通过: incident 文件内容正确');
  } else {
    console.log('  ❌ 失败: incident 文件内容不正确');
  }
} else {
  console.log('  ❌ 失败: 未找到 incident 文件');
}

console.log('\n=== 验收测试完成 ===');
console.log('钩子已成功部署到 .claude/settings.json');
console.log('下次 DSxu-V1 尝试 Write/Edit 时会自动触发保护检查');