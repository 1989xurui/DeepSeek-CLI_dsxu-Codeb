/**
 * #6.3 Session Persistence + #6.4 Multi-turn Conversation
 *
 * 会话管理模块 - 主入口文件
 *
 * 重构为三层架构：
 * 1. session-state.ts    - 状态管理层（数据持久化、上下文窗口）
 * 2. session-adapter.ts  - 模型适配层（摘要生成、记忆管理）
 * 3. session-output.ts   - 输出格式化层（报告生成、格式化输出）
 *
 * Runtime Core: integrated Session/Task model.
 */

import type { Message } from './types'
import { SessionStore } from './session-state'
import type { SessionData } from './session-state'
import { SessionSummaryManager } from './session-adapter'
import { SessionReportGenerator } from './session-output'
import { createDSXUSessionStateMachine } from './session-os-control'

// === 向后兼容导出 ===

// 重新导出原有session模块
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

// === Runtime Core exports ===

// Session 模型
export {
  createSession,
  updateSession,
  validateSession,
  type Session,
  type SessionStatus,
  type SessionFilter,
  type CreateSessionParams,
  type UpdateSessionParams
} from './runtime/session/model'

// Task 模型
export {
  createTask,
  updateTask,
  createTaskResult,
  createTaskError,
  createResumePoint,
  validateTask,
  type Task,
  type TaskStatus,
  type TaskResult,
  type TaskError,
  type ResumePoint,
  type TaskFilter,
  type CreateTaskParams,
  type UpdateTaskParams
} from './runtime/task/model'

// Persist 适配器
export {
  createPersistAdapter,
  type PersistAdapter,
  type PersistConfig,
  DEFAULT_PERSIST_CONFIG
} from './runtime/persist/adapter'

// Runtime Core 工厂函数
export {
  createRuntimeCore
} from './runtime/index'

// === H-4R: Session/Memory 增强类型 ===

/** 记忆分类 */
export type MemoryCategory = 'bug' | 'decision' | 'task-state' | 'repo-context' | 'recovery-history' | 'technical-pattern' | 'user-preference'

/** 提取的记忆 */
export interface ExtractedMemory {
  /** 记忆ID */
  id: string
  /** 分类 */
  category: MemoryCategory
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 置信度 (0-1) */
  confidence: number
  /** 关联文件 */
  relatedFiles: string[]
  /** 时间戳 */
  timestamp: number
  /** 来源消息索引 */
  sourceMessageIndices: number[]
  /** 元数据 */
  metadata: Record<string, any>
}

/** 记忆索引提示 */
export interface MemoryIndexHint {
  /** 提示类型 */
  type: 'category' | 'file' | 'time' | 'confidence'
  /** 提示值 */
  value: string | number
  /** 权重 */
  weight: number
}

/** 会话快照 */
export interface SessionSnapshot {
  /** 会话ID */
  sessionId: string
  /** 快照时间戳 */
  timestamp: number
  /** 会话状态 */
  status: 'active' | 'paused' | 'completed' | 'error'
  /** 消息统计 */
  messageStats: {
    total: number
    user: number
    assistant: number
    tool: number
    system: number
  }
  /** 压缩状态 */
  compactState?: {
    compacted: boolean
    compactType?: string
    tokensBefore?: number
    tokensAfter?: number
    metadata?: any
  }
  /** 上下文卫生状态 */
  hygieneState?: {
    riskLevel: 'none' | 'low' | 'medium' | 'high'
    issuesCount: number
    lastCheckTime: number
    suggestedActions: string[]
  }
  /** 提取的记忆 */
  extractedMemories: ExtractedMemory[]
  /** 记忆分类统计 */
  memoryCategoryStats: Record<MemoryCategory, number>
  /** 恢复提示 */
  resumeHints: SessionResumeHint[]
  /** 会话质量评分 (0-100) */
  qualityScore: number
}

// === A-2A: KAIROS Session OS 类型 ===

/** 会话检查点 */
export interface SessionCheckpoint {
  /** 检查点ID */
  checkpointId: string
  /** 会话ID */
  sessionId: string
  /** 创建时间戳 */
  timestamp: number
  /** 快照数据 */
  snapshot: SessionSnapshot
  /** 恢复状态 */
  resumeState: {
    /** 是否可继续 */
    canContinue: boolean
    /** 恢复提示 */
    resumeHint: ResumeHint
    /** 恢复决策 */
    continuationDecision: SessionContinuationDecision
  }
  /** 元数据 */
  metadata: Record<string, any>
}

