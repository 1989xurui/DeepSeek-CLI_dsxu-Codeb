/**
 * R5-17 Multi-Agent Role Coordination — Role Implementations
 *
 * 实现四个角色的具体逻辑。
 *
 * 路径：src/coordinator/roles/role-implementations.ts
 */

import {
  RoleName,
  RoleConfig,
  Role,
  MessageEnvelope,
  TaskContext,
  RoleResponse,
  ModelPreference,
} from './contract';

// ── 默认角色配置 ──

const DEFAULT_ROLE_CONFIGS: Record<RoleName, RoleConfig> = {
  planner: {
    name: 'planner',
    modelPreference: 'reasoner',
    systemPrompt: `你是一个软件架构师。给定一个任务描述和文件列表，你需要：
1. 分析任务需求
2. 识别需要修改的文件和位置
3. 设计具体的实现方案
4. 考虑边界情况和潜在问题
5. 输出一个清晰的计划，包括步骤、文件和预期变更

输出格式：
- 计划摘要
- 文件列表和修改点
- 实现步骤
- 注意事项`,
    maxTurns: 3,
    timeoutMs: 30_000,
  },
  executor: {
    name: 'executor',
    modelPreference: 'chat',
    systemPrompt: `你是一个代码实现专家。给定一个计划，你需要：
1. 读取相关文件内容
2. 按照计划实现代码变更
3. 生成 git diff 格式的 patch
4. 确保代码风格一致
5. 处理边缘情况

输出格式：
- 修改后的文件内容（如果需要）
- git diff 格式的 patch
- 简要说明变更`,
    maxTurns: 5,
    timeoutMs: 45_000,
  },
  critic: {
    name: 'critic',
    modelPreference: 'reasoner',
    systemPrompt: `你是一个代码审查专家。给定一个计划和对应的 patch，你需要：
1. 检查计划是否合理
2. 审查 patch 的质量
3. 识别潜在问题：bug、性能、安全、可维护性
4. 检查是否遗漏了边界情况
5. 给出具体的改进建议或拒绝理由

输出格式：
- 审查结果：approval 或 rejection
- 详细理由
- 具体建议（如果 approval）
- 必须拒绝的问题列表（如果 rejection）`,
    maxTurns: 3,
    timeoutMs: 30_000,
  },
  verifier: {
    name: 'verifier',
    modelPreference: 'chat',
    systemPrompt: `你是一个测试验证专家。给定一个 patch 和现有测试文件，你需要：
1. 分析 patch 对现有测试的影响
2. 运行相关测试（如果可能）
3. 检查测试覆盖率
4. 验证功能正确性
5. 输出验证结果

输出格式：
- 测试通过状态：true/false
- 运行的测试列表
- 失败详情（如果有）
- 覆盖率评估`,
    maxTurns: 3,
    timeoutMs: 40_000,
  },
};

// ── 角色基类 ──

abstract class BaseRole implements Role {
  protected internalState: Record<string, unknown> = {};
  protected turnCount = 0;

  constructor(public readonly config: RoleConfig) {}

  abstract process(inbox: MessageEnvelope[], context: TaskContext): Promise<RoleResponse>;

  reset(): void {
    this.internalState = {};
    this.turnCount = 0;
  }

  protected checkTurnLimit(): boolean {
    return this.turnCount < this.config.maxTurns;
  }

  protected incrementTurn(): void {
    this.turnCount++;
  }

  protected createMessage(
    to: RoleName | 'orchestrator',
    type: MessageEnvelope['type'],
    payload: Record<string, unknown>
  ): MessageEnvelope {
    return {
      from: this.config.name,
      to,
      type,
      payload,
      timestamp: Date.now(),
      turnIndex: this.turnCount,
    };
  }

  protected async callModel(
    prompt: string,
    context: TaskContext
  ): Promise<{ content: string; tokenUsage: { input: number; output: number } }> {
    // 模拟模型调用
    // TODO: 集成实际的模型调用
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = 500; // 估计值

    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      content: `[模拟响应] ${this.config.name} 处理了任务: ${context.taskId}`,
      tokenUsage: { input: inputTokens, output: outputTokens },
    };
  }
}

// ── Planner 实现 ──

