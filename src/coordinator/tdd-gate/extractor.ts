/**
 * R5-21 从任务描述中提取测试目标
 */

import { basename } from 'path';

/**
 * 从任务描述中提取应测内容
 *
 * 分析关键词，生成有意义的测试目标描述列表。
 * 至少返回 1 个目标。
 */
export function extractTestTargets(taskDescription: string, targetFiles: string[]): string[] {
  const targets: string[] = [];
  const desc = taskDescription.toLowerCase();

  // 从目标文件提取模块名
  const moduleNames = targetFiles.map(f => basename(f).replace(/\.(ts|tsx|js|jsx)$/, ''));

  // 提取函数名：常见模式 "fix/add/implement X function/method"
  const funcPatterns = [
    /(?:fix|add|implement|update|refactor)\s+(\w+)\s+(?:function|method|handler)/i,
    /(?:fix|add|implement|update|refactor)\s+(\w+)/i,
    /(\w+)\s+(?:function|method|handler)\s+(?:in|for|to)/i,
    /(?:fix\s+)?(?:null|undefined|error)\s+(?:check\s+)?(?:in\s+)?(\w+)/i,
  ];

  for (const pattern of funcPatterns) {
    const match = taskDescription.match(pattern);
    if (match && match[1]) {
      const funcName = match[1];
      // 不要加入太通用的词
      if (!['the', 'a', 'an', 'to', 'in', 'for', 'with', 'update', 'fix', 'add'].includes(funcName.toLowerCase())) {
        targets.push(`${funcName} should work correctly`);
        break;
      }
    }
  }

  // 错误/防御性关键词 → 加防御性测试
  if (desc.includes('null') || desc.includes('undefined') || desc.includes('error') || desc.includes('empty')) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should handle edge cases (null/undefined/empty input)`);
  }

  // 含 fix → 加回归测试目标
  if (desc.includes('fix')) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should not regress after fix`);
  }

  // 含 add/implement → 加存在性测试
  if (desc.includes('add') || desc.includes('implement')) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should export the new function`);
  }

  // 保底：至少 1 个目标
  if (targets.length === 0) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should satisfy the task requirements`);
  }

  return targets;
}
