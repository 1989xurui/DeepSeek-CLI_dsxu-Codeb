/**
 * R5-21 测试生成器
 */

import { basename } from 'path';
import type { TDDContext, TestSpec, TDDGateConfig } from './contract';
import { extractTestTargets } from './extractor';

/**
 * 生成测试规格
 *
 * mockTestGenerator 存在时使用 mock。
 * 否则根据 extractTestTargets 结果生成模板。
 */
export async function generateTestSpec(
  context: TDDContext,
  config?: Partial<TDDGateConfig>
): Promise<TestSpec> {
  // Mock 模式
  if (config?.mockTestGenerator) {
    return config.mockTestGenerator(context);
  }

  // 真实生成
  const targets = extractTestTargets(context.taskDescription, context.targetFiles);
  const mainFile = context.targetFiles[0] || 'src/module.ts';
  const moduleName = basename(mainFile).replace(/\.(ts|tsx|js|jsx)$/, '');
  const testFilePath = mainFile.replace(/\.(\w+)$/, '.test.$1').replace(/^src\//, 'src/__tests__/');

  // 生成测试内容
  const testContent = generateTestContent(moduleName, mainFile, targets, context);

  return {
    filePath: testFilePath,
    content: testContent,
    targetName: moduleName,
    testDescriptions: targets,
  };
}

function generateTestContent(
  moduleName: string,
  mainFile: string,
  targets: string[],
  context: TDDContext
): string {
  const importPath = '../' + mainFile.replace(/^src\//, '').replace(/\.\w+$/, '');
  const lines: string[] = [
    `import { describe, test, expect } from 'bun:test';`,
    `import { ${moduleName} } from '${importPath}';`,
    ``,
    `describe('${context.taskDescription}', () => {`,
  ];

  for (const target of targets) {
    lines.push(`  test('${target}', () => {`);
    lines.push(`    // Auto-generated test for: ${target}`);
    lines.push(`    expect(${moduleName}).toBeDefined();`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);
  return lines.join('\n');
}