class PlannerRole extends BaseRole {
  async process(inbox: MessageEnvelope[], context: TaskContext): Promise<RoleResponse> {
    if (!this.checkTurnLimit()) {
      return {
        role: this.config.name,
        messages: [],
        durationMs: 0,
        tokenUsage: { input: 0, output: 0 },
        error: 'Turn limit exceeded',
      };
    }
    this.incrementTurn();

    const startTime = Date.now();

    // 构建 prompt
    const prompt = `任务: ${context.description}
目标文件: ${context.targetFiles.join(', ')}
工作目录: ${context.cwd}
现有测试: ${context.existingTests.join(', ')}

请制定实现计划。`;

    const modelResp = await this.callModel(prompt, context);
    const duration = Date.now() - startTime;

    // 解析响应（简化）
    const plan = {
      summary: modelResp.content,
      steps: ['分析需求', '设计实现', '编写代码'],
      files: context.targetFiles,
      considerations: ['边界情况', '性能影响'],
    };

    const message = this.createMessage('executor', 'plan', { plan });

    return {
      role: this.config.name,
      messages: [message],
      durationMs: duration,
      tokenUsage: modelResp.tokenUsage,
    };
  }
}

// ── Executor 实现 ──

class ExecutorRole extends BaseRole {
  async process(inbox: MessageEnvelope[], context: TaskContext): Promise<RoleResponse> {
    if (!this.checkTurnLimit()) {
      return {
        role: this.config.name,
        messages: [],
        durationMs: 0,
        tokenUsage: { input: 0, output: 0 },
        error: 'Turn limit exceeded',
      };
    }
    this.incrementTurn();

    const startTime = Date.now();

    // 查找 plan 消息
    const planMsg = inbox.find(m => m.type === 'plan');
    if (!planMsg) {
      return {
        role: this.config.name,
        messages: [],
        durationMs: Date.now() - startTime,
        tokenUsage: { input: 0, output: 0 },
        error: 'No plan message received',
      };
    }

    // 构建 prompt
    const prompt = `计划: ${JSON.stringify(planMsg.payload, null, 2)}
任务: ${context.description}
目标文件: ${context.targetFiles.join(', ')}
当前 patch: ${context.currentPatch || '无'}

请实现代码变更。`;

    const modelResp = await this.callModel(prompt, context);
    const duration = Date.now() - startTime;

    // 生成模拟 patch
    const diff = `--- a/${context.targetFiles[0]}
+++ b/${context.targetFiles[0]}
@@ -1,1 +1,1 @@
-// 原始代码
+// 修改后的代码`;

    const message = this.createMessage('critic', 'patch', { diff, explanation: modelResp.content });

    return {
      role: this.config.name,
      messages: [message],
      durationMs: duration,
      tokenUsage: modelResp.tokenUsage,
    };
  }
}

// ── Critic 实现 ──

class CriticRole extends BaseRole {
  async process(inbox: MessageEnvelope[], context: TaskContext): Promise<RoleResponse> {
    if (!this.checkTurnLimit()) {
      return {
        role: this.config.name,
        messages: [],
        durationMs: 0,
        tokenUsage: { input: 0, output: 0 },
        error: 'Turn limit exceeded',
      };
    }
    this.incrementTurn();

    const startTime = Date.now();

    // 查找 plan 和 patch 消息
    const planMsg = inbox.find(m => m.type === 'plan');
    const patchMsg = inbox.find(m => m.type === 'patch');

    if (!planMsg || !patchMsg) {
      return {
        role: this.config.name,
        messages: [],
        durationMs: Date.now() - startTime,
        tokenUsage: { input: 0, output: 0 },
        error: 'Missing plan or patch message',
      };
    }

    // 构建 prompt
    const prompt = `计划: ${JSON.stringify(planMsg.payload, null, 2)}
Patch: ${JSON.stringify(patchMsg.payload, null, 2)}
任务: ${context.description}

请审查代码变更。`;

    const modelResp = await this.callModel(prompt, context);
    const duration = Date.now() - startTime;

    // 模拟审查结果（80% 通过）
    const shouldApprove = Math.random() > 0.2;
    const type = shouldApprove ? 'approval' : 'rejection';
    const payload = shouldApprove
      ? { result: 'approved', suggestions: ['代码风格一致', '功能完整'] }
      : { result: 'rejected', reason: '潜在的性能问题', issues: ['循环复杂度高'] };

    const message = this.createMessage('executor', type, payload);

    return {
      role: this.config.name,
      messages: [message],
      durationMs: duration,
      tokenUsage: modelResp.tokenUsage,
    };
  }
}