/** 恢复提示 */
export interface ResumeHint {
  /** 提示类型 */
  type: 'continue' | 'resume' | 'restart' | 'review'
  /** 提示内容 */
  content: string
  /** 优先级 */
  priority: 'low' | 'medium' | 'high'
  /** 相关位置 */
  location?: {
    /** 时间戳 */
    timestamp: number
    /** 消息索引 */
    messageIndex?: number
    /** 文件路径 */
    filePath?: string
  }
  /** 建议动作 */
  suggestedAction: 'continueSession' | 'resumeSessionId' | 'createNewSession'
}

/** 会话继续决策 */
export interface SessionContinuationDecision {
  /** 决策类型 */
  decisionType: 'continue' | 'resume' | 'restart'
  /** 会话ID */
  sessionId: string
  /** 检查点ID */
  checkpointId?: string
  /** 恢复输入 */
  resumeInput: ResumeSessionInput
  /** 置信度 (0-1) */
  confidence: number
  /** 理由 */
  reason: string
}

/** 恢复会话输入 */
export interface ResumeSessionInput {
  /** 输入类型 */
  inputType: 'continueSession' | 'resumeSessionId'
  /** 会话ID */
  sessionId: string
  /** 检查点ID */
  checkpointId?: string
  /** 恢复参数 */
  params: {
    /** 是否从检查点恢复 */
    fromCheckpoint?: boolean
    /** 恢复的消息范围 */
    messageRange?: [number, number]
    /** 恢复的文件状态 */
    restoreFileState?: boolean
    /** 恢复的记忆 */
    restoreMemories?: boolean
  }
}

/** 持久化会话状态 */
export interface PersistentSessionState {
  /** 会话ID */
  sessionId: string
  /** 最后活动时间 */
  lastActivityTime: number
  /** 会话状态 */
  sessionState: 'active' | 'paused' | 'completed' | 'error'
  /** 检查点列表 */
  checkpoints: SessionCheckpoint[]
  /** 当前检查点ID */
  currentCheckpointId?: string
  /** 恢复历史 */
  resumeHistory: Array<{
    timestamp: number
    checkpointId: string
    resumeType: 'continue' | 'resume' | 'restart'
    success: boolean
  }>
  /** 长任务恢复线索 */
  longTaskContinuation?: {
    /** 任务ID */
    taskId: string
    /** 最后步骤 */
    lastStep: number
    /** 待完成步骤 */
    pendingSteps: Array<{
      stepId: string
      description: string
      status: 'pending' | 'in_progress' | 'completed'
    }>
    /** 恢复上下文 */
    resumeContext: Record<string, any>
  }
}

/** 会话摘要 */
export interface SessionSummary {
  /** 会话ID */
  sessionId: string
  /** 创建时间 */
  createdAt: number
  /** 最后更新时间 */
  updatedAt: number
  /** 会话标题 */
  title: string
  /** 工作目录 */
  cwd: string
  /** 状态 */
  status: 'active' | 'paused' | 'completed' | 'error'
  /** 关键里程碑 */
  milestones: Array<{
    timestamp: number
    description: string
    type: 'task_start' | 'task_complete' | 'error' | 'decision' | 'breakthrough'
    metadata?: Record<string, any>
  }>
  /** 压缩历史 */
  compactHistory: Array<{
    timestamp: number
    compactType: string
    tokensSaved: number
    level: string
    qualityScore?: number
  }>
  /** 记忆分类统计 */
  memoryStats: Record<MemoryCategory, number>
  /** 上下文卫生历史 */
  hygieneHistory: Array<{
    timestamp: number
    riskLevel: 'none' | 'low' | 'medium' | 'high'
    issuesCount: number
    suggestedActions: string[]
  }>
  /** 可恢复性评分 (0-100) */
  recoverabilityScore: number
  /** 上下文质量评分 (0-100) */
  contextQualityScore: number
  /** 记忆提取质量评分 (0-100) */
  memoryQualityScore: number
  /** 恢复提示摘要 */
  resumeHintSummary: string[]
}

/** 会话恢复提示 */
export interface SessionResumeHint {
  /** 提示类型 */
  type: 'context' | 'task' | 'memory' | 'risk' | 'suggestion'
  /** 提示内容 */
  content: string
  /** 优先级 */
  priority: 'low' | 'medium' | 'high'
  /** 相关位置 */
  location?: {
    messageIndex?: number
    timestamp?: number
  }
}

// === 类型重新导出 ===
export type {
  Message,
  AgentSummary,
  AgentStatus,
  AgentSummaryConfig,
  QueryResult,
  QueryEvent,
} from './types'

