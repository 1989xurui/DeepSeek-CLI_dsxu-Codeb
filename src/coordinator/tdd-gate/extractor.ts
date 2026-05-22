/**
 * R5-21 test target extractor.
 */

import { basename } from 'path';

/**
 * Extract meaningful test targets from a task description.
 */
export function extractTestTargets(taskDescription: string, targetFiles: string[]): string[] {
  const targets: string[] = [];
  const desc = taskDescription.toLowerCase();

  const moduleNames = targetFiles.map(f => basename(f).replace(/\.(ts|tsx|js|jsx)$/, ''));

  const funcPatterns = [
    /(?:fix|add|implement|update|refactor)\s+(\w+)\s+(?:function|method|handler)/i,
    /(?:fix|add|implement|update|refactor)\s+(\w+)/i,
    /(\w+)\s+(?:function|method|handler)\s+(?:in|for|to)/i,
    /(?:fix\s+)?(?:null|undefined|error)\s+(?:check\s+)?(?:in\s+)?(\w+)/i,
  ];

  for (const pattern of funcPatterns) {
    const match = taskDescription.match(pattern);
    if (match?.[1]) {
      const funcName = match[1];
      if (!['the', 'a', 'an', 'to', 'in', 'for', 'with', 'update', 'fix', 'add'].includes(funcName.toLowerCase())) {
        targets.push(`${funcName} should work correctly`);
        break;
      }
    }
  }

  if (desc.includes('null') || desc.includes('undefined') || desc.includes('error') || desc.includes('empty')) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should handle edge cases (null/undefined/empty input)`);
  }

  if (desc.includes('fix')) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should not regress after fix`);
  }

  if (desc.includes('add') || desc.includes('implement')) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should export the new function`);
  }

  if (targets.length === 0) {
    const moduleName = moduleNames[0] || 'module';
    targets.push(`${moduleName} should satisfy the task requirements`);
  }

  return targets;
}
