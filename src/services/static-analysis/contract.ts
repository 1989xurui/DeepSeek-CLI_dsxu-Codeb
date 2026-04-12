/**
 * R5-22 Static Pre-Gate — Interface Contract
 *
 * DSxu-V1 的实现必须逐字匹配这些签名。contract-check.ts 会做类型
 * 结构化校验（不要求变量名一致，但类型结构必须等价）。
 *
 * 路径：src/services/static-analysis/contract.ts
 * （如果你已经开始在别的路径实现，继续用你已有的路径，
 *  但文件名 contract.ts 和导出 API 必须一致）
 */

export type StaticIssueSource = 'ast-grep' | 'tsc' | 'eslint';
export type StaticIssueSeverity = 'error' | 'warning' | 'info';

export interface StaticIssue {
  severity: StaticIssueSeverity;
  source: StaticIssueSource;
  file: string;
  line: number;
  column: number;
  rule: string;
  message: string;
  suggestion?: string;
}

export interface LayerResult {
  passed: boolean;
  issues: StaticIssue[];
  durationMs: number;
  skipped?: boolean;
  skipReason?: string;
}

export interface StaticGateResult {
  passed: boolean;
  totalIssues: number;
  errors: number;
  warnings: number;
  issues: StaticIssue[];
  durationMs: number;
  layers: {
    astGrep: LayerResult;
    tsc: LayerResult;
    eslint: LayerResult;
  };
}

export interface SpawnResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  durationMs?: number;
}

export interface StaticGateOptions {
  astGrepRulesPath?: string;
  tscConfigPath?: string;
  eslintConfigPath?: string;
  skipLayers?: Array<StaticIssueSource>;
  maxDurationMs?: number;
  shortCircuitOnError?: boolean;
  mockSpawn?: (cmd: string, args: string[], timeoutMs: number) => Promise<SpawnResult>;
}

/**
 * 主入口：对一组文件跑三层静态分析
 *
 * 契约：
 *   - 不得抛异常；工具失败应记录到对应 layer 的 issues
 *   - 总耗时不得超过 options.maxDurationMs（默认 3000ms）
 *   - shortCircuitOnError=true 时，任何层出现 error 级别，后续层 skipped
 *   - result.passed === (result.errors === 0)
 */
export async function runStaticGate(
  targetFiles: string[],
  options?: StaticGateOptions
): Promise<StaticGateResult>;

/**
 * 生成人类可读报告
 *
 * 契约：
 *   - 返回字符串，长度 < 5000 字符
 *   - 若 passed=true 返回简短摘要
 *   - 若 passed=false 列出所有 error 级 issues + 前 5 个 warning
 *   - 使用 markdown 格式
 */
export function formatGateReport(result: StaticGateResult): string;

/**
 * 判断一个文件是否应该被静态门扫描
 *
 * 契约：
 *   - .ts / .tsx / .js / .jsx 返回 true
 *   - node_modules / dist / .trash / __tests__ 返回 false
 *   - .dsxu / .dsevo 返回 false
 */
export function shouldScan(filePath: string): boolean {
  // 这是一个声明，实际实现在 runner.ts 中
  throw new Error('shouldScan should be implemented in runner.ts');
}