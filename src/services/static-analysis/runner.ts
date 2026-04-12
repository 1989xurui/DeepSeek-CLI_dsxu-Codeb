/**
 * R5-22 Static Pre-Gate — 实现
 * 符合蒸馏协议 contract.ts 的接口
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { join, relative, basename, extname } from 'path';
import { existsSync } from 'fs';
import {
  StaticIssue,
  StaticIssueSource,
  StaticIssueSeverity,
  LayerResult,
  StaticGateResult,
  StaticGateOptions,
  runStaticGate,
  formatGateReport,
  shouldScan,
} from './contract';

import { parseAstGrepOutput } from './parsers/ast-grep';
import { parseTscOutput } from './parsers/tsc';
import { parseEslintOutput } from './parsers/eslint';

const exec = promisify(spawn);

// 工具配置接口
interface ToolConfig {
  enabled: boolean;
  command: string;
  args: string[];
  parser: (output: string, cwd: string, filePaths: string[]) => StaticIssue[];
  timeoutMs: number;
  source: StaticIssueSource;
}

// 默认工具配置
const DEFAULT_TOOLS: Record<StaticIssueSource, ToolConfig> = {
  'ast-grep': {
    enabled: false, // 暂时禁用，需要先创建 ast-grep 规则文件
    command: 'npx',
    args: ['@ast-grep/cli', 'scan', '--json', '--config', 'scripts/ast-grep-rules.yml'],
    parser: parseAstGrepOutput,
    timeoutMs: 3000,
    source: 'ast-grep',
  },
  tsc: {
    enabled: true,
    command: 'npx',
    args: ['tsc', '--noEmit', '--strict', '--noImplicitAny', '--strictNullChecks', '--pretty', 'false'],
    parser: parseTscOutput,
    timeoutMs: 5000,
    source: 'tsc',
  },
  eslint: {
    enabled: true,
    command: 'npx',
    args: ['eslint', '--format', 'json', '--no-eslintrc', '--config', '.eslintrc.json'],
    parser: parseEslintOutput,
    timeoutMs: 3000,
    source: 'eslint',
  },
};

// 默认选项
const DEFAULT_OPTIONS: Required<StaticGateOptions> = {
  astGrepRulesPath: 'scripts/ast-grep-rules.yml',
  tscConfigPath: 'tsconfig.json',
  eslintConfigPath: '.eslintrc.gate.json',
  skipLayers: [],
  maxDurationMs: 10000,
  shortCircuitOnError: true,
};

/**
 * 运行静态分析门
 */
export async function runStaticGateImpl(
  targetFiles: string[],
  options?: StaticGateOptions
): Promise<StaticGateResult> {
  const startTime = Date.now();
  const cwd = process.cwd();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 过滤文件
  const filesToScan = targetFiles.filter(shouldScan);
  if (filesToScan.length === 0) {
    return createEmptyResult(startTime);
  }

  // 初始化各层结果
  const layers: StaticGateResult['layers'] = {
    astGrep: { passed: true, issues: [], durationMs: 0 },
    tsc: { passed: true, issues: [], durationMs: 0 },
    eslint: { passed: true, issues: [], durationMs: 0 },
  };

  const allIssues: StaticIssue[] = [];
  let shouldShortCircuit = false;

  // 按顺序运行各层
  const layerOrder: StaticIssueSource[] = ['ast-grep', 'tsc', 'eslint'];

  for (const layer of layerOrder) {
    if (opts.skipLayers?.includes(layer)) {
      layers[layer === 'ast-grep' ? 'astGrep' : layer] = {
        passed: true,
        issues: [],
        durationMs: 0,
        skipped: true,
        skipReason: 'explicitly skipped via options',
      };
      continue;
    }

    if (shouldShortCircuit && opts.shortCircuitOnError) {
      layers[layer === 'ast-grep' ? 'astGrep' : layer] = {
        passed: false,
        issues: [],
        durationMs: 0,
        skipped: true,
        skipReason: 'short-circuited due to error in previous layer',
      };
      continue;
    }

    const toolConfig = DEFAULT_TOOLS[layer];
    if (!toolConfig.enabled) {
      layers[layer === 'ast-grep' ? 'astGrep' : layer] = {
        passed: true,
        issues: [],
        durationMs: 0,
        skipped: true,
        skipReason: 'tool disabled',
      };
      continue;
    }

    try {
      const layerStart = Date.now();
      const issues = await runTool(layer, toolConfig, filesToScan, cwd, opts);
      const duration = Date.now() - layerStart;

      const hasErrors = issues.some(issue => issue.severity === 'error');
      layers[layer === 'ast-grep' ? 'astGrep' : layer] = {
        passed: !hasErrors,
        issues,
        durationMs: duration,
      };

      allIssues.push(...issues);

      if (hasErrors && opts.shortCircuitOnError) {
        shouldShortCircuit = true;
      }

    } catch (error: any) {
      // 工具执行失败
      const errorIssue: StaticIssue = {
        severity: 'error',
        source: layer,
        file: '',
        line: 0,
        column: 0,
        rule: `gate.tool-error`,
        message: `${layer} execution failed: ${error.message}`,
      };

      layers[layer === 'ast-grep' ? 'astGrep' : layer] = {
        passed: false,
        issues: [errorIssue],
        durationMs: 0,
      };

      allIssues.push(errorIssue);
      shouldShortCircuit = true;
    }
  }

  // 统计结果
  const errors = allIssues.filter(issue => issue.severity === 'error').length;
  const warnings = allIssues.filter(issue => issue.severity === 'warning').length;
  const totalDuration = Date.now() - startTime;

  // 按文件、行号排序
  allIssues.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });

  return {
    passed: errors === 0,
    totalIssues: allIssues.length,
    errors,
    warnings,
    issues: allIssues,
    durationMs: totalDuration,
    layers,
  };
}

