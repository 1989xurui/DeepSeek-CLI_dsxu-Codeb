import { createLifecycleProtocolManager } from '../lifecycle-protocol-manager';

/**
 * 生命周期协议集成示例
 *
 * 这个示例展示了如何在协调器中使用生命周期协议来管理任务执行流程
 */
export class LifecycleCoordinatorExample {
  private protocolManager = createLifecycleProtocolManager();
  private protocolName = 'task-execution';

  constructor() {
    // 注册自定义协议
    this.registerCustomProtocol();
  }

  /**
   * 注册自定义任务执行协议
   */
  private registerCustomProtocol() {
    const taskProtocol = {
      name: this.protocolName,
      version: '1.0.0',
      description: '任务执行生命周期协议',
      states: [
        {
          name: 'initialized',
          description: '任务已初始化',
          transitions: ['analyzing', 'failed'],
          actions: ['parseRequirements', 'validateInput']
        },
        {
          name: 'analyzing',
          description: '分析任务需求',
          transitions: ['planning', 'escalated', 'failed'],
          actions: ['analyzeComplexity', 'estimateEffort', 'identifyRisks']
        },
        {
          name: 'planning',
          description: '制定执行计划',
          transitions: ['executing', 'escalated', 'failed'],
          actions: ['createTaskList', 'allocateAgents', 'setMilestones']
        },
        {
          name: 'executing',
          description: '执行任务',
          transitions: ['verifying', 'escalated', 'failed'],
          actions: ['monitorProgress', 'handleIssues', 'collectResults']
        },
        {
          name: 'verifying',
          description: '验证结果',
          transitions: ['completed', 'escalated', 'failed'],
          actions: ['runTests', 'validateOutput', 'generateReport']
        },
        {
          name: 'completed',
          description: '任务完成',
          transitions: [],
          actions: ['cleanup', 'archive', 'notify']
        },
        {
          name: 'escalated',
          description: '问题升级',
          transitions: ['recovering', 'failed'],
          actions: ['logIssue', 'requestHelp', 'createRecoveryPlan']
        },
        {
          name: 'recovering',
          description: '恢复中',
          transitions: ['analyzing', 'planning', 'executing', 'failed'],
          actions: ['applyFix', 'validateRecovery', 'resumeTask']
        },
        {
          name: 'failed',
          description: '任务失败',
          transitions: ['recovering'],
          actions: ['analyzeFailure', 'logError', 'notifyStakeholders']
        }
      ],
      checkpoints: [
        {
          name: 'analysis-complete',
          description: '分析完成检查点',
          state: 'analyzing',
          validations: ['requirementsUnderstood', 'risksIdentified', 'effortEstimated']
        },
        {
          name: 'planning-complete',
          description: '规划完成检查点',
          state: 'planning',
          validations: ['planCreated', 'resourcesAllocated', 'milestonesSet']
        },
        {
          name: 'execution-start',
          description: '执行开始检查点',
          state: 'executing',
          validations: ['planApproved', 'agentsReady', 'environmentSetup']
        },
        {
          name: 'verification-start',
          description: '验证开始检查点',
          state: 'verifying',
          validations: ['executionComplete', 'resultsAvailable', 'testsReady']
        }
      ],
      recoveryStrategies: [
        {
          name: 'retry-with-backoff',
          description: '带退避的重试策略',
          applicableStates: ['failed', 'escalated'],
          actions: ['waitBackoff', 'retryTask', 'monitorRetry']
        },
        {
          name: 'simplify-requirements',
          description: '简化需求策略',
          applicableStates: ['escalated', 'failed'],
          actions: ['identifyComplexParts', 'simplifyRequirements', 'adjustPlan']
        },
        {
          name: 'add-resources',
          description: '增加资源策略',
          applicableStates: ['escalated'],
          actions: ['identifyBottleneck', 'allocateMoreAgents', 'adjustTimeline']
        },
        {
          name: 'rollback-and-retry',
          description: '回滚并重试策略',
          applicableStates: ['failed'],
          actions: ['identifyFailurePoint', 'rollbackChanges', 'retryFromCheckpoint']
        }
      ],
      metrics: [
        {
          name: 'taskSuccessRate',
          description: '任务成功率',
          type: 'percentage',
          target: '>95%'
        },
        {
          name: 'escalationRate',
          description: '升级率',
          type: 'percentage',
          target: '<10%'
        },
        {
          name: 'recoverySuccessRate',
          description: '恢复成功率',
          type: 'percentage',
          target: '>85%'
        },
        {
          name: 'averageCompletionTime',
          description: '平均完成时间',
          type: 'time',
          target: '<1 hour'
        }
      ]
    };

    this.protocolManager.registerProtocol(taskProtocol);
  }

