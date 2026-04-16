/**
 * MSA L2 Working — 工作记忆层
 *
 * 特性：
 * - 管理当前会话的活跃上下文 (4-5K tokens)
 * - 最近 N 轮完整对话 + 活跃文件摘要 + 任务状态
 * - 按优先级淘汰：低优先级条目先被挤出
 * - 每轮 API 调用前重新组装
 */

import type { L2Entry, L2WorkingConfig, L2Snapshot } from './types';

/** 默认配置 */
const DEFAULTS: Required<L2WorkingConfig> = {
  maxTokens: 4500,
  keepFullRounds: 3,
  maxActiveFiles: 5,
};

/** 简易 token 估算 */
function estimateTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    tokens += char.charCodeAt(0) > 0x7F ? 0.6 : 0.28;
  }
  return Math.ceil(tokens);
}

export class L2Working {
  private config: Required<L2WorkingConfig>;
  private entries: L2Entry[] = [];
  private conversationRounds: Array<{ user: string; assistant: string; ts: number }> = [];

  constructor(config?: L2WorkingConfig) {
    this.config = { ...DEFAULTS, ...config };
  }

  /**
   * 添加一轮完整对话
   */
  addConversationRound(user: string, assistant: string): void {
    this.conversationRounds.push({
      user,
      assistant,
      ts: Date.now(),
    });

    // 保留最近 N 轮完整对话
    if (this.conversationRounds.length > this.config.keepFullRounds) {
      const evicted = this.conversationRounds.shift()!;
      // 被淘汰的完整对话 → 压缩为摘要条目
      const summary = this.summarizeRound(evicted);
      this.addEntry({
        type: 'conversation',
        content: summary,
        tokens: estimateTokens(summary),
        priority: 3, // 摘要优先级较低
        ts: evicted.ts,
      });
    }
  }

  /**
   * 添加活跃文件上下文
   */
  addFileContext(filePath: string, relevantSnippet: string): void {
    // 去重：同一文件只保留最新
    this.entries = this.entries.filter(
      e => !(e.type === 'file_context' && e.content.startsWith(`[${filePath}]`))
    );

    const content = `[${filePath}]\n${relevantSnippet}`;
    this.addEntry({
      type: 'file_context',
      content,
      tokens: estimateTokens(content),
      priority: 6,
      ts: Date.now(),
    });

    // 限制活跃文件数
    const fileEntries = this.entries.filter(e => e.type === 'file_context');
    if (fileEntries.length > this.config.maxActiveFiles) {
      // 按时间淘汰最旧的
      const oldest = fileEntries.sort((a, b) => a.ts - b.ts)[0];
      this.entries = this.entries.filter(e => e !== oldest);
    }
  }

  /**
   * 更新当前任务状态
   */
  setTaskState(state: string): void {
    // 任务状态只保留一个 (最新的)
    this.entries = this.entries.filter(e => e.type !== 'task_state');
    this.addEntry({
      type: 'task_state',
      content: state,
      tokens: estimateTokens(state),
      priority: 8, // 任务状态优先级高
      ts: Date.now(),
    });
  }

  /**
   * 添加工具调用结果摘要
   */
  addToolResult(toolName: string, summary: string): void {
    const content = `[tool:${toolName}] ${summary}`;
    this.addEntry({
      type: 'tool_result',
      content,
      tokens: estimateTokens(content),
      priority: 5,
      ts: Date.now(),
    });
  }

  /**
   * 组装 L2 快照 — 在 token 预算内选择最高优先级的条目
   */
  build(budgetTokens?: number): L2Snapshot {
    const budget = budgetTokens ?? this.config.maxTokens;
    const sections: string[] = [];
    let totalTokens = 0;

    // 1. 完整对话轮次 (最高优先级，必须保留)
    const conversationText = this.buildConversationSection();
    const convTokens = estimateTokens(conversationText);
    if (convTokens > 0) {
      sections.push(conversationText);
      totalTokens += convTokens;
    }

    // 2. 按优先级排序其他条目
    const sorted = [...this.entries].sort((a, b) => {
      // 先按优先级降序
      if (b.priority !== a.priority) return b.priority - a.priority;
      // 同优先级按时间降序 (新的优先)
      return b.ts - a.ts;
    });

    let entryCount = 0;
    for (const entry of sorted) {
      if (totalTokens + entry.tokens > budget) {
        // 预算不够，跳过低优先级条目
        continue;
      }
      sections.push(entry.content);
      totalTokens += entry.tokens;
      entryCount++;
    }

    const text = sections.length > 0
      ? `<working_memory>\n${sections.join('\n---\n')}\n</working_memory>`
      : '';

    return {
      ts: Date.now(),
      text,
      estimatedTokens: totalTokens,
      entryCount: entryCount + (conversationText ? 1 : 0),
    };
  }

  /**
   * 构建完整对话部分
   */
  private buildConversationSection(): string {
    if (this.conversationRounds.length === 0) return '';

    const lines: string[] = ['<recent_conversation>'];
    for (const round of this.conversationRounds) {
      // 截断过长的单轮对话
      const userTrimmed = this.trimText(round.user, 500);
      const assistantTrimmed = this.trimText(round.assistant, 800);
      lines.push(`User: ${userTrimmed}`);
      lines.push(`Assistant: ${assistantTrimmed}`);
      lines.push('');
    }
    lines.push('</recent_conversation>');
    return lines.join('\n');
  }

  /**
   * 压缩一轮对话为摘要
   */
  private summarizeRound(round: { user: string; assistant: string; ts: number }): string {
    // 非语义摘要 — 提取关键信息
    const userKeywords = this.extractKeyInfo(round.user, 80);
    const assistantKeywords = this.extractKeyInfo(round.assistant, 120);
    const time = new Date(round.ts).toISOString().slice(11, 19);
    return `[${time}] Q: ${userKeywords} → A: ${assistantKeywords}`;
  }

  /**
   * 提取关键信息 (非语义，但比直接截断好)
   */
  private extractKeyInfo(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;

    // 策略：保留第一句 + 最后一句
    const sentences = text.split(/[。！？\.\!\?]\s*/);
    if (sentences.length <= 2) return text.slice(0, maxChars);

    const first = sentences[0].slice(0, Math.floor(maxChars * 0.6));
    const last = sentences[sentences.length - 1].slice(0, Math.floor(maxChars * 0.4));
    return `${first}...${last}`;
  }

  private trimText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3) + '...';
  }

  private addEntry(entry: L2Entry): void {
    this.entries.push(entry);
  }

  /** 获取当前条目数 */
  get entryCount(): number {
    return this.entries.length + this.conversationRounds.length;
  }

  /** 清空所有工作记忆 (会话结束时调用) */
  clear(): void {
    this.entries = [];
    this.conversationRounds = [];
  }

  /** 获取所有条目 (用于调试/测试) */
  getEntries(): L2Entry[] {
    return [...this.entries];
  }

  /** 获取完整对话轮次 (用于调试/测试) */
  getConversationRounds(): Array<{ user: string; assistant: string; ts: number }> {
    return [...this.conversationRounds];
  }
}
