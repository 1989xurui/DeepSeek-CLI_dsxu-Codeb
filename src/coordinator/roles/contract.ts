/**
 * R5-17 Multi-Agent Role Coordination — Interface Contract
 *
 * 四角色多 agent 协调器。每个角色有独立 system prompt 和模型偏好，
 * 通过 MessageEnvelope 通信，不共享内部状态（信息墙）。
 *
 * 路径：src/coordinator/roles/contract.ts
 */

// ── 基础类型 ──

export type RoleName = 'planner' | 'executor' | 'critic' | 'verifier';
export type OrchestrationMode = 'linear' | 'reflexion' | 'map-reduce' | 'debate';
export type ModelPreference = 'reasoner' | 'chat';

export interface MessageEnvelope {
  from: RoleName;
  to: RoleName | 'orchestrator';
  type: 'plan' | 'patch' | 'review' | 'verification' | 'rejection' | 'approval' | 'error';
  payload: Record<string, unknown>;
  timestamp: number;
  turnIndex: number;
}

// ── 角色接口 ──

export interface RoleConfig {
  name: RoleName;
  modelPreference: ModelPreference;
  systemPrompt: string;
  maxTurns: number;          // 单角色最大调用次数
  timeoutMs: number;         // 单次调用超时
}

export interface RoleResponse {
  role: RoleName;
  messages: MessageEnvelope[];
  durationMs: number;
  tokenUsage: { input: number; output: number };
  error?: string;
}

/**
 * 角色基类接口 — 每个角色必须实现
 */
export interface Role {
  readonly config: RoleConfig;
  /**
   * 处理收到的消息，返回响应
   * 信息墙：只能看到发给自己的 MessageEnvelope，看不到其他角色的内部状态
   */
  process(inbox: MessageEnvelope[], context: TaskContext): Promise<RoleResponse>;
  /** 重置内部状态（新任务时调用） */
  reset(): void;
}

// ── 任务上下文 ──

export interface TaskContext {
  taskId: string;
  description: string;
  targetFiles: string[];
  cwd: string;
  /** 只读：当前已有的测试文件路径 */
  existingTests: string[];
  /** 只读：git diff（如果有之前的 patch） */
  currentPatch?: string;
}

// ── 编排结果 ──

export interface OrchestrationResult {
  success: boolean;
  mode: OrchestrationMode;
  /** 最终 patch（success=true 时非空） */
  finalPatch?: string;
  /** 全部消息流水（调试用） */
  messageLog: MessageEnvelope[];
  /** 各角色统计 */
  roleStats: Record<RoleName, {
    invocations: number;
    totalDurationMs: number;
    totalTokens: { input: number; output: number };
  }>;
  /** Critic 拒绝次数 / 总审查次数 */
  criticRejectionRate: number;
  /** 总耗时 */
  totalDurationMs: number;
  /** 总轮数 */
  totalTurns: number;
  error?: string;
}

// ── 编排器 ──

export interface OrchestratorConfig {
  mode: OrchestrationMode;
  maxTotalTurns: number;       // 所有角色合计最大轮数，默认 20
  maxTotalDurationMs: number;  // 总超时，默认 120_000
  /** Critic 拒绝率超过此值自动降级到 linear */
  criticRejectionThreshold: number;  // 默认 0.4
  /** Reflexion 模式最大循环次数 */
  maxReflexionLoops: number;   // 默认 3
  /** Map-Reduce 并行 Executor 数 */
  mapReduceParallel: number;   // 默认 3
  /** 角色配置覆盖 */
  roleOverrides?: Partial<Record<RoleName, Partial<RoleConfig>>>;
}

/**
 * 主入口：对一个任务运行多角色编排
 *
 * 契约：
 *   - 不得抛异常；内部错误记录到 result.error
 *   - 信息墙：角色之间只通过 MessageEnvelope 通信
 *   - 自动降级：criticRejectionRate > threshold 时切回 linear
 *   - result.success === true 当且仅当 Verifier 最终 approve
 */
export async function orchestrate(
  task: TaskContext,
  config?: Partial<OrchestratorConfig>
): Promise<OrchestrationResult>;

/**
 * 创建角色实例
 *
 * 契约：
 *   - 返回的 Role 实例使用 config.modelPreference 选择模型
 *   - planner/critic 默认 reasoner，executor/verifier 默认 chat
 */
export function createRole(name: RoleName, overrides?: Partial<RoleConfig>): Role;

/**
 * 格式化编排报告
 */
export function formatOrchestrationReport(result: OrchestrationResult): string;

/**
 * 根据任务特征推荐编排模式
 *
 * 契约：
 *   - 单文件简单修改 → linear
 *   - 多文件重构 → map-reduce
 *   - bug 修复 → reflexion
 *   - 设计决策 → debate
 */
export function recommendMode(task: TaskContext): OrchestrationMode;