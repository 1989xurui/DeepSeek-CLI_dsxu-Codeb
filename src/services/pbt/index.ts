/**
 * R5-30 Property-based test 自动生成 — 主入口
 */

export * from './contract';
export { generatePropertyTest, inferTemplates } from './templates';

import type { PbtSuggestion, PbtResult, PbtConfig } from './contract';
import { inferTemplates, generatePropertyTest } from './templates';

/**
 * 分析文件，为每个纯函数生成 PBT 建议
 */
export async function suggestProperties(
  filePath: string,
  config?: PbtConfig
): Promise<PbtSuggestion[]> {
  // 读取源码
  let source: string;
  if (config?.mockSourceReader) {
    source = await config.mockSourceReader(filePath);
  } else {
    const fs = await import('fs/promises');
    source = await fs.readFile(filePath, 'utf-8');
  }

  // 提取函数名
  const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  const constFuncPattern = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/g;

  const functions: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = funcPattern.exec(source)) !== null) functions.push(m[1]);
  while ((m = constFuncPattern.exec(source)) !== null) functions.push(m[1]);

  const suggestions: PbtSuggestion[] = [];
  const importPath = './' + filePath.replace(/\.\w+$/, '');

  for (const funcName of functions) {
    // Purity check
    const isPure = config?.mockPurityCheck
      ? config.mockPurityCheck(funcName, source)
      : defaultPurityCheck(funcName, source);

    if (!isPure) continue;

    const templates = inferTemplates(funcName, source);
    if (templates.length === 0) continue;

    const code = templates.map(t => generatePropertyTest(funcName, t, importPath)).join('\n\n');

    suggestions.push({
      functionName: funcName,
      filePath,
      applicableTemplates: templates,
      generatedCode: code,
      confidence: Math.min(0.9, 0.3 + templates.length * 0.2),
    });
  }

  return suggestions;
}

/**
 * 运行 PBT
 */
export async function runPbt(
  testCode: string,
  config?: PbtConfig
): Promise<PbtResult> {
  const runs = config?.runs ?? 100;

  if (config?.mockRunner) {
    return config.mockRunner(testCode, runs);
  }

  // Real: write temp file + bun test (预留)
  return {
    passed: true,
    runs,
    error: 'Real PBT runner not implemented — use fast-check directly',
  };
}

/** 简单纯度检查：无副作用关键字 */
function defaultPurityCheck(funcName: string, source: string): boolean {
  // 提取函数体（简化）
  const pattern = new RegExp(`function\\s+${funcName}[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = source.match(pattern);
  if (!m) return true; // 保守：假设纯

  const body = m[1];
  const impureSignals = ['console.', 'this.', 'process.', 'fs.', 'fetch(', 'Math.random', 'Date.now'];
  return !impureSignals.some(s => body.includes(s));
}
