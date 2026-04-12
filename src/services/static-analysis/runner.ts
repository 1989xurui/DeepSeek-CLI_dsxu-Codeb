/**
 * R5-22 · 静态分析前置桥
 *
 * 每次 Executor 出 patch 后，强制跑 tsc --noEmit + eslint + semgrep --config=p/security
 * 错误以结构化 JSON 回灌到 Critic prompt
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { parseTscOutput } from './parsers/tsc';
import { parseEslintOutput } from './parsers/eslint';
import { parseSemgrepOutput } from './parsers/semgrep';

const exec = promisify(spawn);

export interface StaticIssue {
  tool: 'tsc' | 'eslint' | 'semgrep';
  severity: 'error' | 'warning' | 'info';
  file: string;
  line: number;
  col: number;
  ruleId?: string;
  message: string;
}

export interface AnalysisResult {
  issues: StaticIssue[];
  durationMs: number;
  toolsRun: string[];
  failed: string[];   // 工具运行失败的列表
}

export interface ToolConfig {
  enabled: boolean;
  command: string;
  args: string[];
  parser: (output: string, cwd: string) => StaticIssue[];
  timeoutMs: number;
}

// 工具配置
const TOOLS: Record<string, ToolConfig> = {
  tsc: {
    enabled: true,
    command: 'npx',
    args: ['tsc', '--noEmit', '--pretty', 'false'],
    parser: parseTscOutput,
    timeoutMs: 30000,
  },
  eslint: {
    enabled: true,
    command: 'npx',
    args: ['eslint', '--format', 'json', '--no-eslintrc', '--config', '.eslintrc.json'],
    parser: parseEslintOutput,
    timeoutMs: 30000,
  },
  semgrep: {
    enabled: true,
    command: 'semgrep',
    args: ['--config', 'p/security', '--json'],
    parser: parseSemgrepOutput,
    timeoutMs: 60000,
  },
};

/**
 * 运行静态分析工具
 */
async function runTool(
  toolName: string,
  config: ToolConfig,
  filePaths: string[],
  cwd: string
): Promise<StaticIssue[]> {
  if (!config.enabled) {
    console.log(`[static-analysis] ${toolName} 已禁用，跳过`);
    return [];
  }

  const startTime = Date.now();
  const args = [...config.args];

  // 如果是 eslint 或 tsc，添加文件路径
  if (toolName === 'eslint' || toolName === 'tsc') {
    args.push(...filePaths);
  }
  // semgrep 会自动扫描目录，不需要指定文件

  console.log(`[static-analysis] 运行 ${toolName}: ${config.command} ${args.join(' ')}`);

  try {
    const { stdout, stderr } = await exec(config.command, args, {
      cwd,
      timeout: config.timeoutMs,
      stdio: 'pipe',
      shell: true,
    });

    const output = stdout.toString() + stderr.toString();
    const issues = config.parser(output, cwd);
    const duration = Date.now() - startTime;

    console.log(`[static-analysis] ${toolName} 完成: ${duration}ms, 发现 ${issues.length} 个问题`);
    return issues;

  } catch (error: any) {
    // 工具执行失败（如未安装、超时等）
    console.error(`[static-analysis] ${toolName} 执行失败:`, error.message);

    // 如果是 semgrep 未安装，返回空数组而不是失败
    if (toolName === 'semgrep' && error.message.includes('command not found')) {
      console.warn('[static-analysis] semgrep 未安装，跳过安全检查');
      return [];
    }

    // 其他错误，抛出异常
    throw new Error(`${toolName} 执行失败: ${error.message}`);
  }
}

/**
 * 检查工具是否可用
 */
async function checkToolAvailability(toolName: string, config: ToolConfig): Promise<boolean> {
  if (!config.enabled) return true;

  try {
    // 简单版本检查
    await exec(config.command, ['--version'], {
      stdio: 'pipe',
      timeout: 5000,
      shell: true,
    });
    return true;
  } catch (error) {
    console.warn(`[static-analysis] ${toolName} 不可用:`, error);
    return false;
  }
}

/**
 * 运行静态分析
 */
