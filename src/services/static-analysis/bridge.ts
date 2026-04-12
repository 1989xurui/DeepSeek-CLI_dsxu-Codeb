/**
 * R5-22 · 静态分析前置桥
 * 集成到 Executor 流程中
 */

import { runStaticAnalysis, formatForCriticPrompt, getCriticalIssueCount, AnalysisResult } from './runner';

export interface PatchInfo {
  filePaths: string[];
  patchContent: string;
  commitHash?: string;
  author?: string;
  timestamp?: Date;
}

export interface StaticAnalysisBridgeOptions {
  enabled: boolean;
  failOnCritical?: boolean;  // 严重问题是否阻止提交
  maxCriticalIssues?: number; // 允许的最大严重问题数
  tools?: {
    tsc?: boolean;
    eslint?: boolean;
    semgrep?: boolean;
  };
}

const DEFAULT_OPTIONS: StaticAnalysisBridgeOptions = {
  enabled: true,
  failOnCritical: true,
  maxCriticalIssues: 0, // 默认不允许任何严重问题
  tools: {
    tsc: true,
    eslint: true,
    semgrep: true,
  },
};

/**
 * 静态分析桥接器
 */
export class StaticAnalysisBridge {
  private options: StaticAnalysisBridgeOptions;

  constructor(options: Partial<StaticAnalysisBridgeOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 在 Executor 生成 patch 后运行静态分析
   */
  async analyzeAfterPatch(patchInfo: PatchInfo): Promise<{
    result: AnalysisResult;
    criticPrompt: string;
    shouldBlock: boolean;
    blockReason?: string;
  }> {
    if (!this.options.enabled) {
      console.log('[static-analysis] 静态分析已禁用，跳过');
      return {
        result: { issues: [], durationMs: 0, toolsRun: [], failed: [] },
        criticPrompt: '静态分析: 已禁用',
        shouldBlock: false,
      };
    }

    console.log(`[static-analysis] 开始分析 patch，涉及文件: ${patchInfo.filePaths.join(', ')}`);

    try {
      // 运行静态分析
      const result = await runStaticAnalysis(patchInfo.filePaths);

      // 格式化供 Critic prompt 使用
      const criticPrompt = formatForCriticPrompt(result);

      // 检查是否需要阻止提交
      const { shouldBlock, blockReason } = this.checkShouldBlock(result);

      return {
        result,
        criticPrompt,
        shouldBlock,
        blockReason,
      };

    } catch (error: any) {
      console.error('[static-analysis] 静态分析失败:', error);

      // 分析失败时，根据配置决定是否阻止
      const shouldBlock = this.options.failOnCritical ?? true;
      const blockReason = shouldBlock ? '静态分析执行失败' : undefined;

      return {
        result: {
          issues: [],
          durationMs: 0,
          toolsRun: [],
          failed: ['all'],
        },
        criticPrompt: `静态分析: 执行失败 ❌\n错误: ${error.message}`,
        shouldBlock,
        blockReason,
      };
    }
  }

  /**
   * 检查是否需要阻止提交
   */
  private checkShouldBlock(result: AnalysisResult): {
    shouldBlock: boolean;
    blockReason?: string;
  } {
    if (!this.options.failOnCritical) {
      return { shouldBlock: false };
    }

    const criticalCount = getCriticalIssueCount(result);
    const maxCritical = this.options.maxCriticalIssues ?? 0;

    if (criticalCount > maxCritical) {
      return {
        shouldBlock: true,
        blockReason: `发现 ${criticalCount} 个严重问题（超过阈值 ${maxCritical}）`,
      };
    }

    // 检查是否有工具完全失败
    const criticalTools = ['tsc', 'semgrep'];
    const failedCriticalTools = result.failed.filter(tool =>
      criticalTools.includes(tool) && this.options.tools?.[tool as keyof typeof this.options.tools]
    );

    if (failedCriticalTools.length > 0) {
      return {
        shouldBlock: true,
        blockReason: `关键工具失败: ${failedCriticalTools.join(', ')}`,
      };
    }

    return { shouldBlock: false };
  }

  /**
   * 获取分析摘要（用于日志/报告）
   */
  getAnalysisSummary(result: AnalysisResult): string {
    const errorCount = result.issues.filter(i => i.severity === 'error').length;
    const warningCount = result.issues.filter(i => i.severity === 'warning').length;
    const infoCount = result.issues.filter(i => i.severity === 'info').length;

    const parts: string[] = [];
    parts.push(`工具: ${result.toolsRun.join(', ') || '无'}`);

    if (result.failed.length > 0) {
      parts.push(`失败: ${result.failed.join(', ')}`);
    }

    parts.push(`问题: ${result.issues.length} (❌${errorCount} ⚠️${warningCount} ℹ️${infoCount})`);
    parts.push(`耗时: ${result.durationMs}ms`);

    return parts.join(' | ');
  }

  /**
   * 更新配置
   */
  updateOptions(options: Partial<StaticAnalysisBridgeOptions>): void {
    this.options = { ...this.options, ...options };
    console.log('[static-analysis] 配置已更新:', this.options);
  }

  /**
   * 获取当前配置
   */
  getOptions(): StaticAnalysisBridgeOptions {
    return { ...this.options };
  }
}

/**
 * 创建默认的静态分析桥接器
 */
export function createStaticAnalysisBridge(
  options: Partial<StaticAnalysisBridgeOptions> = {}
): StaticAnalysisBridge {
  return new StaticAnalysisBridge(options);
}

/**
 * 快速分析函数（简化接口）
 */
export async function quickAnalyze(
  filePaths: string[],
  options?: Partial<StaticAnalysisBridgeOptions>
): Promise<{
  success: boolean;
  issues: number;
  criticPrompt: string;
  shouldBlock: boolean;
}> {
  const bridge = createStaticAnalysisBridge(options);
  const patchInfo: PatchInfo = { filePaths, patchContent: '' };

  const { result, criticPrompt, shouldBlock } = await bridge.analyzeAfterPatch(patchInfo);

  return {
    success: result.failed.length === 0,
    issues: result.issues.length,
    criticPrompt,
    shouldBlock,
  };
}