// === DSXU Session OS 导出 ===
export {
  createDSXUSessionStateMachine,
  createDSXUSessionStateMachine as createKairosSessionStateMachine,
  generateStructuredResumeHint,
  shouldContinueDSXUSession,
  shouldContinueDSXUSession as shouldContinueSession,
  shouldResumeDSXUSessionId,
  shouldResumeDSXUSessionId as shouldResumeSessionId,
} from './session-os-control'

export type {
  DSXUSessionOSOptions,
  DSXUSessionStateMachine,
  DSXUSessionStateMachine as KairosSessionStateMachine,
} from './session-os-control'

// ===== Coordinator Mainline Session State =====

export interface MainlineSessionCoordinatorState {
  runtimeState: {
    taskId: string;
    overallStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
    agents: Array<{ agentId: string; role: string; status: string }>;
    updatedAt: number;
  };
  latestCheckpoint?: {
    checkpointId: string;
    taskId: string;
    lifecycleState: string;
    branchSnapshot: Record<string, string>;
    notes: string[];
    createdAt: number;
  };
  lifecycleSummary?: {
    taskId: string;
    totalBranches: number;
    completedBranches: number;
    failedBranches: number;
    abortedBranches: number;
    escalationCount: number;
    generatedAt: number;
  };
  recoveryHints: Array<{ hintId: string; stage: string; title: string; priority: string }>;
}

export function createMainlineSessionCoordinatorState(taskId: string): MainlineSessionCoordinatorState {
  return {
    runtimeState: {
      taskId,
      overallStatus: 'pending',
      agents: [],
      updatedAt: Date.now(),
    },
    recoveryHints: [],
  };
}

export function applyCoordinatorProtocolToSession(
  current: MainlineSessionCoordinatorState,
  protocol: {
    taskId: string;
    checkpoints: Array<{
      checkpointId: string;
      taskId: string;
      lifecycleState: string;
      branchSnapshot: Record<string, string>;
      notes: string[];
      createdAt: number;
    }>;
    summary: {
      taskId: string;
      totalBranches: number;
      completedBranches: number;
      failedBranches: number;
      abortedBranches: number;
      escalationCount: number;
      generatedAt: number;
    };
    recoveryHints: Array<{ hintId: string; stage: string; title: string; priority: string }>;
    branchStates: Record<string, { role: string; status: string }>;
  },
): MainlineSessionCoordinatorState {
  const agents = Object.entries(protocol.branchStates).map(([agentId, v]) => ({
    agentId,
    role: v.role,
    status: v.status,
  }));

  return {
    runtimeState: {
      taskId: protocol.taskId,
      overallStatus: protocol.summary.failedBranches > 0 ? 'failed' : 'in-progress',
      agents,
      updatedAt: Date.now(),
    },
    latestCheckpoint: protocol.checkpoints[protocol.checkpoints.length - 1],
    lifecycleSummary: protocol.summary,
    recoveryHints: [...protocol.recoveryHints],
  };
}

// ===== Skills Session Mainline State =====

export interface SkillPromptSessionState {
  taskId: string;
  invocation: {
    planId: string;
    selectedSkillIds: string[];
    status: 'planned' | 'running' | 'completed' | 'failed';
  };
  promptSnapshot: {
    stackId: string;
    summary: string;
    selectedFragments: string[];
  };
  resolutionTrace: {
    reasons: string[];
    discardedSkillIds: string[];
  };
}

export function createSkillPromptSessionState(taskId: string): SkillPromptSessionState {
  return {
    taskId,
    invocation: { planId: '', selectedSkillIds: [], status: 'planned' },
    promptSnapshot: { stackId: '', summary: '', selectedFragments: [] },
    resolutionTrace: { reasons: [], discardedSkillIds: [] },
  };
}

export function applySkillPromptToSession(
  _current: SkillPromptSessionState,
  input: {
    planId: string;
    selectedSkillIds: string[];
    promptStackId: string;
    finalPrompt: string;
    selectedFragments: string[];
    reasons: string[];
    discardedSkillIds: string[];
  },
): SkillPromptSessionState {
  return {
    taskId: _current.taskId,
    invocation: {
      planId: input.planId,
      selectedSkillIds: input.selectedSkillIds,
      status: input.selectedSkillIds.length > 0 ? 'running' : 'failed',
    },
    promptSnapshot: {
      stackId: input.promptStackId,
      summary: input.finalPrompt.slice(0, 120),
      selectedFragments: input.selectedFragments,
    },
    resolutionTrace: {
      reasons: input.reasons,
      discardedSkillIds: input.discardedSkillIds,
    },
  };
}

