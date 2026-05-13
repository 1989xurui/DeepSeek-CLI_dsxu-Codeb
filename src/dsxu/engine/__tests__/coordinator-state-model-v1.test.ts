/**
 * DUXU Coordinator 全量对象与状态模型测试 - V10-2B
 *
 * 测试 coordinator-types-v1.ts 中定义的所有对象与状态模型
 * 确保达到 DSXU 强吸收级别
 */

// 导入所有需要的类型
import {
  // 基础类型
  TaskRiskLevel,
  VerificationRequirement,
  ContextOverlapType,

  // Agent 角色
  AgentRole,
  AGENT_ROLE_CONFIGS,

  // 任务规划
  SubtaskType,
  SubtaskPlan,
  MainTaskPlan,

  // 协调者决策
  RoleAssignment,
  CoordinatorDecision,

  // 运行时状态
  AgentRuntimeState,
  MultiAgentRuntimeState,

  // 新补充的对象模型（V10-2B）
  TaskAssignment,
  TaskDependencyGraph,
  WorkflowStage,
  CoordinationPlan,
  AgentExecutionContext,
  AgentCapabilityProfile,
  CoordinationCheckpoint,
  CoordinationSummary,
  CoordinationHealthState,
  BranchState,
  ContextDecisionState,
  ContextOverlapState,
  SharedContextSlice,
  AssignmentTrace,
  DecisionTrace,
  StateTransitionRecord,

  // 生命周期协议
  TaskExecutionStatus,
  ForkStrategy,
  isTerminalTaskStatus
} from '../coordinator-types-v1';

