#!/usr/bin/env bun
/**
 * TASK-GUARD-1: 写保护清单钩子
 *
 * 输入：file_path（通过环境变量 GUARD_FILE_PATH 传递）
 * 输出：exit 0 = 允许，exit 1 = 阻断 + 写 .dsevo/incidents/guard-<ts>.md
 *
 * 保护规则来自 .dsxu/specs/PROTECTED_FILES.md
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, basename } from 'path';

// 一级保护文件（基础设施，动必出事）
const LEVEL_1_PROTECTED = [
  'package.json',
  'package-lock.json',
  'bun.lockb',
  'yarn.lock',
  'tsconfig.json',
  'tsconfig.*.json',
  '.gitignore',
  'deepseek-proxy.ts',
  '.env',
  '.env.example',
  'bin/claude-haha',
  'src/entrypoints/cli.tsx',
];

// 二级保护文件（配置，可能破坏路由）
const LEVEL_2_PROTECTED = [
  '.claude/settings.json',
  '.claude/hooks/*',
  'PROTECTED_FILES.md',
  '.dsxu/specs/*',
];

// 禁止创建的文件名模式（根目录）
const FORBIDDEN_PATTERNS = [
  /^.*setup.*\.(cmd|bat|sh)$/i,
  /^quick-start.*/i,
  /^test-.*\.(js|cmd)$/i,
  /^.*-proxy-.*\.js$/i,
  /^(USAGE|INSTALL|GETTING-STARTED)\.md$/i,
  /^.*\.bat$/i,
];

// 合法写入白名单
const ALLOWED_PATTERNS = [
  /^src\/services\/.*/,
  /^src\/coordinator\/.*/,
  /^src\/tools\/.*/,
  /^src\/utils\/.*/,
  /^src\/.*\/__tests__\/.*/,
  /^evals\/.*/,
  /^scripts\/.*/,
  /^\.dsevo\/.*/,
  /^extensions\/vscode-dsxu\/.*/,
];

function isProtected(filePath: string): { protected: boolean; reason: string; level: '1' | '2' | 'pattern' } {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = basename(normalizedPath);
  const dirName = normalizedPath.split('/')[0] || '';

  // 检查一级保护
  for (const pattern of LEVEL_1_PROTECTED) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(normalizedPath)) {
        return { protected: true, reason: `一级保护文件: ${pattern}`, level: '1' };
      }
    } else if (normalizedPath === pattern) {
      return { protected: true, reason: `一级保护文件: ${pattern}`, level: '1' };
    }
  }

  // 检查二级保护
  for (const pattern of LEVEL_2_PROTECTED) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(normalizedPath)) {
        return { protected: true, reason: `二级保护文件: ${pattern}`, level: '2' };
      }
    } else if (normalizedPath === pattern) {
      return { protected: true, reason: `二级保护文件: ${pattern}`, level: '2' };
    }
  }

  // 检查禁止创建的模式（仅限根目录）
  if (dirName === '' || dirName === '.') {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(fileName)) {
        return { protected: true, reason: `禁止创建的文件名模式: ${pattern.source}`, level: 'pattern' };
      }
    }
  }

  // 检查是否在白名单内
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return { protected: false, reason: '在白名单内', level: '1' };
    }
  }

  // 不在白名单内，需要走 GUARD 流程
  return { protected: true, reason: '不在合法写入白名单内', level: '1' };
}

function writeIncident(filePath: string, reason: string, level: string): void {
  const incidentsDir = '.dsevo/incidents';
  if (!existsSync(incidentsDir)) {
    mkdirSync(incidentsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const incidentFile = join(incidentsDir, `guard-${timestamp}.md`);

  const content = `# GUARD 拦截记录

**时间**: ${new Date().toISOString()}
**文件路径**: ${filePath}
**保护级别**: ${level}
**拦截原因**: ${reason}
**环境变量**: GUARD_FILE_PATH=${process.env.GUARD_FILE_PATH}

## 预期变更
（需要人工填写预期变更内容）

## 批准流程
1. 人工审核预期变更
2. 回复 "APPROVE ${filePath}"
3. DSxu-V1 收到批准后继续执行

---
*本文件由 TASK-GUARD-1 写保护钩子自动生成*`;

  writeFileSync(incidentFile, content, 'utf8');
  console.error(`[GUARD] 已拦截并写入 incident: ${incidentFile}`);
}

function main() {
  const filePath = process.env.GUARD_FILE_PATH;

  if (!filePath) {
    console.error('[GUARD] 错误: GUARD_FILE_PATH 环境变量未设置');
    process.exit(1);
  }

  console.error(`[GUARD] 检查文件: ${filePath}`);

  const result = isProtected(filePath);

  if (result.protected) {
    console.error(`[GUARD] 拦截原因: ${result.reason}`);
    writeIncident(filePath, result.reason, result.level);
    process.exit(1);
  } else {
    console.error(`[GUARD] 允许: ${result.reason}`);
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { isProtected };