// ===== Tool Mainline Session State =====

export interface ToolMainlineSessionState {
  taskId: string;
  invocation: {
    selectedToolIds: string[];
    status: 'planned' | 'running' | 'completed' | 'failed';
  };
  executionSnapshot: {
    gateDecisions: Array<{ toolId: string; decision: string; riskLevel: string }>;
    executionResults: Array<{ toolId: string; status: string; summary: string }>;
  };
  summary: {
    blockedCount: number;
    failureCount: number;
    criticalCount: number;
  };
  traces: {
    approvalTraceIds: string[];
    failureTrace: string[];
  };
}

export function createToolMainlineSessionState(taskId: string): ToolMainlineSessionState {
  return {
    taskId,
    invocation: { selectedToolIds: [], status: 'planned' },
    executionSnapshot: { gateDecisions: [], executionResults: [] },
    summary: { blockedCount: 0, failureCount: 0, criticalCount: 0 },
    traces: { approvalTraceIds: [], failureTrace: [] },
  };
}

export function applyToolMainlineToSession(
  _current: ToolMainlineSessionState,
  input: {
    selectedToolIds: string[];
    gateDecisions: Array<{ toolId: string; decision: string; riskLevel: string; approvalTraceId: string }>;
    executionResults: Array<{ toolId: string; status: 'succeeded' | 'failed' | 'blocked'; summary: string }>;
  },
): ToolMainlineSessionState {
  const blockedCount = input.gateDecisions.filter((x) => x.decision === 'block').length;
  const criticalCount = input.gateDecisions.filter((x) => x.riskLevel === 'critical').length;
  const failureItems = input.executionResults.filter((x) => x.status === 'failed');

  return {
    taskId: _current.taskId,
    invocation: {
      selectedToolIds: [...input.selectedToolIds],
      status: failureItems.length > 0 ? 'failed' : input.executionResults.length > 0 ? 'running' : 'planned',
    },
    executionSnapshot: {
      gateDecisions: [...input.gateDecisions],
      executionResults: [...input.executionResults],
    },
    summary: {
      blockedCount,
      failureCount: failureItems.length,
      criticalCount,
    },
    traces: {
      approvalTraceIds: input.gateDecisions.map((x) => x.approvalTraceId),
      failureTrace: failureItems.map((x) => `${x.toolId}:${x.summary}`),
    },
  };
}

// ===== Phase A Multi-Agent Session Bridge =====
export function attachMultiAgentStateToSession(
  current: MainlineSessionCoordinatorState,
  input: {
    taskId: string;
    roleAssignments: Array<{ subtaskId: string; assignedRole: string; rationale: string }>;
    lifecycleState?: string;
  },
): MainlineSessionCoordinatorState {
  const agents = input.roleAssignments.map((r) => ({
    agentId: r.subtaskId,
    role: r.assignedRole,
    status: input.lifecycleState || 'in-progress',
  }));
  return {
    ...current,
    runtimeState: {
      taskId: input.taskId,
      overallStatus: 'in-progress',
      agents,
      updatedAt: Date.now(),
    },
  };
}

// ===== Phase B Task Lifecycle Session Consumption =====
export interface SessionTaskLifecycleState {
  activeTaskIds: string[];
  completedTaskIds: string[];
  stoppedTaskIds: string[];
  latestTaskEvent?: { taskId: string; status: string; summary: string };
}

export function createSessionTaskLifecycleState(): SessionTaskLifecycleState {
  return { activeTaskIds: [], completedTaskIds: [], stoppedTaskIds: [] };
}

export function applyTaskLifecycleToSession(
  state: SessionTaskLifecycleState,
  event: { taskId: string; status: 'running' | 'completed' | 'failed' | 'stopped'; summary: string },
): SessionTaskLifecycleState {
  const active = new Set(state.activeTaskIds);
  const completed = new Set(state.completedTaskIds);
  const stopped = new Set(state.stoppedTaskIds);

  if (event.status === 'running') active.add(event.taskId);
  if (event.status === 'completed' || event.status === 'failed') {
    active.delete(event.taskId);
    completed.add(event.taskId);
  }
  if (event.status === 'stopped') {
    active.delete(event.taskId);
    stopped.add(event.taskId);
  }

  return {
    activeTaskIds: [...active],
    completedTaskIds: [...completed],
    stoppedTaskIds: [...stopped],
    latestTaskEvent: { taskId: event.taskId, status: event.status, summary: event.summary },
  };
}

