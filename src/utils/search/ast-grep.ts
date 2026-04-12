/**
 * R5-01+ ast-grep 适配层
 *
 * 调用 ast-grep CLI，解析 JSON 输出为 SearchHit。
 */

import type { SearchHit } from './contract';

/**
 * 执行 ast-grep 搜索
 *
 * @param query - ast-grep 模式字符串
 * @param language - 语言标记
 * @param rootDir - 搜索根目录
 */
export async function searchAstGrep(
  query: string,
  language?: string,
  rootDir?: string
): Promise<SearchHit[]> {
  try {
    const { execSync } = await import('child_process');

    const args = ['--pattern', query, '--json'];
    if (language) args.push('--lang', language);

    const cmd = `sg ${args.map(a => `"${a}"`).join(' ')}`;
    const cwd = rootDir ?? process.cwd();

    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 15_000,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!output.trim()) return [];

    const results = JSON.parse(output);
    if (!Array.isArray(results)) return [];

    return results.map((r: any) => ({
      file: r.file ?? r.path ?? '',
      line: r.range?.start?.line ?? r.line ?? 0,
      col: r.range?.start?.column ?? 0,
      context: r.text ?? r.lines ?? '',
      score: 1.0,  // ast-grep = exact match → 最高分
      tier: 'ast-grep' as const,
    }));
  } catch {
    // ast-grep CLI 不可用 → 返回空，fallback 到下一级
    return [];
  }
}

/**
 * 判断 query 是否是 ast-grep 模式
 * 含 $$$、大写元变量、语法结构关键字
 */
export function isAstGrepPattern(query: string): boolean {
  // 含 $$$ 或 $UPPER_CASE 元变量
  if (/\$\$\$/.test(query)) return true;
  if (/\$[A-Z][A-Z_0-9]*/.test(query)) return true;
  // 含常见语法结构模式
  if (/function\s+\$/.test(query)) return true;
  if (/class\s+\$/.test(query)) return true;
  return false;
}