  /**
   * 执行任务
   */
  async executeTask(taskDescription: string): Promise<boolean> {
    console.log(`Starting task: ${taskDescription}`);

    try {
      // 1. 初始化阶段
      console.log('Phase 1: Initialization');
      if (!this.transitionTo('initialized')) {
        return false;
      }
      await this.performInitialization(taskDescription);

      // 2. 分析阶段
      console.log('Phase 2: Analysis');
      if (!this.transitionTo('analyzing')) {
        return false;
      }
      const analysisResult = await this.performAnalysis(taskDescription);
      if (!analysisResult.success) {
        await this.handleFailure('Analysis failed');
        return false;
      }

      // 验证分析检查点
      if (!this.protocolManager.validateCheckpoint(this.protocolName, 'analysis-complete')) {
        await this.handleFailure('Analysis checkpoint validation failed');
        return false;
      }

      // 3. 规划阶段
      console.log('Phase 3: Planning');
      if (!this.transitionTo('planning')) {
        return false;
      }
      const plan = await this.createExecutionPlan(analysisResult);
      if (!plan) {
        await this.handleFailure('Planning failed');
        return false;
      }

      // 验证规划检查点
      if (!this.protocolManager.validateCheckpoint(this.protocolName, 'planning-complete')) {
        await this.handleFailure('Planning checkpoint validation failed');
        return false;
      }

      // 4. 执行阶段
      console.log('Phase 4: Execution');
      if (!this.transitionTo('executing')) {
        return false;
      }
      const executionResult = await this.executePlan(plan);
      if (!executionResult.success) {
        await this.handleExecutionFailure(executionResult);
        return false;
      }

      // 5. 验证阶段
      console.log('Phase 5: Verification');
      if (!this.transitionTo('verifying')) {
        return false;
      }
      const verificationResult = await this.verifyResults(executionResult);
      if (!verificationResult.success) {
        await this.handleFailure('Verification failed');
        return false;
      }

      // 6. 完成阶段
      console.log('Phase 6: Completion');
      if (!this.transitionTo('completed')) {
        return false;
      }
      await this.completeTask(verificationResult);

      // 更新指标
      this.updateSuccessMetrics();
      console.log('Task completed successfully!');
      return true;

    } catch (error) {
      console.error('Unexpected error during task execution:', error);
      await this.handleFailure(`Unexpected error: ${error}`);
      return false;
    }
  }

  /**
   * 状态转换辅助方法
   */
  private transitionTo(targetState: string): boolean {
    const success = this.protocolManager.transitionTo(this.protocolName, targetState);
    if (success) {
      console.log(`Transitioned to state: ${targetState}`);
    } else {
      console.error(`Failed to transition to state: ${targetState}`);
    }
    return success;
  }

  /**
   * 处理失败
   */
  private async handleFailure(reason: string): Promise<void> {
    console.error(`Task failed: ${reason}`);

    // 过渡到失败状态
    this.transitionTo('failed');

    // 尝试恢复
    await this.attemptRecovery();

    // 更新失败指标
    this.updateFailureMetrics();
  }

  /**
   * 处理执行失败
   */
  private async handleExecutionFailure(result: any): Promise<void> {
    console.error('Execution failed:', result.error);

    // 首先尝试升级
    if (this.protocolManager.canTransition(this.protocolName, 'escalated')) {
      console.log('Escalating issue...');
      this.transitionTo('escalated');

      // 获取适用的恢复策略
      const strategies = this.protocolManager.getRecoveryStrategies(
        this.protocolName,
        'escalated'
      );

      if (strategies.length > 0) {
        console.log(`Available recovery strategies: ${strategies.map(s => s.name).join(', ')}`);

        // 尝试第一个恢复策略
        const strategy = strategies[0];
        if (this.protocolManager.applyRecovery(this.protocolName, strategy.name)) {
          console.log(`Applied recovery strategy: ${strategy.name}`);

          // 过渡到恢复状态
          this.transitionTo('recovering');

          // 尝试从检查点恢复
          await this.recoverFromCheckpoint();
          return;
        }
      }
    }

    // 如果升级失败，直接进入失败状态
    await this.handleFailure('Execution failed and recovery attempts exhausted');
  }