export async function runStaticAnalysis(filePaths: string[]): Promise<AnalysisResult> {
  const startTime = Date.now();
  const cwd = process.cwd();
  const issues: StaticIssue[] = [];
  const toolsRun: string[] = [];
  const failed: string[] = [];

  console.log(`[static-analysis] 开始分析 ${filePaths.length} 个文件`);

  // 检查工具可用性
  const availableTools: string[] = [];
  for (const [toolName, config] of Object.entries(TOOLS)) {
    const isAvailable = await checkToolAvailability(toolName, config);
    if (isAvailable) {
      availableTools.push(toolName);
    } else {
      failed.push(toolName);
      console.warn(`[static-analysis] ${toolName} 不可用，跳过`);
    }
  }

  // 运行可用工具
  for (const toolName of availableTools) {
    const config = TOOLS[toolName];
    try {
      const toolIssues = await runTool(toolName, config, filePaths, cwd);
      issues.push(...toolIssues);
      toolsRun.push(toolName);
    } catch (error: any) {
      failed.push(toolName);
      console.error(`[static-analysis] ${toolName} 分析失败:`, error.message);
    }
  }

  const durationMs = Date.now() - startTime;

  // 按严重性排序：error > warning > info
  issues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const result: AnalysisResult = {
    issues,
    durationMs,
    toolsRun,
    failed,
  };

  console.log(`[static-analysis] 分析完成: ${durationMs}ms, 工具: ${toolsRun.join(', ')}, 问题: ${issues.length}, 失败: ${failed.length}`);
  return result;
}

/**
 * 格式化分析结果供 Critic prompt 使用
 */
export function formatForCriticPrompt(result: AnalysisResult): string {
  if (result.issues.length === 0) {
    return '静态分析: 未发现问题 ✅';
  }

  const sections: string[] = [];
  sections.push('# 静态分析报告');

  // 按工具分组
  const byTool: Record<string, StaticIssue[]> = {};
  for (const issue of result.issues) {
    if (!byTool[issue.tool]) byTool[issue.tool] = [];
    byTool[issue.tool].push(issue);
  }

  for (const [tool, toolIssues] of Object.entries(byTool)) {
    sections.push(`\n## ${tool.toUpperCase()}`);

    // 按严重性分组
    const bySeverity: Record<string, StaticIssue[]> = {};
    for (const issue of toolIssues) {
      if (!bySeverity[issue.severity]) bySeverity[issue.severity] = [];
      bySeverity[issue.severity].push(issue);
    }

    for (const [severity, severityIssues] of Object.entries(bySeverity)) {
      const emoji = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';
      sections.push(`\n### ${emoji} ${severity.toUpperCase()} (${severityIssues.length})`);

      for (const issue of severityIssues.slice(0, 10)) { // 最多显示10个
        const location = issue.line > 0 ? `:${issue.line}:${issue.col}` : '';
        const ruleInfo = issue.ruleId ? ` [${issue.ruleId}]` : '';
        sections.push(`- \`${issue.file}${location}\`${ruleInfo}: ${issue.message}`);
      }

      if (severityIssues.length > 10) {
        sections.push(`- ... 还有 ${severityIssues.length - 10} 个 ${severity} 未显示`);
      }
    }
  }

  // 统计信息
  sections.push('\n## 统计信息');
  sections.push(`- 运行工具: ${result.toolsRun.join(', ') || '无'}`);
  sections.push(`- 失败工具: ${result.failed.join(', ') || '无'}`);
  sections.push(`- 总问题数: ${result.issues.length}`);
  sections.push(`- 错误: ${result.issues.filter(i => i.severity === 'error').length}`);
  sections.push(`- 警告: ${result.issues.filter(i => i.severity === 'warning').length}`);
  sections.push(`- 信息: ${result.issues.filter(i => i.severity === 'info').length}`);
  sections.push(`- 耗时: ${result.durationMs}ms`);

  // 建议
  sections.push('\n## 修复建议');
  sections.push('1. 优先修复 ❌ 错误（阻止编译/运行的问题）');
  sections.push('2. 处理 ⚠️ 警告（潜在问题、代码风格）');
  sections.push('3. 检查 ℹ️ 信息（建议性改进）');
  sections.push('4. 对于安全相关问题（semgrep），必须立即处理');

  return sections.join('\n');
}

/**
 * 获取严重问题数量（用于决策是否阻止提交）
 */
export function getCriticalIssueCount(result: AnalysisResult): number {
  return result.issues.filter(issue =>
    issue.severity === 'error' ||
    (issue.tool === 'semgrep' && issue.severity === 'warning')
  ).length;
}