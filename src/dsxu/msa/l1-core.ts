/**
 * MSA L1 Core — 固定前缀记忆层
 *
 * 特性：
 * - 生成稳定的 system prompt 前缀
 * - 利用 DeepSeek 64-token block prefix cache (90% 成本折扣)
 * - 只在项目配置变更时重新生成
 * - 内容：项目身份 + 编码规范 + 核心工具定义
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import type { L1CoreConfig, L1Snapshot } from './types';

/** 默认 L1 最大 token 数 */
const DEFAULT_MAX_TOKENS = 2500;

/** 简易 token 估算 (中英混合) */
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    // 中文字符 ≈ 0.6 token, 英文 ≈ 0.28 token/char
    tokens += char.charCodeAt(0) > 0x7F ? 0.6 : 0.28;
  }
  return Math.ceil(tokens);
}

function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export class L1Core {
  private config: L1CoreConfig;
  private maxTokens: number;
  private cachedSnapshot: L1Snapshot | null = null;
  private cachedRulesContent: string | null = null;
  private cachedRulesModTime: number = 0;

  constructor(config: L1CoreConfig) {
    this.config = config;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  /**
   * 生成 L1 快照。如果内容未变，返回缓存。
   */
  async build(): Promise<L1Snapshot> {
    const rulesContent = await this.loadCodingRules();
    const prefix = this.assemblePrefix(rulesContent);
    const hash = hashContent(prefix);

    // 内容未变则返回缓存
    if (this.cachedSnapshot && this.cachedSnapshot.hash === hash) {
      return this.cachedSnapshot;
    }

    const estimatedTokens = estimateTokens(prefix);
    this.cachedSnapshot = {
      ts: Date.now(),
      prefix,
      estimatedTokens,
      hash,
    };

    return this.cachedSnapshot;
  }

  /**
   * 组装固定前缀。顺序固定 → 缓存友好。
   */
  private assemblePrefix(rulesContent: string | null): string {
    const sections: string[] = [];

    // Section 1: 项目身份 (最稳定，放最前面)
    sections.push(this.buildProjectIdentity());

    // Section 2: 编码规范 (变更频率低)
    if (rulesContent) {
      sections.push(this.buildCodingRules(rulesContent));
    }

    // Section 3: 自定义指令 (用户配置，稳定)
    if (this.config.customInstructions) {
      sections.push(`<custom_instructions>\n${this.config.customInstructions}\n</custom_instructions>`);
    }

    let prefix = sections.join('\n\n');

    // 截断到 token 限制
    const tokens = estimateTokens(prefix);
    if (tokens > this.maxTokens) {
      // 按比例截断，保留最重要的前段
      const ratio = this.maxTokens / tokens;
      const maxChars = Math.floor(prefix.length * ratio * 0.95); // 留 5% 余量
      prefix = prefix.slice(0, maxChars) + '\n[L1 truncated]';
    }

    return prefix;
  }

  private buildProjectIdentity(): string {
    const name = this.config.projectName ?? this.config.projectRoot.split(/[/\\]/).pop() ?? 'unknown';
    return [
      `<project_identity>`,
      `Project: ${name}`,
      `Root: ${this.config.projectRoot}`,
      `</project_identity>`,
    ].join('\n');
  }

  private buildCodingRules(content: string): string {
    // 截断过长的规范文件
    const maxRulesTokens = Math.floor(this.maxTokens * 0.5);
    const tokens = estimateTokens(content);
    let trimmed = content;
    if (tokens > maxRulesTokens) {
      const ratio = maxRulesTokens / tokens;
      const maxChars = Math.floor(content.length * ratio * 0.95);
      trimmed = content.slice(0, maxChars) + '\n[rules truncated]';
    }
    return `<coding_rules>\n${trimmed}\n</coding_rules>`;
  }

  /**
   * 加载编码规范文件 (带文件修改时间缓存)
   */
  private async loadCodingRules(): Promise<string | null> {
    if (!this.config.codingRulesPath) return null;

    const fullPath = join(this.config.projectRoot, this.config.codingRulesPath);
    try {
      const s = await stat(fullPath);
      // 文件未变则返回缓存
      if (this.cachedRulesContent && s.mtimeMs === this.cachedRulesModTime) {
        return this.cachedRulesContent;
      }
      this.cachedRulesContent = await readFile(fullPath, 'utf-8');
      this.cachedRulesModTime = s.mtimeMs;
      return this.cachedRulesContent;
    } catch {
      return null;
    }
  }

  /** 获取当前快照 (不触发重建) */
  getCached(): L1Snapshot | null {
    return this.cachedSnapshot;
  }

  /** 强制失效缓存 */
  invalidate(): void {
    this.cachedSnapshot = null;
    this.cachedRulesContent = null;
  }
}
