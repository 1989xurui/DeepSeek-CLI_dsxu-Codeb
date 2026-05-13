import {
  LifecycleProtocol,
  LifecycleState,
  LifecycleCheckpoint,
  LifecycleRecoveryStrategy,
  LifecycleMetric,
  LifecycleMetrics,
  LifecycleProtocolManager
} from './coordinator-types-v1';

/**
 * 默认的生命周期协议
 */
export const DEFAULT_LIFECYCLE_PROTOCOL: LifecycleProtocol = {
  name: 'default',
  version: '1.0.0',
  description: '默认的生命周期协议，适用于大多数协调器场景',
  states: [
    {
      name: 'initialized',
      description: '协议已初始化',
      transitions: ['planning', 'failed'],
      actions: ['validateRequirements', 'setupEnvironment']
    },
    {
      name: 'planning',
      description: '任务规划阶段',
      transitions: ['executing', 'escalated', 'failed'],
      actions: ['createPlan', 'allocateResources', 'validatePlan']
    },
    {
      name: 'executing',
      description: '任务执行阶段',
      transitions: ['verifying', 'escalated', 'failed'],
      actions: ['executeTasks', 'monitorProgress', 'collectMetrics']
    },
    {
      name: 'verifying',
      description: '结果验证阶段',
      transitions: ['completed', 'escalated', 'failed'],
      actions: ['validateResults', 'runTests', 'generateReport']
    },
    {
      name: 'completed',
      description: '任务完成',
      transitions: [],
      actions: ['cleanup', 'archiveResults', 'notifyCompletion']
    },
    {
      name: 'escalated',
      description: '问题升级',
      transitions: ['recovering', 'failed'],
      actions: ['analyzeIssue', 'escalateToHuman', 'createRecoveryPlan']
    },
    {
      name: 'recovering',
      description: '恢复中',
      transitions: ['planning', 'executing', 'failed'],
      actions: ['applyRecoveryStrategy', 'monitorRecovery', 'validateRecovery']
    },
    {
      name: 'failed',
      description: '任务失败',
      transitions: ['recovering'],
      actions: ['analyzeFailure', 'logError', 'notifyFailure']
    }
  ],
  checkpoints: [
    {
      name: 'planning-complete',
      description: '规划完成检查点',
      state: 'planning',
      validations: ['planExists', 'resourcesAllocated', 'dependenciesResolved']
    },
    {
      name: 'execution-start',
      description: '执行开始检查点',
      state: 'executing',
      validations: ['environmentReady', 'dependenciesMet', 'planValid']
    },
    {
      name: 'verification-start',
      description: '验证开始检查点',
      state: 'verifying',
      validations: ['executionComplete', 'resultsAvailable', 'testsReady']
    },
    {
      name: 'completion-verification',
      description: '完成验证检查点',
      state: 'completed',
      validations: ['allTestsPassed', 'documentationComplete', 'cleanupDone']
    }
  ],
  recoveryStrategies: [
    {
      name: 'retry-execution',
      description: '重试执行策略',
      applicableStates: ['failed', 'escalated'],
      actions: ['resetState', 'retryTask', 'monitorRetry']
    },
    {
      name: 'fallback-plan',
      description: '备用计划策略',
      applicableStates: ['failed', 'escalated'],
      actions: ['activateFallback', 'executeFallback', 'validateFallback']
    },
    {
      name: 'human-intervention',
      description: '人工干预策略',
      applicableStates: ['escalated', 'failed'],
      actions: ['notifyHuman', 'awaitResponse', 'applyHumanSolution']
    },
    {
      name: 'partial-rollback',
      description: '部分回滚策略',
      applicableStates: ['failed'],
      actions: ['identifyFailurePoint', 'rollbackToCheckpoint', 'resumeFromCheckpoint']
    }
  ],
  metrics: [
    {
      name: 'branchSuccessRate',
      description: '分支成功率',
      type: 'percentage',
      target: '>95%'
    },
    {
      name: 'escalationFrequency',
      description: '升级频率',
      type: 'count',
      target: '<5%'
    },
    {
      name: 'recoverySuccessRate',
      description: '恢复成功率',
      type: 'percentage',
      target: '>90%'
    },
    {
      name: 'totalBranches',
      description: '总分支数',
      type: 'count',
      target: 'N/A'
    },
    {
      name: 'completedBranches',
      description: '完成分支数',
      type: 'count',
      target: 'N/A'
    },
    {
      name: 'failedBranches',
      description: '失败分支数',
      type: 'count',
      target: 'N/A'
    }
  ]
};

/**
 * 生命周期协议管理器实现
 */
export class LifecycleProtocolManagerImpl implements LifecycleProtocolManager {
  private protocols: Map<string, LifecycleProtocol> = new Map();
  private currentStates: Map<string, string> = new Map();
  private metricsData: Map<string, LifecycleMetrics> = new Map();

  constructor() {
    // 注册默认协议
    this.registerProtocol(DEFAULT_LIFECYCLE_PROTOCOL);
  }

  // 协议管理
  registerProtocol(protocol: LifecycleProtocol): void {
    this.protocols.set(protocol.name, protocol);
    this.currentStates.set(protocol.name, 'initialized');
    this.metricsData.set(protocol.name, {
      branchSuccessRate: 0,
      escalationFrequency: 0,
      recoverySuccessRate: 0,
      totalBranches: 0,
      completedBranches: 0,
      failedBranches: 0,
      escalations: 0,
      recoveries: 0
    });
  }