  /**
   * 尝试恢复
   */
  private async attemptRecovery(): Promise<boolean> {
    const currentState = this.protocolManager.getCurrentState(this.protocolName);
    if (!currentState) return false;

    const strategies = this.protocolManager.getRecoveryStrategies(
      this.protocolName,
      currentState
    );

    if (strategies.length === 0) {
      console.log('No recovery strategies available');
      return false;
    }

    console.log(`Available recovery strategies: ${strategies.map(s => s.name).join(', ')}`);

    // 尝试每个恢复策略
    for (const strategy of strategies) {
      console.log(`Attempting recovery strategy: ${strategy.name}`);

      if (this.protocolManager.applyRecovery(this.protocolName, strategy.name)) {
        console.log(`Successfully applied recovery strategy: ${strategy.name}`);

        // 过渡到恢复状态
        this.transocolManager.transitionTo(this.protocolName, 'recovering');

        // 尝试恢复执行
        const recoverySuccess = await this.performRecovery(strategy);
        if (recoverySuccess) {
          console.log('Recovery successful');
          return true;
        }
      }
    }

    console.log('All recovery attempts failed');
    return false;
  }

  /**
   * 更新成功指标
   */
  private updateSuccessMetrics(): void {
    this.protocolManager.updateMetrics(this.protocolName, {
      totalBranches: 1,
      completedBranches: 1
    });
  }

  /**
   * 更新失败指标
   */
  private updateFailureMetrics(): void {
    this.protocolManager.updateMetrics(this.protocolName, {
      totalBranches: 1,
      failedBranches: 1,
      escalations: 1
    });
  }

  /**
   * 获取当前指标
   */
  getMetrics() {
    return this.protocolManager.collectMetrics(this.protocolName);
  }

  /**
   * 模拟方法 - 在实际实现中需要具体实现
   */
  private async performInitialization(description: string): Promise<void> {
    console.log(`Initializing task: ${description}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async performAnalysis(description: string): Promise<any> {
    console.log(`Analyzing task: ${description}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return { success: true, complexity: 'medium', estimatedTime: 300 };
  }

  private async createExecutionPlan(analysis: any): Promise<any> {
    console.log('Creating execution plan...');
    await new Promise(resolve => setTimeout(resolve, 150));
    return { steps: ['step1', 'step2', 'step3'], agents: 2 };
  }

  private async executePlan(plan: any): Promise<any> {
    console.log('Executing plan...');
    await new Promise(resolve => setTimeout(resolve, 300));

    // 模拟随机失败
    if (Math.random() < 0.3) {
      return { success: false, error: 'Simulated execution failure' };
    }

    return { success: true, results: ['result1', 'result2'] };
  }

  private async verifyResults(executionResult: any): Promise<any> {
    console.log('Verifying results...');
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, passedTests: 5, failedTests: 0 };
  }

  private async completeTask(verificationResult: any): Promise<void> {
    console.log('Completing task...');
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async recoverFromCheckpoint(): Promise<boolean> {
    console.log('Recovering from checkpoint...');
    await new Promise(resolve => setTimeout(resolve, 200));
    return Math.random() < 0.7; // 70% 恢复成功率
  }

  private async performRecovery(strategy: any): Promise<boolean> {
    console.log(`Performing recovery: ${strategy.description}`);
    await new Promise(resolve => setTimeout(resolve, 250));
    return Math.random() < 0.8; // 80% 恢复成功率
  }
}

/**
 * 运行示例
 */
async function runExample() {
  console.log('=== Lifecycle Protocol Integration Example ===\n');

  const coordinator = new LifecycleCoordinatorExample();

  // 运行多个任务
  const tasks = [
    'Implement user authentication',
    'Add data validation',
    'Optimize database queries',
    'Fix memory leak issue'
  ];

  let successfulTasks = 0;
  let failedTasks = 0;

  for (const task of tasks) {
    console.log(`\n--- Executing: ${task} ---`);
    const success = await coordinator.executeTask(task);

    if (success) {
      successfulTasks++;
      console.log(`✓ ${task} completed successfully`);
    } else {
      failedTasks++;
      console.log(`✗ ${task} failed`);
    }
  }

  // 显示最终指标
  console.log('\n=== Final Metrics ===');
  const metrics = coordinator.getMetrics();
  console.log(`Total tasks: ${metrics.totalBranches}`);
  console.log(`Successful: ${metrics.completedBranches}`);
  console.log(`Failed: ${metrics.failedBranches}`);
  console.log(`Success rate: ${metrics.branchSuccessRate.toFixed(1)}%`);
  console.log(`Escalations: ${metrics.escalations}`);
  console.log(`Recoveries: ${metrics.recoveries}`);
  console.log(`Recovery success rate: ${metrics.recoverySuccessRate.toFixed(1)}%`);

  console.log(`\nSummary: ${successfulTasks} successful, ${failedTasks} failed`);
}

// 如果要运行示例，取消注释下面的行
// runExample().catch(console.error);