/**
 * 运行单个工具
 */
async function runTool(
  layer: StaticIssueSource,
  config: ToolConfig,
  filePaths: string[],
  cwd: string,
  options: Required<StaticGateOptions>
): Promise<StaticIssue[]> {
  const startTime = Date.now();
  const args = [...config.args];

  // 添加文件路径参数
  if (layer === 'tsc' || layer === 'eslint') {
    args.push(...filePaths);
  }
  // ast-grep 使用 --pattern 或扫描目录

  try {
    const { stdout, stderr } = await exec(config.command, args, {
      cwd,
      timeout: config.timeoutMs,
      stdio: 'pipe',
      shell: true,
    });

    const output = stdout.toString() + stderr.toString();
    return config.parser(output, cwd, filePaths);

  } catch (error: any) {
    // 超时处理
    if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
      return [{
        severity: 'error',
        source: layer,
        file: '',
        line: 0,
        column: 0,
        rule: 'gate.timeout',
        message: `${layer} timed out after ${config.timeoutMs}ms`,
      }];
    }

    // 工具未安装
    if (error.message.includes('command not found') || error.message.includes('ENOENT')) {
      return [{
        severity: 'error',
        source: layer,
        file: '',
        line: 0,
        column: 0,
        rule: 'gate.tool-missing',
        message: `${layer} is not installed or not in PATH`,
      }];
    }

    throw error;
  }
}

/**
 * 创建空结果
 */
function createEmptyResult(startTime: number): StaticGateResult {
  const duration = Date.now() - startTime;
  const emptyLayer = { passed: true, issues: [], durationMs: 0 };

  return {
    passed: true,
    totalIssues: 0,
    errors: 0,
    warnings: 0,
    issues: [],
    durationMs: duration,
    layers: {
      astGrep: emptyLayer,
      tsc: emptyLayer,
      eslint: emptyLayer,
    },
  };
}


/**
 * 格式化报告
 */
export function formatGateReportImpl(result: StaticGateResult): string {
  if (result.passed) {
    return `## ✅ Static Analysis PASSED\n\n` +
           `- **Duration**: ${result.durationMs}ms\n` +
           `- **Issues**: ${result.totalIssues} total (${result.errors} errors, ${result.warnings} warnings)\n` +
           `- **Layers**:\n` +
           `  - ast-grep: ${result.layers.astGrep.passed ? '✅' : '❌'} (${result.layers.astGrep.issues.length} issues, ${result.layers.astGrep.durationMs}ms)\n` +
           `  - tsc: ${result.layers.tsc.passed ? '✅' : '❌'} (${result.layers.tsc.issues.length} issues, ${result.layers.tsc.durationMs}ms)\n` +
           `  - eslint: ${result.layers.eslint.passed ? '✅' : '❌'} (${result.layers.eslint.issues.length} issues, ${result.layers.eslint.durationMs}ms)`;
  }

  // 失败报告
  const errorIssues = result.issues.filter(issue => issue.severity === 'error');
  const warningIssues = result.issues.filter(issue => issue.severity === 'warning');
  const infoIssues = result.issues.filter(issue => issue.severity === 'info');

  let report = `## ❌ Static Analysis FAILED\n\n`;
  report += `- **Duration**: ${result.durationMs}ms\n`;
  report += `- **Issues**: ${result.totalIssues} total (${result.errors} errors, ${result.warnings} warnings, ${infoIssues.length} info)\n\n`;

  if (errorIssues.length > 0) {
    report += `### Errors (${errorIssues.length})\n\n`;
    errorIssues.slice(0, 20).forEach(issue => {
      report += `- **${issue.file}:${issue.line}:${issue.column}** [${issue.source}/${issue.rule}]\n`;
      report += `  ${issue.message}\n`;
      if (issue.suggestion) {
        report += `  💡 Suggestion: ${issue.suggestion}\n`;
      }
      report += `\n`;
    });

    if (errorIssues.length > 20) {
      report += `... and ${errorIssues.length - 20} more errors\n\n`;
    }
  }

  if (warningIssues.length > 0) {
    const warningsToShow = warningIssues.slice(0, 5);
    report += `### Top Warnings (${warningsToShow.length} of ${warningIssues.length})\n\n`;
    warningsToShow.forEach(issue => {
      report += `- **${issue.file}:${issue.line}:${issue.column}** [${issue.source}/${issue.rule}]\n`;
      report += `  ${issue.message}\n\n`;
    });
  }

  return report;
}

/**
 * 判断文件是否应该扫描
 */
export function shouldScanImpl(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  // 检查扩展名
  const ext = extname(normalized).toLowerCase();
  const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  if (!validExtensions.includes(ext)) {
    return false;
  }

  // 排除目录
  const excludedPatterns = [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.trash/',
    '/__tests__/',
    '/test/',
    '/tests/',
    '/.dsxu/',
    '/.dsevo/',
    '/.git/',
    '/coverage/',
  ];

  for (const pattern of excludedPatterns) {
    if (normalized.includes(pattern)) {
      return false;
    }
  }

  // 排除隐藏文件（以 . 开头）
  const fileName = basename(normalized);
  if (fileName.startsWith('.')) {
    return false;
  }

  return true;
}

// 导出实现
export { runStaticGateImpl as runStaticGate, formatGateReportImpl as formatGateReport, shouldScanImpl as shouldScan };