// ===== Phase C Context Session State =====
export interface SessionContextWindowState {
  model: string;
  contextWindowSize: number;
  usedPercent: number;
  autoCompactTriggered: boolean;
  compactionStrategy: 'none' | 'light' | 'aggressive';
}

export function createSessionContextWindowState(model: string, contextWindowSize: number): SessionContextWindowState {
  return {
    model,
    contextWindowSize,
    usedPercent: 0,
    autoCompactTriggered: false,
    compactionStrategy: 'none',
  };
}

export function applyContextWindowToSession(
  state: SessionContextWindowState,
  input: { usedPercent: number; autoCompactTriggered: boolean; compactionStrategy: 'none' | 'light' | 'aggressive' },
): SessionContextWindowState {
  return {
    ...state,
    usedPercent: input.usedPercent,
    autoCompactTriggered: input.autoCompactTriggered,
    compactionStrategy: input.compactionStrategy,
  };
}

// ===== Phase D Session Evidence Hook =====
export function recordSessionMainlineConsumption(input: {
  signalType: string;
  detail: string;
}): { module: 'session'; signalType: string; detail: string } {
  return { module: 'session', signalType: input.signalType, detail: input.detail };
}

export interface DSXUSessionMainlineBundleInput {
  baseDir: string
  cwd: string
  title: string
  taskId: string
  runId?: string
  messages: Message[]
}

export interface DSXUSessionMainlineBundle {
  session: SessionData
  checkpoint: SessionCheckpoint
  persistentState: PersistentSessionState
  summary: string | null
  report: SessionReport | null
  stats: Record<string, any> | null
  evidence: { module: 'session'; signalType: string; detail: string }
}

export async function createDSXUSessionMainlineBundle(
  input: DSXUSessionMainlineBundleInput,
): Promise<DSXUSessionMainlineBundle> {
  const store = new SessionStore(input.baseDir)
  const session = store.create(input.cwd, input.title)
  for (const message of input.messages) {
    store.appendMessage(session.meta.id, message)
  }

  const loadedSession = store.load(session.meta.id)
  if (!loadedSession) {
    throw new Error(`failed to load session ${session.meta.id}`)
  }

  const summaryManager = new SessionSummaryManager({
    enabled: true,
    updateInterval: 1,
    maxLength: 1000,
  })
  await summaryManager.updateSessionSummary(store, session.meta.id, loadedSession.messages, loadedSession.messages.length, true)

  const updatedSession = store.load(session.meta.id)
  if (!updatedSession) {
    throw new Error(`failed to reload session ${session.meta.id}`)
  }

  const reportGenerator = new SessionReportGenerator(store, summaryManager)
  const report = await reportGenerator.generateReport(session.meta.id, {
    includeMessages: true,
    messageLimit: 20,
    includeSummary: true,
    includeMemoryNotes: false,
    includeAgentSummaries: false,
    format: 'json',
  })
  const stats = reportGenerator.generateSessionStats(session.meta.id)

  const sessionMachine = createDSXUSessionStateMachine(session.meta.id, {
    enableCheckpoints: true,
    maxCheckpoints: 10,
  })
  const snapshot: SessionSnapshot = {
    sessionId: session.meta.id,
    timestamp: Date.now(),
    status: 'active',
    messageStats: {
      total: updatedSession.messages.length,
      user: updatedSession.messages.filter((message) => message.role === 'user').length,
      assistant: updatedSession.messages.filter((message) => message.role === 'assistant').length,
      tool: updatedSession.messages.filter((message) => message.role === 'tool').length,
      system: updatedSession.messages.filter((message) => message.role === 'system').length,
    },
    extractedMemories: [],
    memoryCategoryStats: {
      bug: 0,
      decision: 0,
      'task-state': 0,
      'repo-context': 0,
      'recovery-history': 0,
      'technical-pattern': 0,
      'user-preference': 0,
    },
    resumeHints: [
      {
        type: 'suggestion',
        content: 'DSXU session mainline checkpoint is ready for continue/resume',
        priority: 'medium',
        location: { timestamp: Date.now() },
      },
    ],
    qualityScore: 88,
  }
  const checkpoint = sessionMachine.createCheckpoint(snapshot)
  const persistentState = sessionMachine.updatePersistentState(checkpoint)

  return {
    session: updatedSession,
    checkpoint,
    persistentState,
    summary: summaryManager.getSessionSummary(store, session.meta.id),
    report,
    stats,
    evidence: recordSessionMainlineConsumption({
      signalType: 'dsxu-session-mainline-bundle',
      detail: `${session.meta.id}:${updatedSession.messages.length}:${Boolean(report)}`,
    }),
  }
}