// ── Verifier 实现 ──

class VerifierRole extends BaseRole {
  async process(inbox: MessageEnvelope[], context: TaskContext): Promise<RoleResponse> {
    if (!this.checkTurnLimit()) {
      return {
        role: this.config.name,
        messages: [],
        durationMs: 0,
        tokenUsage: { input: 0, output: 0 },
        error: 'Turn limit exceeded',
      };
    }
    this.incrementTurn();

    const startTime = Date.now();

    // 查找 patch 消息
    const patchMsg = inbox.find(m => m.type === 'patch');
    if (!patchMsg) {
      return {
        role: this.config.name,
        messages: [],
        durationMs: Date.now() - startTime,
        tokenUsage: { input: 0, output: 0 },
        error: 'No patch message received',
      };
    }

    // 构建 prompt
    const prompt = `Patch: ${JSON.stringify(patchMsg.payload, null, 2)}
任务: ${context.description}
现有测试: ${context.existingTests.join(', ')}

请验证测试是否通过。`;

    const modelResp = await this.callModel(prompt, context);
    const duration = Date.now() - startTime;

    // 模拟验证结果（90% 通过）
    const testsPass = Math.random() > 0.1;
    const payload = {
      testsPass,
      testsRun: context.existingTests.slice(0, 3),
      failures: testsPass ? [] : ['test_example failed'],
      coverage: '85%',
    };

    const message = this.createMessage('orchestrator', 'verification', payload);

    return {
      role: this.config.name,
      messages: [message],
      durationMs: duration,
      tokenUsage: modelResp.tokenUsage,
    };
  }
}

// ── 工厂函数 ──

export function createRole(name: RoleName, overrides?: Partial<RoleConfig>): Role {
  const baseConfig = DEFAULT_ROLE_CONFIGS[name];
  const config: RoleConfig = { ...baseConfig, ...overrides, name };

  switch (name) {
    case 'planner':
      return new PlannerRole(config);
    case 'executor':
      return new ExecutorRole(config);
    case 'critic':
      return new CriticRole(config);
    case 'verifier':
      return new VerifierRole(config);
    default:
      throw new Error(`Unknown role: ${name}`);
  }
}

// ── 工具函数 ──

export function formatOrchestrationReport(result: any): string {
  const status = result.success ? 'SUCCESS' : 'FAILED';
  const lines: string[] = [
    `# Orchestration Report`,
    ``,
    `Status: ${status}`,
    `Mode: ${result.mode}`,
    `Duration: ${result.totalDurationMs}ms`,
    `Turns: ${result.totalTurns}`,
    `Critic Rejection Rate: ${(result.criticRejectionRate * 100).toFixed(1)}%`,
    ``,
    `## Role Stats`,
  ];

  for (const [role, stats] of Object.entries(result.roleStats) as [string, any][]) {
    lines.push(`  ${role}: ${stats.invocations} invocations, ${stats.totalDurationMs}ms, ${stats.totalTokens.input + stats.totalTokens.output} tokens`);
  }

  // Include rejection reasons from messageLog
  const rejections = (result.messageLog || []).filter((m: any) => m.type === 'rejection');
  if (rejections.length > 0) {
    lines.push('');
    lines.push('## Rejections');
    for (const r of rejections) {
      lines.push(`  - ${r.payload?.reason || 'Unknown reason'}`);
    }
  }

  if (result.error) {
    lines.push('');
    lines.push(`Error: ${result.error}`);
  }

  return lines.join('\n');
}

export function recommendMode(task: TaskContext): string {
  const desc = task.description.toLowerCase();
  const hasBugKeywords = desc.includes('bug') || desc.includes('fix');
  const hasDesignKeywords = desc.includes('design') || desc.includes('architect') || desc.includes('strategy');

  // bug fix with existing tests → reflexion (check before single-file)
  if (hasBugKeywords && task.existingTests.length > 0) {
    return 'reflexion';
  }
  // design/architecture → debate
  if (hasDesignKeywords) {
    return 'debate';
  }
  // multi-file (≥3) → map-reduce
  if (task.targetFiles.length >= 3) {
    return 'map-reduce';
  }
  // default
  return 'linear';
}