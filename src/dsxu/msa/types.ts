/**
 * MSA (Memory Storage Architecture) — 三级分层记忆类型定义
 *
 * L1 Core   (2-3K tok): 固定前缀，项目身份 + 编码规范 + 工具定义。100% 缓存命中。
 * L2 Working (4-5K tok): 近期对话 diff、活跃文件上下文、当前任务状态。每轮变化。
 * L3 Archive (SQLite ∞): 历史经验、代码模式、已解决问题。按需语义检索。
 *
 * 总 API 请求 ≤ 8K token，但拥有无限记忆。
 */

// ── L1 Core ──

export interface L1CoreConfig {
  /** 项目根路径 */
  projectRoot: string;
  /** 项目名称 */
  projectName?: string;
  /** 编码规范文件路径 (相对项目根) */
  codingRulesPath?: string;
  /** 自定义固定指令 */
  customInstructions?: string;
  /** L1 最大 token 数 (默认 2500) */
  maxTokens?: number;
}

export interface L1Snapshot {
  /** 生成时间戳 */
  ts: number;
  /** 固定前缀文本 (给 DeepSeek cache 用) */
  prefix: string;
  /** 预估 token 数 */
  estimatedTokens: number;
  /** 内容 hash (用于检测变更) */
  hash: string;
}

// ── L2 Working ──

export interface L2WorkingConfig {
  /** L2 最大 token 数 (默认 4500) */
  maxTokens?: number;
  /** 最大保留的完整对话轮数 (默认 3) */
  keepFullRounds?: number;
  /** 活跃文件上下文最大条目 (默认 5) */
  maxActiveFiles?: number;
}

export interface L2Entry {
  /** 条目类型 */
  type: 'conversation' | 'file_context' | 'task_state' | 'tool_result';
  /** 内容 */
  content: string;
  /** 预估 token 数 */
  tokens: number;
  /** 优先级 (0-10, 10=最高) */
  priority: number;
  /** 创建时间 */
  ts: number;
}

export interface L2Snapshot {
  /** 生成时间戳 */
  ts: number;
  /** 组装后的工作记忆文本 */
  text: string;
  /** 预估 token 数 */
  estimatedTokens: number;
  /** 包含的条目数 */
  entryCount: number;
}

// ── L3 Archive ──

export interface L3ArchiveConfig {
  /** SQLite 数据库路径 (默认 .dsxu/msa-archive.db) */
  dbPath?: string;
  /** 嵌入函数 (生产用真实嵌入，测试用 mock) */
  embedFn?: (texts: string[]) => Promise<number[][]>;
  /** 嵌入维度 (默认 8, 真实嵌入用 1024) */
  embeddingDim?: number;
  /** 检索时最大返回条目 (默认 3) */
  defaultTopK?: number;
  /** 最低相关度阈值 (默认 0.6) */
  minRelevance?: number;
}

export interface L3Record {
  /** 唯一 ID */
  id: string;
  /** 存储时间 */
  ts: number;
  /** 记录类型 */
  type: 'experience' | 'pattern' | 'resolution' | 'conversation_summary';
  /** 任务/场景描述 (用于检索) */
  description: string;
  /** 完整内容 */
  content: string;
  /** 嵌入向量 */
  embedding: number[];
  /** 质量分数 (0-1) */
  quality: number;
  /** 被检索引用次数 */
  retrievalCount: number;
  /** 最后检索时间 */
  lastRetrievedAt: number | null;
  /** 用户反馈分数 */
  helpfulness: number | null;
  /** 来源标签 */
  source: string;
}

export type L3RecordInput = Omit<L3Record, 'id' | 'embedding' | 'retrievalCount' | 'lastRetrievedAt'>;

// ── MSA Orchestrator ──

export interface MSAConfig {
  l1: L1CoreConfig;
  l2?: L2WorkingConfig;
  l3?: L3ArchiveConfig;
  /** 总 token 预算 (默认 8000) */
  totalBudget?: number;
}

export interface MSAContext {
  /** L1 固定前缀 */
  l1: L1Snapshot;
  /** L2 工作记忆 */
  l2: L2Snapshot;
  /** L3 检索结果 (已格式化) */
  l3Results: string;
  /** L3 检索结果 token 数 */
  l3Tokens: number;
  /** 总 token 数 */
  totalTokens: number;
  /** 是否超预算 */
  overBudget: boolean;
}