  getProtocol(name: string): LifecycleProtocol | undefined {
    return this.protocols.get(name);
  }

  listProtocols(): LifecycleProtocol[] {
    return Array.from(this.protocols.values());
  }

  // 状态管理
  getCurrentState(protocolName: string): string | undefined {
    return this.currentStates.get(protocolName);
  }

  transitionTo(protocolName: string, targetState: string): boolean {
    const protocol = this.protocols.get(protocolName);
    if (!protocol) {
      console.error(`Protocol ${protocolName} not found`);
      return false;
    }

    const currentState = this.currentStates.get(protocolName);
    if (!currentState) {
      console.error(`Current state for protocol ${protocolName} not found`);
      return false;
    }

    const state = protocol.states.find(s => s.name === currentState);
    if (!state) {
      console.error(`State ${currentState} not found in protocol ${protocolName}`);
      return false;
    }

    if (!state.transitions.includes(targetState)) {
      console.error(`Cannot transition from ${currentState} to ${targetState}`);
      return false;
    }

    this.currentStates.set(protocolName, targetState);
    console.log(`Transitioned protocol ${protocolName} from ${currentState} to ${targetState}`);
    return true;
  }

  canTransition(protocolName: string, targetState: string): boolean {
    const protocol = this.protocols.get(protocolName);
    if (!protocol) return false;

    const currentState = this.currentStates.get(protocolName);
    if (!currentState) return false;

    const state = protocol.states.find(s => s.name === currentState);
    if (!state) return false;

    return state.transitions.includes(targetState);
  }

  // 检查点管理
  validateCheckpoint(protocolName: string, checkpointName: string): boolean {
    const protocol = this.protocols.get(protocolName);
    if (!protocol) return false;

    const checkpoint = protocol.checkpoints.find(c => c.name === checkpointName);
    if (!checkpoint) return false;

    const currentState = this.currentStates.get(protocolName);
    if (!currentState) return false;

    // 检查点状态必须匹配当前状态
    if (checkpoint.state !== currentState) {
      console.error(`Checkpoint ${checkpointName} requires state ${checkpoint.state}, but current state is ${currentState}`);
      return false;
    }

    console.log(`Validated checkpoint ${checkpointName} for protocol ${protocolName}`);
    return true;
  }

  getCheckpoints(protocolName: string): LifecycleCheckpoint[] {
    const protocol = this.protocols.get(protocolName);
    if (!protocol) return [];

    const currentState = this.currentStates.get(protocolName);
    if (!currentState) return [];

    return protocol.checkpoints.filter(c => c.state === currentState);
  }

  // 恢复策略
  getRecoveryStrategies(protocolName: string, currentState: string): LifecycleRecoveryStrategy[] {
    const protocol = this.protocols.get(protocolName);
    if (!protocol) return [];

    return protocol.recoveryStrategies.filter(
      strategy => strategy.applicableStates.includes(currentState)
    );
  }

  applyRecovery(protocolName: string, strategyName: string): boolean {
    const protocol = this.protocols.get(protocolName);
    if (!protocol) return false;

    const currentState = this.currentStates.get(protocolName);
    if (!currentState) return false;

    const strategy = protocol.recoveryStrategies.find(s => s.name === strategyName);
    if (!strategy) {
      console.error(`Recovery strategy ${strategyName} not found`);
      return false;
    }

    if (!strategy.applicableStates.includes(currentState)) {
      console.error(`Recovery strategy ${strategyName} not applicable to state ${currentState}`);
      return false;
    }

    console.log(`Applying recovery strategy ${strategyName} for protocol ${protocolName} in state ${currentState}`);

    // 更新恢复指标
    const metrics = this.metricsData.get(protocolName);
    if (metrics) {
      metrics.recoveries++;
      this.metricsData.set(protocolName, metrics);
    }

    return true;
  }

  // 指标收集
  collectMetrics(protocolName: string): LifecycleMetrics {
    const defaultMetrics: LifecycleMetrics = {
      branchSuccessRate: 0,
      escalationFrequency: 0,
      recoverySuccessRate: 0,
      totalBranches: 0,
      completedBranches: 0,
      failedBranches: 0,
      escalations: 0,
      recoveries: 0
    };

    const metrics = this.metricsData.get(protocolName);
    if (!metrics) return defaultMetrics;

    // 计算成功率
    if (metrics.totalBranches > 0) {
      metrics.branchSuccessRate = (metrics.completedBranches / metrics.totalBranches) * 100;
    }

    // 计算升级频率
    if (metrics.totalBranches > 0) {
      metrics.escalationFrequency = (metrics.escalations / metrics.totalBranches) * 100;
    }

    // 计算恢复成功率
    if (metrics.recoveries > 0) {
      // 简化计算：假设每次恢复都成功
      metrics.recoverySuccessRate = 100;
    }

    return { ...metrics };
  }

  updateMetrics(protocolName: string, updates: Partial<LifecycleMetrics>): void {
    const currentMetrics = this.metricsData.get(protocolName) || {
      branchSuccessRate: 0,
      escalationFrequency: 0,
      recoverySuccessRate: 0,
      totalBranches: 0,
      completedBranches: 0,
      failedBranches: 0,
      escalations: 0,
      recoveries: 0
    };

    const updatedMetrics = { ...currentMetrics, ...updates };
    this.metricsData.set(protocolName, updatedMetrics);
  }
}

/**
 * 创建生命周期协议管理器
 */
export function createLifecycleProtocolManager(): LifecycleProtocolManager {
  return new LifecycleProtocolManagerImpl();
}