describe('Coordinator 全量对象与状态模型测试 (V10-2B)', () => {

  // ==================== 测试 1: MainTaskPlan / SubtaskPlan / TaskAssignment 存在 ====================

  test('1. MainTaskPlan / SubtaskPlan / TaskAssignment 对象存在且结构完整', () => {
    // 测试 MainTaskPlan
    const mainTaskPlan: MainTaskPlan = {
      id: 'task_123',
      title: '修复身份验证漏洞',
      description: '修复身份验证模块中的空指针异常',
      subtasks: [],
      requiredRoles: ['researcher', 'implementer', 'verifier'],
      estimatedComplexity: 'medium',
      overallRisk: 'medium',
      verificationLevel: 'independent'
    };

    expect(mainTaskPlan).toBeDefined();
    expect(mainTaskPlan.id).toBe('task_123');
    expect(mainTaskPlan.requiredRoles).toContain('researcher');

    // 测试 SubtaskPlan
    const subtaskPlan: SubtaskPlan = {
      id: 'task_123_research',
      type: 'research',
      title: '研究：修复身份验证漏洞',
      description: '调查身份验证模块以理解问题',
      assignedRole: 'researcher',
      dependencies: [],
      expectedOutput: '详细的代码分析报告',
      priority: 'high'
    };

    expect(subtaskPlan).toBeDefined();
    expect(subtaskPlan.type).toBe('research');
    expect(subtaskPlan.assignedRole).toBe('researcher');

    // 测试 TaskAssignment (新补充对象)
    const taskAssignment: TaskAssignment = {
      taskId: 'task_123',
      subtaskId: 'task_123_research',
      assignedRole: 'researcher',
      assignmentTime: Date.now(),
      assignmentRationale: '需要先理解代码库和问题',
      priority: 'high',
      resourceRequirements: {
        tools: ['FileReadTool', 'BashTool']
      },
      constraints: {
        maxDuration: 60000,
        retryLimit: 3
      },
      status: 'assigned'
    };

    expect(taskAssignment).toBeDefined();
    expect(taskAssignment.assignedRole).toBe('researcher');
    expect(taskAssignment.priority).toBe('high');
    expect(taskAssignment.resourceRequirements.tools).toContain('FileReadTool');
  });

  // ==================== 测试 2: AgentRuntimeState / MultiAgentRuntimeState 存在 ====================

  test('2. AgentRuntimeState / MultiAgentRuntimeState 对象存在且结构完整', () => {
    // 测试 AgentRuntimeState
    const agentState: AgentRuntimeState = {
      agentId: 'agent_1',
      role: 'researcher',
      currentTaskId: 'task_123_research',
      status: 'working',
      startTime: Date.now(),
      riskLevel: 'low',
      verificationStatus: 'not-needed',
      contextOverlap: 'fresh'
    };

    expect(agentState).toBeDefined();
    expect(agentState.agentId).toBe('agent_1');
    expect(agentState.role).toBe('researcher');
    expect(agentState.status).toBe('working');

    // 测试 MultiAgentRuntimeState
    const multiAgentState: MultiAgentRuntimeState = {
      taskId: 'task_123',
      agents: [agentState],
      overallStatus: 'in-progress',
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      riskAssessment: 'medium',
      verificationSummary: {
        required: 1,
        completed: 0,
        passed: 0,
        failed: 0
      }
    };

    expect(multiAgentState).toBeDefined();
    expect(multiAgentState.taskId).toBe('task_123');
    expect(multiAgentState.agents).toHaveLength(1);
    expect(multiAgentState.overallStatus).toBe('in-progress');
  });

  // ==================== 测试 3: BranchState / CoordinationCheckpoint / CoordinationSummary 存在 ====================

  test('3. BranchState / CoordinationCheckpoint / CoordinationSummary 对象存在且结构完整', () => {
    // 测试 BranchState (增强版)
    const branchState: BranchState = {
      branchId: 'branch_1',
      taskId: 'task_123',
      strategy: 'exploratory',
      description: '探索不同的修复方案',
      assignedRole: 'explorer',
      status: 'running',
      startTime: Date.now(),
      progress: 30,
      goals: ['找到所有可能的修复方案', '评估每种方案的风险'],
      successCriteria: ['至少找到3种可行方案', '完成风险评估'],
      constraints: {
        timeout: 300000
      },
      intermediateResults: [],
      errors: [],
      warnings: [],
      metrics: {
        explorationScore: 75,
        noveltyScore: 60
      },
      context: {
        sharedContextIds: [],
        isolationLevel: 'partial',
        contextSize: 1024
      }
    };

    expect(branchState).toBeDefined();
    expect(branchState.branchId).toBe('branch_1');
    expect(branchState.strategy).toBe('exploratory');
    expect(branchState.progress).toBe(30);

    // 测试 CoordinationCheckpoint (新补充对象)
    const checkpoint: CoordinationCheckpoint = {
      checkpointId: 'checkpoint_1',
      taskId: 'task_123',
      timestamp: Date.now(),
      phase: 'research',
      stateSnapshot: {
        taskStates: {
          'task_123_research': 'running'
        },
        agentStates: {
          'agent_1': 'working'
        },
        resourceUsage: {
          memory: { 'agent_1': '256MB' },
          cpu: { 'agent_1': 30 },
          activeAgents: 1
        }
      },
      decisions: [{
        decisionId: 'decision_1',
        type: 'assignment',
        description: '分配研究任务给研究员',
        rationale: '需要先理解问题'
      }],
      metrics: {
        progress: 20,
        quality: 85,
        efficiency: 75,
        coordinationOverhead: 15
      },
      validation: {
        passed: true,
        issues: [],
        recommendations: []
      }
    };

    expect(checkpoint).toBeDefined();
    expect(checkpoint.checkpointId).toBe('checkpoint_1');
    expect(checkpoint.phase).toBe('research');
    expect(checkpoint.metrics.progress).toBe(20);

    // 测试 CoordinationSummary (新补充对象)
    const summary: CoordinationSummary = {
      summaryId: 'summary_1',
      taskId: 'task_123',
      timestamp: Date.now(),
      duration: 120000,
      overview: {
        totalTasks: 3,
        completedTasks: 1,
        failedTasks: 0,
        totalAgents: 2,
        activeAgents: 1,
        coordinationDecisions: 5
      },
      performance: {
        averageTaskDuration: 40000,
        taskSuccessRate: 100,
        resourceEfficiency: 85,
        coordinationEfficiency: 90,
        overallThroughput: 75
      },
      quality: {
        codeQuality: 88,
        testCoverage: 92
      },
      insights: [{
        category: 'success',
        description: '研究阶段完成顺利',
        impact: 'medium'
      }],
      recommendations: [{
        priority: 'low',
        area: 'coordination',
        suggestion: '增加并行研究任务',
        expectedImpact: '提高研究效率20%'
      }]
    };

    expect(summary).toBeDefined();
    expect(summary.summaryId).toBe('summary_1');
    expect(summary.overview.totalTasks).toBe(3);
    expect(summary.performance.taskSuccessRate).toBe(100);
  });

  // ==================== 测试 4: WorkflowStage / TaskDependencyGraph 存在 ====================

  test('4. WorkflowStage / TaskDependencyGraph 对象存在且结构完整', () => {
    // 测试 WorkflowStage (新补充对象)
    const workflowStage: WorkflowStage = {
      stageId: 'stage_research',
      name: '研究阶段',
      description: '调查代码库，理解问题',
      phase: 'research',
      entryCriteria: ['任务已分解', '研究员可用'],
      exitCriteria: ['完成分析报告', '识别根本原因'],
      tasks: ['task_123_research'],
      roles: ['researcher', 'explorer'],
      concurrencyLimit: 2,
      timeout: 300000,
      status: 'active',
      startTime: Date.now(),
      metrics: {
        taskCount: 1,
        completedTasks: 0,
        successRate: 0,
        averageDuration: 0
      }
    };

    expect(workflowStage).toBeDefined();
    expect(workflowStage.stageId).toBe('stage_research');
    expect(workflowStage.phase).toBe('research');
    expect(workflowStage.roles).toContain('researcher');

    // 测试 TaskDependencyGraph (新补充对象)
    const dependencyGraph: TaskDependencyGraph = {
      taskId: 'task_123',
      nodes: [{
        taskId: 'task_123_research',
        type: 'research',
        status: 'running'
      }, {
        taskId: 'task_123_implementation',
        type: 'implementation',
        status: 'pending'
      }],
      edges: [{
        fromTaskId: 'task_123_research',
        toTaskId: 'task_123_implementation',
        dependencyType: 'hard',
        description: '实现依赖研究结果',
        required: true
      }],
      cycles: [],
      criticalPath: ['task_123_research', 'task_123_implementation'],
      longestPathDuration: 90000,
      isAcyclic: true,
      dependencyLevels: {
        'task_123_research': 0,
        'task_123_implementation': 1
      }
    };

    expect(dependencyGraph).toBeDefined();
    expect(dependencyGraph.taskId).toBe('task_123');
    expect(dependencyGraph.nodes).toHaveLength(2);
    expect(dependencyGraph.edges[0].dependencyType).toBe('hard');
    expect(dependencyGraph.isAcyclic).toBe(true);
  });

  // ==================== 测试 5: ContextDecisionState / ContextOverlapState 存在 ====================

  test('5. ContextDecisionState / ContextOverlapState 对象存在且结构完整', () => {
    // 测试 ContextDecisionState (新补充对象)
    const contextDecision: ContextDecisionState = {
      decisionId: 'context_decision_1',
      taskId: 'task_123',
      subtaskId: 'task_123_research',
      decisionType: 'fresh',
      rationale: '研究任务需要干净的上下文',
      factors: {
        contextOverlap: 0.1,
        contextRelevance: 0.8,
        contextFreshness: 1.0,
        performanceImpact: 0.9,
        riskLevel: 'low'
      },
      decision: {
        contextAction: 'create',
        isolationLevel: 'full',
        sharingPolicy: 'none'
      },
      timestamp: Date.now()
    };

    expect(contextDecision).toBeDefined();
    expect(contextDecision.decisionId).toBe('context_decision_1');
    expect(contextDecision.decisionType).toBe('fresh');
    expect(contextDecision.factors.contextOverlap).toBe(0.1);

    // 测试 ContextOverlapState (新补充对象)
    const contextOverlap: ContextOverlapState = {
      stateId: 'overlap_1',
      contextAId: 'context_1',
      contextBId: 'context_2',
      overlapType: 'partial',
      overlapScore: 0.4,
      overlappingElements: {
        files: [{
          path: '/src/auth/validate.ts',
          overlapScore: 0.8,
          lastAccessedDiff: 1000
        }],
        tools: ['FileReadTool'],
        skills: [],
        conversationTopics: ['身份验证']
      },
      implications: {
        canShare: true,
        recommendedAction: 'share',
        efficiencyGain: 30,
        riskLevel: 'low'
      },
      timestamp: Date.now()
    };

    expect(contextOverlap).toBeDefined();
    expect(contextOverlap.stateId).toBe('overlap_1');
    expect(contextOverlap.overlapType).toBe('partial');
    expect(contextOverlap.overlapScore).toBe(0.4);
    expect(contextOverlap.implications.canShare).toBe(true);
  });

  // ==================== 测试 6: AssignmentTrace / DecisionTrace / StateTransitionRecord 存在 ====================

  test('6. AssignmentTrace / DecisionTrace / StateTransitionRecord 对象存在且结构完整', () => {
    // 测试 AssignmentTrace (新补充对象)
    const assignmentTrace: AssignmentTrace = {
      traceId: 'trace_assign_1',
      taskId: 'task_123',
      assignments: [{
        assignmentId: 'assign_1',
        assignedRole: 'researcher',
        assignmentTime: Date.now(),
        assignmentRationale: '需要研究专家',
        constraints: {
          priority: 'high'
        },
        status: 'assigned',
        statusTransitions: [{
          from: 'pending',
          to: 'assigned',
          timestamp: Date.now(),
          reason: '协调者分配'
        }]
      }],
      analysis: {
        assignmentCount: 1,
        averageAssignmentDuration: 0,
        successRate: 0,
        roleDistribution: { researcher: 1 },
        agentPerformance: {}
      }
    };

    expect(assignmentTrace).toBeDefined();
    expect(assignmentTrace.traceId).toBe('trace_assign_1');
    expect(assignmentTrace.assignments).toHaveLength(1);
    expect(assignmentTrace.assignments[0].assignedRole).toBe('researcher');

    // 测试 DecisionTrace (新补充对象)
    const decisionTrace: DecisionTrace = {
      traceId: 'trace_decision_1',
      taskId: 'task_123',
      decisions: [{
        decisionId: 'decision_1',
        type: 'role',
        timestamp: Date.now(),
        decisionMaker: 'coordinator',
        inputs: {
          taskState: { status: 'pending' }
        },
        alternatives: [{
          option: '分配研究员',
          evaluation: {
            score: 85,
            pros: ['专业对口', '效率高'],
            cons: ['可能资源紧张'],
            risks: ['研究员可能忙']
          }
        }],
        selectedAlternative: {
          option: '分配研究员',
          rationale: '研究任务需要专业知识',
          expectedOutcome: '完成问题分析'
        },
        metadata: {
          decisionTime: 150,
          confidence: 0.9,
          rulesApplied: ['dsxu-research-parallel']
        }
      }],
      summary: {
        totalDecisions: 1,
        decisionTypes: { role: 1 },
        successRate: 0,
        averageConfidence: 0.9,
        commonPatterns: [],
        improvementAreas: []
      }
    };

    expect(decisionTrace).toBeDefined();
    expect(decisionTrace.traceId).toBe('trace_decision_1');
    expect(decisionTrace.decisions).toHaveLength(1);
    expect(decisionTrace.decisions[0].type).toBe('role');
    expect(decisionTrace.decisions[0].metadata.confidence).toBe(0.9);

    // 测试 StateTransitionRecord (新补充对象)
    const stateTransition: StateTransitionRecord = {
      recordId: 'transition_1',
      entityType: 'task',
      entityId: 'task_123_research',
      transitions: [{
        transitionId: 'trans_1',
        fromState: 'pending',
        toState: 'running',
        timestamp: Date.now(),
        trigger: {
          type: 'manual',
          source: 'coordinator',
          details: '任务开始执行'
        },
        conditions: {
          preconditions: ['研究员已分配', '上下文已准备'],
          postconditions: ['任务状态更新', '开始计时'],
          invariants: ['任务ID不变']
        },
        validation: {
          isValid: true
        },
        metadata: {
          transitionDuration: 50
        }
      }],
      analysis: {
        totalTransitions: 1,
        transitionFrequency: { 'pending->running': 1 },
        averageTransitionDuration: 50,
        problematicTransitions: [],
        stability: {
          steadyStates: ['completed', 'failed'],
          unstableStates: ['running']
        }
      }
    };

    expect(stateTransition).toBeDefined();
    expect(stateTransition.recordId).toBe('transition_1');
    expect(stateTransition.entityType).toBe('task');
    expect(stateTransition.transitions[0].fromState).toBe('pending');
    expect(stateTransition.transitions[0].toState).toBe('running');
  });

  // ==================== 测试 7: 状态模型可表达多个并行分支与多个角色 ====================

  test('7. 状态模型可表达多个并行分支与多个角色', () => {
    // 创建多个分支状态
    const branch1: BranchState = {
      branchId: 'branch_explore_1',
      taskId: 'task_123',
      strategy: 'exploratory',
      description: '探索方案A',
      assignedRole: 'explorer',
      status: 'running',
      startTime: Date.now(),
      progress: 40,
      goals: ['探索方案A'],
      successCriteria: ['完成方案A评估'],
      intermediateResults: [],
      errors: [],
      warnings: [],
      context: {
        sharedContextIds: [],
        isolationLevel: 'partial',
        contextSize: 512
      }
    };

    const branch2: BranchState = {
      branchId: 'branch_explore_2',
      taskId: 'task_123',
      strategy: 'exploratory',
      description: '探索方案B',
      assignedRole: 'explorer',
      status: 'running',
      startTime: Date.now(),
      progress: 35,
      goals: ['探索方案B'],
      successCriteria: ['完成方案B评估'],
      intermediateResults: [],
      errors: [],
      warnings: [],
      context: {
        sharedContextIds: [],
        isolationLevel: 'partial',
        contextSize: 512
      }
    };

    const branch3: BranchState = {
      branchId: 'branch_implement',
      taskId: 'task_123',
      strategy: 'sequential',
      description: '实现选定方案',
      assignedRole: 'implementer',
      status: 'pending',
      startTime: Date.now(),
      progress: 0,
      goals: ['实现修复'],
      successCriteria: ['代码通过测试'],
      intermediateResults: [],
      errors: [],
      warnings: [],
      context: {
        sharedContextIds: ['context_shared'],
        isolationLevel: 'none',
        contextSize: 1024
      }
    };

    // 验证多个分支
    expect(branch1.branchId).toBe('branch_explore_1');
    expect(branch2.branchId).toBe('branch_explore_2');
    expect(branch3.branchId).toBe('branch_implement');

    // 验证不同角色
    expect(branch1.assignedRole).toBe('explorer');
    expect(branch2.assignedRole).toBe('explorer');
    expect(branch3.assignedRole).toBe('implementer');

    // 验证不同策略
    expect(branch1.strategy).toBe('exploratory');
    expect(branch2.strategy).toBe('exploratory');
    expect(branch3.strategy).toBe('sequential');

    // 验证不同状态
    expect(branch1.status).toBe('running');
    expect(branch2.status).toBe('running');
    expect(branch3.status).toBe('pending');

    // 验证不同进度
    expect(branch1.progress).toBe(40);
    expect(branch2.progress).toBe(35);
    expect(branch3.progress).toBe(0);
  });

  // ==================== 测试 8: 不引入第二套 coordinator 主实现 ====================

  test('8. 验证所有对象都来自 coordinator-types-v1.ts，没有第二套实现', () => {
    // 验证基础类型
    expect(typeof TaskRiskLevel).toBe('string');
    expect(typeof VerificationRequirement).toBe('string');
    expect(typeof ContextOverlapType).toBe('string');

    // 验证角色配置
    expect(AGENT_ROLE_CONFIGS.worker).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.researcher).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.implementer).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.verifier).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.coordinator).toBeDefined();

    // 验证新补充的对象（V10-2B）
    // 这些类型应该存在
    expect(typeof TaskAssignment).toBe('function');
    expect(typeof TaskDependencyGraph).toBe('function');
    expect(typeof WorkflowStage).toBe('function');
    expect(typeof CoordinationPlan).toBe('function');
    expect(typeof AgentExecutionContext).toBe('function');
    expect(typeof AgentCapabilityProfile).toBe('function');
    expect(typeof CoordinationCheckpoint).toBe('function');
    expect(typeof CoordinationSummary).toBe('function');
    expect(typeof CoordinationHealthState).toBe('function');
    expect(typeof BranchState).toBe('function');
    expect(typeof ContextDecisionState).toBe('function');
    expect(typeof ContextOverlapState).toBe('function');
    expect(typeof SharedContextSlice).toBe('function');
    expect(typeof AssignmentTrace).toBe('function');
    expect(typeof DecisionTrace).toBe('function');
    expect(typeof StateTransitionRecord).toBe('function');

    // 验证生命周期协议类型
    expect(typeof TaskExecutionStatus).toBe('string');
    expect(typeof ForkStrategy).toBe('string');
    expect(typeof isTerminalTaskStatus).toBe('function');
  });

  // ==================== 附加测试：对象模型完整性 ====================

  test('附加测试：验证对象模型的完整性和DSXU语义吸收', () => {
    // 测试 CoordinationPlan 的完整性
    const coordinationPlan: CoordinationPlan = {
      planId: 'plan_1',
      taskId: 'task_123',
      strategy: 'parallel',
      phases: [],
      roleAllocations: {
        researcher: 1,
        explorer: 2,
        implementer: 1,
        verifier: 1,
        coordinator: 1,
        worker: 0,
        specialist: 0
      },
      resourceAllocations: {
        memory: { 'task_123_research': '512MB' },
        cpu: { 'task_123_research': '2 cores' }
      },
      constraints: {
        maxTotalAgents: 5,
        maxConcurrentTasks: 3,
        maxMemoryUsage: '2GB',
        maxDuration: 600000
      },
      fallbackStrategies: [{
        condition: '研究任务失败',
        action: 'replan',
        target: '研究阶段'
      }],
      qualityGates: [{
        gateId: 'gate_research',
        condition: '研究完成',
        metrics: ['完成度', '准确性'],
        thresholds: { 完成度: 80, 准确性: 90 },
        action: 'proceed'
      }]
    };

    expect(coordinationPlan).toBeDefined();
    expect(coordinationPlan.strategy).toBe('parallel');
    expect(coordinationPlan.roleAllocations.researcher).toBe(1);
    expect(coordinationPlan.roleAllocations.explorer).toBe(2);
    expect(coordinationPlan.constraints.maxTotalAgents).toBe(5);

    // 测试 AgentCapabilityProfile 的完整性
    const capabilityProfile: AgentCapabilityProfile = {
      agentId: 'agent_expert_1',
      role: 'specialist',
      capabilities: [{
        category: 'code',
        skill: '安全审计',
        proficiency: 'expert',
        evidence: ['完成5个安全项目', '发现10个高危漏洞'],
        successRate: 95
      }],
      toolProficiency: {
        'SecurityScanner': {
          familiarity: 'expert',
          successRate: 90
        }
      },
      domainKnowledge: [{
        domain: '网络安全',
        depth: 'expert',
        topics: ['身份验证', '加密', '漏洞利用']
      }],
      performanceMetrics: {
        averageTaskDuration: 3600000,
        successRate: 95,
        qualityScore: 92,
        efficiencyScore: 88,
        collaborationScore: 85
      },
      constraints: {
        maxConcurrentTasks: 1,
        preferredTaskTypes: ['verification'],
        avoidedTaskTypes: ['exploration'],
        resourceLimits: {
          maxMemory: '1GB',
          maxCpu: '4 cores'
        }
      }
    };

    expect(capabilityProfile).toBeDefined();
    expect(capabilityProfile.role).toBe('specialist');
    expect(capabilityProfile.capabilities[0].proficiency).toBe('expert');
    expect(capabilityProfile.performanceMetrics.successRate).toBe(95);

    // 测试 SharedContextSlice 的完整性
    const sharedContext: SharedContextSlice = {
      sliceId: 'slice_research',
      sourceContextId: 'context_researcher_1',
      contentType: 'mixed',
      content: {
        files: [{
          path: '/src/auth/validate.ts',
          relevance: 0.9,
          lastModified: Date.now()
        }],
        conversation: [{
          role: 'assistant',
          content: '发现空指针在validate.ts:42',
          timestamp: Date.now()
        }]
      },
      metadata: {
        size: 2048,
        freshness: 0.95,
        relevance: 0.9,
        sensitivity: 'medium'
      },
      sharingPolicy: {
        allowedConsumers: ['agent_implementer', 'agent_verifier'],
        accessLevel: 'read',
        validationRequired: true,
        auditTrail: true
      }
    };

    expect(sharedContext).toBeDefined();
    expect(sharedContext.sliceId).toBe('slice_research');
    expect(sharedContext.contentType).toBe('mixed');
    expect(sharedContext.content.files![0].path).toBe('/src/auth/validate.ts');
    expect(sharedContext.metadata.relevance).toBe(0.9);
    expect(sharedContext.sharingPolicy.allowedConsumers).toContain('agent_implementer');

    // 测试 CoordinationHealthState 的完整性
    const healthState: CoordinationHealthState = {
      taskId: 'task_123',
      timestamp: Date.now(),
      overallHealth: 'healthy',
      components: {
        planning: {
          health: 'healthy',
          issues: [],
          score: 92
        },
        execution: {
          health: 'healthy',
          issues: ['一个任务进度稍慢'],
          score: 85
        },
        coordination: {
          health: 'healthy',
          issues: [],
          score: 88
        },
        resources: {
          health: 'healthy',
          issues: [],
          score: 90
        }
      },
      metrics: {
        taskCompletionRate: 33,
        agentUtilization: 75,
        coordinationOverhead: 15,
        errorRate: 5,
        recoverySuccessRate: 100
      },
      alerts: [{
        level: 'info',
        component: 'execution',
        message: '任务进度稍慢，但仍在正常范围内',
        timestamp: Date.now(),
        acknowledged: false
      }],
      recommendations: [{
        component: 'execution',
        action: '监控慢速任务，必要时提供协助',
        priority: 'low',
        estimatedEffort: 'low'
      }]
    };

    expect(healthState).toBeDefined();
    expect(healthState.overallHealth).toBe('healthy');
    expect(healthState.components.execution.score).toBe(85);
    expect(healthState.metrics.agentUtilization).toBe(75);
    expect(healthState.alerts[0].level).toBe('info');
  });
});

  test('2. AgentRuntimeState / MultiAgentRuntimeState 对象存在且结构完整', () => {
    // 测试 AgentRuntimeState
    const agentState: AgentRuntimeState = {
      agentId: 'agent_1',
      role: 'researcher',
      currentTaskId: 'task_123_research',
      status: 'working',
      startTime: Date.now(),
      riskLevel: 'low',
      verificationStatus: 'not-needed',
      contextOverlap: 'fresh'
    };

    expect(agentState).toBeDefined();
    expect(agentState.agentId).toBe('agent_1');
    expect(agentState.role).toBe('researcher');
    expect(agentState.status).toBe('working');

    // 测试 MultiAgentRuntimeState
    const multiAgentState: MultiAgentRuntimeState = {
      taskId: 'task_123',
      agents: [agentState],
      overallStatus: 'in-progress',
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      riskAssessment: 'medium',
      verificationSummary: {
        required: 1,
        completed: 0,
        passed: 0,
        failed: 0
      }
    };

    expect(multiAgentState).toBeDefined();
    expect(multiAgentState.taskId).toBe('task_123');
    expect(multiAgentState.agents).toHaveLength(1);
    expect(multiAgentState.overallStatus).toBe('in-progress');
  });

  // ==================== 测试 3: BranchState / CoordinationCheckpoint / CoordinationSummary 存在 ====================

  test('3. BranchState / CoordinationCheckpoint / CoordinationSummary 对象存在且结构完整', () => {
    // 测试 BranchState (增强版)
    const branchState: BranchState = {
      branchId: 'branch_1',
      taskId: 'task_123',
      strategy: 'exploratory',
      description: '探索不同的修复方案',
      assignedRole: 'explorer',
      status: 'running',
      startTime: Date.now(),
      progress: 30,
      goals: ['找到所有可能的修复方案', '评估每种方案的风险'],
      successCriteria: ['至少找到3种可行方案', '完成风险评估'],
      constraints: {
        timeout: 300000
      },
      intermediateResults: [],
      errors: [],
      warnings: [],
      metrics: {
        explorationScore: 75,
        noveltyScore: 60
      },
      context: {
        sharedContextIds: [],
        isolationLevel: 'partial',
        contextSize: 1024
      }
    };

    expect(branchState).toBeDefined();
    expect(branchState.branchId).toBe('branch_1');
    expect(branchState.strategy).toBe('exploratory');
    expect(branchState.progress).toBe(30);

    // 测试 CoordinationCheckpoint (新补充对象)
    const checkpoint: CoordinationCheckpoint = {
      checkpointId: 'checkpoint_1',
      taskId: 'task_123',
      timestamp: Date.now(),
      phase: 'research',
      stateSnapshot: {
        taskStates: {
          'task_123_research': 'running'
        },
        agentStates: {
          'agent_1': 'working'
        },
        resourceUsage: {
          memory: { 'agent_1': '256MB' },
          cpu: { 'agent_1': 30 },
          activeAgents: 1
        }
      },
      decisions: [{
        decisionId: 'decision_1',
        type: 'assignment',
        description: '分配研究任务给研究员',
        rationale: '需要先理解问题'
      }],
      metrics: {
        progress: 20,
        quality: 85,
        efficiency: 75,
        coordinationOverhead: 15
      },
      validation: {
        passed: true,
        issues: [],
        recommendations: []
      }
    };

    expect(checkpoint).toBeDefined();
    expect(checkpoint.checkpointId).toBe('checkpoint_1');
    expect(checkpoint.phase).toBe('research');
    expect(checkpoint.metrics.progress).toBe(20);

    // 测试 CoordinationSummary (新补充对象)
    const summary: CoordinationSummary = {
      summaryId: 'summary_1',
      taskId: 'task_123',
      timestamp: Date.now(),
      duration: 120000,
      overview: {
        totalTasks: 3,
        completedTasks: 1,
        failedTasks: 0,
        totalAgents: 2,
        activeAgents: 1,
        coordinationDecisions: 5
      },
      performance: {
        averageTaskDuration: 40000,
        taskSuccessRate: 100,
        resourceEfficiency: 85,
        coordinationEfficiency: 90,
        overallThroughput: 75
      },
      quality: {
        codeQuality: 88,
        testCoverage: 92
      },
      insights: [{
        category: 'success',
        description: '研究阶段完成顺利',
        impact: 'medium'
      }],
      recommendations: [{
        priority: 'low',
        area: 'coordination',
        suggestion: '增加并行研究任务',
        expectedImpact: '提高研究效率20%'
      }]
    };

    expect(summary).toBeDefined();
    expect(summary.summaryId).toBe('summary_1');
    expect(summary.overview.totalTasks).toBe(3);
    expect(summary.performance.taskSuccessRate).toBe(100);
  });

  // ==================== 测试 4: WorkflowStage / TaskDependencyGraph 存在 ====================

  test('4. WorkflowStage / TaskDependencyGraph 对象存在且结构完整', () => {
    // 测试 WorkflowStage (新补充对象)
    const workflowStage: WorkflowStage = {
      stageId: 'stage_research',
      name: '研究阶段',
      description: '调查代码库，理解问题',
      phase: 'research',
      entryCriteria: ['任务已分解', '研究员可用'],
      exitCriteria: ['完成分析报告', '识别根本原因'],
      tasks: ['task_123_research'],
      roles: ['researcher', 'explorer'],
      concurrencyLimit: 2,
      timeout: 300000,
      status: 'active',
      startTime: Date.now(),
      metrics: {
        taskCount: 1,
        completedTasks: 0,
        successRate: 0,
        averageDuration: 0
      }
    };

    expect(workflowStage).toBeDefined();
    expect(workflowStage.stageId).toBe('stage_research');
    expect(workflowStage.phase).toBe('research');
    expect(workflowStage.roles).toContain('researcher');

    // 测试 TaskDependencyGraph (新补充对象)
    const dependencyGraph: TaskDependencyGraph = {
      taskId: 'task_123',
      nodes: [{
        taskId: 'task_123_research',
        type: 'research',
        status: 'running'
      }, {
        taskId: 'task_123_implementation',
        type: 'implementation',
        status: 'pending'
      }],
      edges: [{
        fromTaskId: 'task_123_research',
        toTaskId: 'task_123_implementation',
        dependencyType: 'hard',
        description: '实现依赖研究结果',
        required: true
      }],
      cycles: [],
      criticalPath: ['task_123_research', 'task_123_implementation'],
      longestPathDuration: 90000,
      isAcyclic: true,
      dependencyLevels: {
        'task_123_research': 0,
        'task_123_implementation': 1
      }
    };

    expect(dependencyGraph).toBeDefined();
    expect(dependencyGraph.taskId).toBe('task_123');
    expect(dependencyGraph.nodes).toHaveLength(2);
    expect(dependencyGraph.edges[0].dependencyType).toBe('hard');
    expect(dependencyGraph.isAcyclic).toBe(true);
  });

  // ==================== 测试 5: ContextDecisionState / ContextOverlapState 存在 ====================

  test('5. ContextDecisionState / ContextOverlapState 对象存在且结构完整', () => {
    // 测试 ContextDecisionState (新补充对象)
    const contextDecision: ContextDecisionState = {
      decisionId: 'context_decision_1',
      taskId: 'task_123',
      subtaskId: 'task_123_research',
      decisionType: 'fresh',
      rationale: '研究任务需要干净的上下文',
      factors: {
        contextOverlap: 0.1,
        contextRelevance: 0.8,
        contextFreshness: 1.0,
        performanceImpact: 0.9,
        riskLevel: 'low'
      },
      decision: {
        contextAction: 'create',
        isolationLevel: 'full',
        sharingPolicy: 'none'
      },
      timestamp: Date.now()
    };

    expect(contextDecision).toBeDefined();
    expect(contextDecision.decisionId).toBe('context_decision_1');
    expect(contextDecision.decisionType).toBe('fresh');
    expect(contextDecision.factors.contextOverlap).toBe(0.1);

    // 测试 ContextOverlapState (新补充对象)
    const contextOverlap: ContextOverlapState = {
      stateId: 'overlap_1',
      contextAId: 'context_1',
      contextBId: 'context_2',
      overlapType: 'partial',
      overlapScore: 0.4,
      overlappingElements: {
        files: [{
          path: '/src/auth/validate.ts',
          overlapScore: 0.8,
          lastAccessedDiff: 1000
        }],
        tools: ['FileReadTool'],
        skills: [],
        conversationTopics: ['身份验证']
      },
      implications: {
        canShare: true,
        recommendedAction: 'share',
        efficiencyGain: 30,
        riskLevel: 'low'
      },
      timestamp: Date.now()
    };

    expect(contextOverlap).toBeDefined();
    expect(contextOverlap.stateId).toBe('overlap_1');
    expect(contextOverlap.overlapType).toBe('partial');
    expect(contextOverlap.overlapScore).toBe(0.4);
    expect(contextOverlap.implications.canShare).toBe(true);
  });

  // ==================== 测试 6: AssignmentTrace / DecisionTrace / StateTransitionRecord 存在 ====================

  test('6. AssignmentTrace / DecisionTrace / StateTransitionRecord 对象存在且结构完整', () => {
    // 测试 AssignmentTrace (新补充对象)
    const assignmentTrace: AssignmentTrace = {
      traceId: 'trace_assign_1',
      taskId: 'task_123',
      assignments: [{
        assignmentId: 'assign_1',
        assignedRole: 'researcher',
        assignmentTime: Date.now(),
        assignmentRationale: '需要研究专家',
        constraints: {
          priority: 'high'
        },
        status: 'assigned',
        statusTransitions: [{
          from: 'pending',
          to: 'assigned',
          timestamp: Date.now(),
          reason: '协调者分配'
        }]
      }],
      analysis: {
        assignmentCount: 1,
        averageAssignmentDuration: 0,
        successRate: 0,
        roleDistribution: { researcher: 1 },
        agentPerformance: {}
      }
    };

    expect(assignmentTrace).toBeDefined();
    expect(assignmentTrace.traceId).toBe('trace_assign_1');
    expect(assignmentTrace.assignments).toHaveLength(1);
    expect(assignmentTrace.assignments[0].assignedRole).toBe('researcher');

    // 测试 DecisionTrace (新补充对象)
    const decisionTrace: DecisionTrace = {
      traceId: 'trace_decision_1',
      taskId: 'task_123',
      decisions: [{
        decisionId: 'decision_1',
        type: 'role',
        timestamp: Date.now(),
        decisionMaker: 'coordinator',
        inputs: {
          taskState: { status: 'pending' }
        },
        alternatives: [{
          option: '分配研究员',
          evaluation: {
            score: 85,
            pros: ['专业对口', '效率高'],
            cons: ['可能资源紧张'],
            risks: ['研究员可能忙']
          }
        }],
        selectedAlternative: {
          option: '分配研究员',
          rationale: '研究任务需要专业知识',
          expectedOutcome: '完成问题分析'
        },
        metadata: {
          decisionTime: 150,
          confidence: 0.9,
          rulesApplied: ['dsxu-research-parallel']
        }
      }],
      summary: {
        totalDecisions: 1,
        decisionTypes: { role: 1 },
        successRate: 0,
        averageConfidence: 0.9,
        commonPatterns: [],
        improvementAreas: []
      }
    };

    expect(decisionTrace).toBeDefined();
    expect(decisionTrace.traceId).toBe('trace_decision_1');
    expect(decisionTrace.decisions).toHaveLength(1);
    expect(decisionTrace.decisions[0].type).toBe('role');
    expect(decisionTrace.decisions[0].metadata.confidence).toBe(0.9);

    // 测试 StateTransitionRecord (新补充对象)
    const stateTransition: StateTransitionRecord = {
      recordId: 'transition_1',
      entityType: 'task',
      entityId: 'task_123_research',
      transitions: [{
        transitionId: 'trans_1',
        fromState: 'pending',
        toState: 'running',
        timestamp: Date.now(),
        trigger: {
          type: 'manual',
          source: 'coordinator',
          details: '任务开始执行'
        },
        conditions: {
          preconditions: ['研究员已分配', '上下文已准备'],
          postconditions: ['任务状态更新', '开始计时'],
          invariants: ['任务ID不变']
        },
        validation: {
          isValid: true
        },
        metadata: {
          transitionDuration: 50
        }
      }],
      analysis: {
        totalTransitions: 1,
        transitionFrequency: { 'pending->running': 1 },
        averageTransitionDuration: 50,
        problematicTransitions: [],
        stability: {
          steadyStates: ['completed', 'failed'],
          unstableStates: ['running']
        }
      }
    };

    expect(stateTransition).toBeDefined();
    expect(stateTransition.recordId).toBe('transition_1');
    expect(stateTransition.entityType).toBe('task');
    expect(stateTransition.transitions[0].fromState).toBe('pending');
    expect(stateTransition.transitions[0].toState).toBe('running');
  });

  // ==================== 测试 7: 状态模型可表达多个并行分支与多个角色 ====================

  test('7. 状态模型可表达多个并行分支与多个角色', () => {
    // 创建多个分支状态
    const branch1: BranchState = {
      branchId: 'branch_explore_1',
      taskId: 'task_123',
      strategy: 'exploratory',
      description: '探索方案A',
      assignedRole: 'explorer',
      status: 'running',
      startTime: Date.now(),
      progress: 40,
      goals: ['探索方案A'],
      successCriteria: ['完成方案A评估'],
      intermediateResults: [],
      errors: [],
      warnings: [],
      context: {
        sharedContextIds: [],
        isolationLevel: 'partial',
        contextSize: 512
      }
    };

    const branch2: BranchState = {
      branchId: 'branch_explore_2',
      taskId: 'task_123',
      strategy: 'exploratory',
      description: '探索方案B',
      assignedRole: 'explorer',
      status: 'running',
      startTime: Date.now(),
      progress: 35,
      goals: ['探索方案B'],
      successCriteria: ['完成方案B评估'],
      intermediateResults: [],
      errors: [],
      warnings: [],
      context: {
        sharedContextIds: [],
        isolationLevel: 'partial',
        contextSize: 512
      }
    };

    const branch3: BranchState = {
      branchId: 'branch_implement',
      taskId: 'task_123',
      strategy: 'sequential',
      description: '实现选定方案',
      assignedRole: 'implementer',
      status: 'pending',
      startTime: Date.now(),
      progress: 0,
      goals: ['实现修复'],
      successCriteria: ['代码通过测试'],
      intermediateResults: [],
      errors: [],
      warnings: [],
      context: {
        sharedContextIds: ['context_shared'],
        isolationLevel: 'none',
        contextSize: 1024
      }
    };

    // 验证多个分支
    expect(branch1.branchId).toBe('branch_explore_1');
    expect(branch2.branchId).toBe('branch_explore_2');
    expect(branch3.branchId).toBe('branch_implement');

    // 验证不同角色
    expect(branch1.assignedRole).toBe('explorer');
    expect(branch2.assignedRole).toBe('explorer');
    expect(branch3.assignedRole).toBe('implementer');

    // 验证不同策略
    expect(branch1.strategy).toBe('exploratory');
    expect(branch2.strategy).toBe('exploratory');
    expect(branch3.strategy).toBe('sequential');

    // 验证不同状态
    expect(branch1.status).toBe('running');
    expect(branch2.status).toBe('running');
    expect(branch3.status).toBe('pending');

    // 验证不同进度
    expect(branch1.progress).toBe(40);
    expect(branch2.progress).toBe(35);
    expect(branch3.progress).toBe(0);

    // 创建多Agent运行时状态
    const multiAgentState: MultiAgentRuntimeState = {
      taskId: 'task_123',
      agents: [
        {
          agentId: 'agent_explorer_1',
          role: 'explorer',
          currentTaskId: 'branch_explore_1',
          status: 'working',
          startTime: Date.now(),
          riskLevel: 'low',
          verificationStatus: 'not-needed',
          contextOverlap: 'fresh'
        },
        {
          agentId: 'agent_explorer_2',
          role: 'explorer',
          currentTaskId: 'branch_explore_2',
          status: 'working',
          startTime: Date.now(),
          riskLevel: 'low',
          verificationStatus: 'not-needed',
          contextOverlap: 'fresh'
        },
        {
          agentId: 'agent_implementer',
          role: 'implementer',
          status: 'idle',
          startTime: Date.now(),
          riskLevel: 'medium',
          verificationStatus: 'pending',
          contextOverlap: 'fresh'
        }
      ],
      overallStatus: 'in-progress',
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      riskAssessment: 'medium',
      verificationSummary: {
        required: 1,
        completed: 0,
        passed: 0,
        failed: 0
      }
    };

    // 验证多Agent状态
    expect(multiAgentState.agents).toHaveLength(3);
    expect(multiAgentState.agents[0].role).toBe('explorer');
    expect(multiAgentState.agents[1].role).toBe('explorer');
    expect(multiAgentState.agents[2].role).toBe('implementer');
    expect(multiAgentState.overallStatus).toBe('in-progress');
  });

  // ==================== 测试 8: 不引入第二套 coordinator 主实现 ====================

  test('8. 验证所有对象都来自 coordinator-types-v1.ts，没有第二套实现', () => {
    // 验证基础类型
    expect(typeof TaskRiskLevel).toBe('string');
    expect(typeof VerificationRequirement).toBe('string');
    expect(typeof ContextOverlapType).toBe('string');

    // 验证角色配置
    expect(AGENT_ROLE_CONFIGS.worker).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.researcher).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.implementer).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.verifier).toBeDefined();
    expect(AGENT_ROLE_CONFIGS.coordinator).toBeDefined();

    // 验证规则集
    expect(DSXU_PARITY_RULES).toBeDefined();
    expect(DSXU_PARITY_RULES.length).toBeGreaterThan(0);
    expect(RISK_BASED_RULES).toBeDefined();
    expect(VERIFICATION_BASED_RULES).toBeDefined();

    // 验证工具函数
    expect(typeof recommendRoleForTask).toBe('function');
    expect(typeof recommendRoleForTaskEnhanced).toBe('function');
    expect(typeof isRoleSuitableForTask).toBe('function');
    expect(typeof isRoleSuitableForTaskEnhanced).toBe('function');
    expect(typeof applyRoleSelectionRules).toBe('function');
    expect(typeof createSimpleRoleRouting).toBe('function');
    expect(typeof createEnhancedRoleRouting).toBe('function');

    // 验证新补充的对象（V10-2B）
    // 这些类型应该存在且是接口
    expect(typeof TaskAssignment).toBe('function'); // TypeScript接口编译后是函数
    expect(typeof TaskDependencyGraph).toBe('function');
    expect(typeof WorkflowStage).toBe('function');
    expect(typeof CoordinationPlan).toBe('function');
    expect(typeof AgentExecutionContext).toBe('function');
    expect(typeof AgentCapabilityProfile).toBe('function');
    expect(typeof RoleExecutionConstraint).toBe('function');
    expect(typeof CoordinationCheckpoint).toBe('function');
    expect(typeof CoordinationSummary).toBe('function');
    expect(typeof CoordinationHealthState).toBe('function');
    expect(typeof BranchState).toBe('function');
    expect(typeof ContextDecisionState).toBe('function');
    expect(typeof ContextOverlapState).toBe('function');
    expect(typeof SharedContextSlice).toBe('function');
    expect(typeof IntermediateResultEnvelope).toBe('function');
    expect(typeof AssignmentTrace).toBe('function');
    expect(typeof DecisionTrace).toBe('function');
    expect(typeof StateTransitionRecord).toBe('function');

    // 验证生命周期协议类型（属于V10-2C，但已存在）
    expect(typeof TaskExecutionStatus).toBe('string');
    expect(typeof ForkStrategy).toBe('string');
    expect(typeof ForkExecutionPlan).toBe('function');
    expect(typeof BranchExecutionState).toBe('function');
    expect(typeof IntermediateResult).toBe('function');
    expect(typeof CollectedIntermediateResult).toBe('function');
    expect(typeof MergeCandidate).toBe('function');
    expect(typeof MergeResult).toBe('function');
    expect(typeof AbortReason).toBe('string');
    expect(typeof EscalationReason).toBe('string');
    expect(typeof EscalationDecision).toBe('function');
    expect(typeof LifecycleRecoveryHint).toBe('function');
    expect(typeof BranchComparison).toBe('function');
    expect(typeof LifecycleProtocolOutput).toBe('function');
    expect(typeof isTerminalTaskStatus).toBe('function');

    // 验证没有创建重复的类型
    // 这里可以添加更多的验证来确保没有重复定义
  });

  // ==================== 附加测试：对象模型完整性 ====================

  test('附加测试：验证对象模型的完整性和DSXU语义吸收', () => {
    // 测试 CoordinationPlan 的完整性
    const coordinationPlan: CoordinationPlan = {
      planId: 'plan_1',
      taskId: 'task_123',
      strategy: 'parallel',
      phases: [],
      roleAllocations: {
        researcher: 1,
        explorer: 2,
        implementer: 1,
        verifier: 1,
        coordinator: 1,
        worker: 0,
        specialist: 0
      },
      resourceAllocations: {
        memory: { 'task_123_research': '512MB' },
        cpu: { 'task_123_research': '2 cores' }
      },
      constraints: {
        maxTotalAgents: 5,
        maxConcurrentTasks: 3,
        maxMemoryUsage: '2GB',
        maxDuration: 600000
      },
      fallbackStrategies: [{
        condition: '研究任务失败',
        action: 'replan',
        target: '研究阶段'
      }],
      qualityGates: [{
        gateId: 'gate_research',
        condition: '研究完成',
        metrics: ['完成度', '准确性'],
        thresholds: { 完成度: 80, 准确性: 90 },
        action: 'proceed'
      }]
    };

    expect(coordinationPlan).toBeDefined();
    expect(coordinationPlan.strategy).toBe('parallel');
    expect(coordinationPlan.roleAllocations.researcher).toBe(1);
    expect(coordinationPlan.roleAllocations.explorer).toBe(2);
    expect(coordinationPlan.constraints.maxTotalAgents).toBe(5);

    // 测试 AgentCapabilityProfile 的完整性
    const capabilityProfile: AgentCapabilityProfile = {
      agentId: 'agent_expert_1',
      role: 'specialist',
      capabilities: [{
        category: 'code',
        skill: '安全审计',
        proficiency: 'expert',
        evidence: ['完成5个安全项目', '发现10个高危漏洞'],
        successRate: 95
      }],
      toolProficiency: {
        'SecurityScanner': {
          familiarity: 'expert',
          successRate: 90
        }
      },
      domainKnowledge: [{
        domain: '网络安全',
        depth: 'expert',
        topics: ['身份验证', '加密', '漏洞利用']
      }],
      performanceMetrics: {
        averageTaskDuration: 3600000,
        successRate: 95,
        qualityScore: 92,
        efficiencyScore: 88,
        collaborationScore: 85
      },
      constraints: {
        maxConcurrentTasks: 1,
        preferredTaskTypes: ['verification'],
        avoidedTaskTypes: ['exploration'],
        resourceLimits: {
          maxMemory: '1GB',
          maxCpu: '4 cores'
        }
      }
    };

    expect(capabilityProfile).toBeDefined();
    expect(capabilityProfile.role).toBe('specialist');
    expect(capabilityProfile.capabilities[0].proficiency).toBe('expert');
    expect(capabilityProfile.performanceMetrics.successRate).toBe(95);

    // 测试 SharedContextSlice 的完整性
    const sharedContext: SharedContextSlice = {
      sliceId: 'slice_research',
      sourceContextId: 'context_researcher_1',
      contentType: 'mixed',
      content: {
        files: [{
          path: '/src/auth/validate.ts',
          relevance: 0.9,
          lastModified: Date.now()
        }],
        conversation: [{
          role: 'assistant',
          content: '发现空指针在validate.ts:42',
          timestamp: Date.now()
        }],
        results: [{
          id: 'result_1',
          branchId: 'branch_1',
          timestamp: Date.now(),
          type: 'analysis',
          content: { issue: '空指针', location: 'validate.ts:42' },
          summary: '发现空指针问题',
          confidence: 0.95,
          isReusable: true,
          tags: ['bug', 'auth']
        }]
      },
      metadata: {
        size: 2048,
        freshness: 0.95,
        relevance: 0.9,
        sensitivity: 'medium'
      },
      sharingPolicy: {
        allowedConsumers: ['agent_implementer', 'agent_verifier'],
        accessLevel: 'read',
        validationRequired: true,
        auditTrail: true
      }
    };

    expect(sharedContext).toBeDefined();
    expect(sharedContext.sliceId).toBe('slice_research');
    expect(sharedContext.contentType).toBe('mixed');
    expect(sharedContext.content.files![0].path).toBe('/src/auth/validate.ts');
    expect(sharedContext.metadata.relevance).toBe(0.9);
    expect(sharedContext.sharingPolicy.allowedConsumers).toContain('agent_implementer');

    // 测试 CoordinationHealthState 的完整性
    const healthState: CoordinationHealthState = {
      taskId: 'task_123',
      timestamp: Date.now(),
      overallHealth: 'healthy',
      components: {
        planning: {
          health: 'healthy',
          issues: [],
          score: 92
        },
        execution: {
          health: 'healthy',
          issues: ['一个任务进度稍慢'],
          score: 85
        },
        coordination: {
          health: 'healthy',
          issues: [],
          score: 88
        },
        resources: {
          health: 'healthy',
          issues: [],
          score: 90
        }
      },
      metrics: {
        taskCompletionRate: 33,
        agentUtilization: 75,
        coordinationOverhead: 15,
        errorRate: 5,
        recoverySuccessRate: 100
      },
      alerts: [{
        level: 'info',
        component: 'execution',
        message: '任务进度稍慢，但仍在正常范围内',
        timestamp: Date.now(),
        acknowledged: false
      }],
      recommendations: [{
        component: 'execution',
        action: '监控慢速任务，必要时提供协助',
        priority: 'low',
        estimatedEffort: 'low'
      }]
    };

    expect(healthState).toBeDefined();
    expect(healthState.overallHealth).toBe('healthy');
    expect(healthState.components.execution.score).toBe(85);
    expect(healthState.metrics.agentUtilization).toBe(75);
    expect(healthState.alerts[0].level).toBe('info');
  });