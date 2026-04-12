/**
 * R5-22 · 静态分析前置桥（新版本）
 * 集成到 Executor 流程中，使用蒸馏协议接口
 */

import { runStaticGate, formatGateReport, StaticGateResult, StaticGateOptions } from './index';

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
  gateOptions?: StaticGateOptions; // 传递给 runStaticGate 的选项
}

const DEFAULT_OPTIONS: StaticAnalysisBridgeOptions = {
  enabled: true,
  failOnCritical: true,
  maxCriticalIssues: 0, // 默认不允许任何严重问题
  gateOptions: {
    shortCircuitOnError: true,
    maxDurationMs: 10000,
  },
};

/**
 * 静态分析桥接器（新版本）
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
    result: StaticGateResult;
    criticPrompt: string;
    shouldBlock: boolean;
    blockReason?: string;
  }> {
    if (!this.options.enabled) {
      console.log('[static-analysis] 静态分析已禁用，跳过');
      const emptyResult = await this.createEmptyResult();
      return {
        result: emptyResult,
        criticPrompt: '静态分析: 已禁用',
        shouldBlock: false,
      };
    }

    console.log(`[static-analysis] 开始分析 patch，涉及文件: ${patchInfo.filePaths.join(', ')}`);

    try {
      // 运行静态分析门
      const result = await runStaticGate(patchInfo.filePaths, this.options.gateOptions);

      // 格式化供 Critic prompt 使用
      const criticPrompt = this.formatForCriticPrompt(result);

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

      const errorResult = await this.createErrorResult(error);
      return {
        result: errorResult,
        criticPrompt: `静态分析: 执行失败 ❌\n错误: ${error.message}`,
        shouldBlock,
        blockReason,
      };
    }
  }

  /**
   * 检查是否需要阻止提交
   */
  private checkShouldBlock(result: StaticGateResult): {
    shouldBlock: boolean;
    blockReason?: string;
  } {
    if (!this.options.failOnCritical) {
      return { shouldBlock: false };
    }

    const criticalCount = result.errors;
    const maxCritical = this.options.maxCriticalIssues ?? 0;

    if (criticalCount > maxCritical) {
      return {
        shouldBlock: true,
        blockReason: `发现 ${criticalCount} 个错误级别问题（超过阈值 ${maxCritical}）`,
      };
    }

    // 检查是否有关键层完全失败
    const criticalLayers = ['tsc', 'eslint'] as const;
    const failedCriticalLayers = criticalLayers.filter(layer => {
      const layerResult = result.layers[layer];
      return !layerResult.passed && layerResult.issues.some(issue => issue.severity === 'error');
    });

    if (failedCriticalLayers.length > 0) {
      return {
        shouldBlock: true,
        blockReason: `关键分析层失败: ${failedCriticalLayers.join(', ')}`,
      };
    }

    return { shouldBlock: false };
  }

  /**
   * 格式化供 Critic prompt 使用
   */
  private formatForCriticPrompt(result: StaticGateResult): string {
    if (result.passed) {
      return `静态分析: 通过 ✅\n` +
             `- 耗时: ${result.durationMs}ms\n` +
             `- 问题: ${result.totalIssues} 个（${result.errors} 错误, ${result.warnings} 警告）`;
    }

    const errorIssues = result.issues.filter(issue => issue.severity === 'error');
    const warningIssues = result.issues.filter(issue => issue.severity === 'warning');

    let prompt = `静态分析: 失败 ❌\n`;
    prompt += `- 耗时: ${result.durationMs}ms\n`;
    prompt += `- 问题: ${result.totalIssues} 个（${result.errors} 错误, ${result.warnings} 警告）\n\n`;

    if (errorIssues.length > 0) {
      prompt += `### 错误问题（前 ${Math.min(errorIssues.length, 5)} 个）\n`;
      errorIssues.slice(0, 5).forEach((issue, i) => {
        prompt += `${i + 1}. **${issue.file}:${issue.line}:${issue.column}** [${issue.source}/${issue.rule}]\n`;
        prompt += `   ${issue.message}\n`;
        if (issue.suggestion) {
          prompt += `   💡 建议: ${issue.suggestion}\n`;
        }
        prompt += `\n`;
      });
    }

    if (warningIssues.length > 0 && errorIssues.length < 5) {
      const warningsToShow = Math.min(warningIssues.length, 5 - errorIssues.length);
      prompt += `### 警告问题（前 ${warningsToShow} 个）\n`;
      warningIssues.slice(0, warningsToShow).forEach((issue, i) => {
        prompt += `${i + 1}. **${issue.file}:${issue.line}:${issue.column}** [${issue.source}/${issue.rule}]\n`;
        prompt += `   ${issue.message}\n\n`;
      });
    }

    return prompt;
  }

  /**
   * 创建空结果
   */
  private async createEmptyResult(): Promise<StaticGateResult> {
    const startTime = Date.now();
    const emptyLayer = { passed: true, issues: [], durationMs: 0 };

    return {
      passed: true,
      totalIssues: 0,
      errors: 0,
      warnings: 0,
      issues: [],
      durationMs: Date.now() - startTime,
      layers: {
        astGrep: emptyLayer,
        tsc: emptyLayer,
        eslint: emptyLayer,
      },
    };
  }

  /**
   * 创建错误结果
   */
  private async createErrorResult(error: Error): Promise<StaticGateResult> {
    const startTime = Date.now();
    const errorLayer = {
      passed: false,
      issues: [{
        severity: 'error' as const,
        source: 'eslint' as const, // 任意源
        file: '',
        line: 0,
        column: 0,
        rule: 'gate.execution-error',
        message: `Static analysis execution failed: ${error.message}`,
      }],
      durationMs: 0,
    };

    return {
      passed: false,
      totalIssues: 1,
      errors: 1,
      warnings: 0,
      issues: errorLayer.issues,
      durationMs: Date.now() - startTime,
      layers: {
        astGrep: errorLayer,
        tsc: errorLayer,
        eslint: errorLayer,
      },
    };
  }

  /**
   * 获取分析摘要（用于日志/报告）
   */
  getAnalysisSummary(result: StaticGateResult): string {
    const parts: string[] = [];

    // 各层状态
    const layerStatus = Object.entries(result.layers).map(([layer, data]) => {
      const status = data.passed ? '✅' : '❌';
      const skipped = data.skipped ? '(skipped)' : '';
      return `${layer}: ${status}${skipped}`;
    }).join(', ');

    parts.push(`Layers: ${layerStatus}`);
    parts.push(`Issues: ${result.totalIssues} (❌${result.errors} ⚠️${result.warnings})`);
    parts.push(`Duration: ${result.durationMs}ms`);

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
    success: result.passed,
    issues: result.totalIssues,
    criticPrompt,
    shouldBlock,
  };
}