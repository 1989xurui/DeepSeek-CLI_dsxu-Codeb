/**
 * #6.3 Session Persistence + #6.4 Multi-turn Conversation
 *
 * 会话管理模块 - 主入口文件
 *
 * 重构为三层架构：
 * 1. session-state.ts    - 状态管理层（数据持久化、上下文窗口）
 * 2. session-adapter.ts  - 模型适配层（摘要生成、记忆管理）
 * 3. session-output.ts   - 输出格式化层（报告生成、格式化输出）
 */

// 重新导出所有类型和类，保持向后兼容
export {
  SessionStore,
  ContextWindowManager,
  generateTitle,
} from './session-state'

export type {
  SessionMeta,
  SessionData,
  ContextWindowConfig,
} from './session-state'

export {
  SessionSummaryManager,
  AgentSummaryManager,
} from './session-adapter'

export type {
  SessionSummaryConfig,
  SessionMemoryNote,
} from './session-adapter'

export {
  SessionReportGenerator,
  generateSessionCard,
  generateSessionTable,
} from './session-output'

export type {
  SessionReportOptions,
  SessionReport,
} from './session-output'

// 类型重新导出
export type {
  Message,
  AgentSummary,
  AgentStatus,
  AgentSummaryConfig,
  QueryResult,
  QueryEvent,
} from './types'
