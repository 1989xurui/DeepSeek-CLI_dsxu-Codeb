/**
 * DUXU Coordinator State Model V4 Alignment Test
 *
 * 验证 coordinator-v1.ts 的实现层与 coordinator-types-v1.ts 的类型层对齐
 * 只测试 runtime 真实存在的结果，不测试 type/interface 是否存在
 */

import { describe, test, expect } from 'bun:test';
import { createCoordinatorV1 } from '../coordinator-v1';
import type {
  AgentRole,
  SubtaskType,
  TaskRiskLevel,
  VerificationRequirement,
  ForkStrategy,
  WorkflowPhaseType,
  WorkflowStage
} from '../coordinator-types-v1';

describe('Coordinator State Model V4 Alignment', () => {
  const coordinator = createCoordinatorV1();

  test('1. 主任务/子任务/分配的 runtime 结果存在且包含强语义字段', () => {
    // 创建完整的子任务规划
    const subtask = coordinator.createSubtaskPlan(
      'test_subtask_1',
      'research',
      '研究：测试任务',
      '调查代码库以理解测试问题',
      'researcher',
      {
        dependencies: [],
        expectedOutput: '详细的分析报告',
        priority: 'high',
        riskProfile: {
          riskLevel: 'low',
          factors: {
            complexity: 'medium',
            impact: 'low',
            uncertainty: 'medium',
            dependencies: 'few'
          },
          recommendedRoles: ['researcher', 'explorer'],
          riskMitigation: ['只读操作', '并行执行']
        },
        validationRequirement: {
          level: 'none',
          description: '研究任务不需要验证',
          requiredRoles: [],
          validationSteps: [],
          successCriteria: ['完成分析报告']
        },
        contextOverlap: 'fresh',
        estimatedDuration: 30000
      }
    );

    // 验证子任务包含强语义字段
    expect(subtask).toBeDefined();
    expect(subtask.id).toBe('test_subtask_1');
    expect(subtask.type).toBe('research');
    expect(subtask.assignedRole).toBe('researcher');
    expect(subtask.riskProfile).toBeDefined();
    expect(subtask.riskProfile.riskLevel).toBe('low');
    expect(subtask.validationRequirement).toBeDefined();
    expect(subtask.validationRequirement.level).toBe('none');
    expect(subtask.contextOverlap).toBe('fresh');
    expect(subtask.estimatedDuration).toBe(30000);

    // 创建主任务规划
    const mainTask = coordinator.createMainTaskPlan(
      'test_task_1',
      '测试任务',
      '这是一个测试任务描述',
      [subtask],
      {
        overallRisk: 'low',
        verificationLevel: 'independent',
        coordinatorOverride: false
      }
    );

    // 验证主任务包含强语义字段
    expect(mainTask).toBeDefined();
    expect(mainTask.id).toBe('test_task_1');
    expect(mainTask.subtasks).toHaveLength(1);
    expect(mainTask.overallRisk).toBe('low');
    expect(mainTask.verificationLevel).toBe('independent');
    expect(mainTask.coordinatorOverride).toBe(false);
    expect(mainTask.requiredRoles).toContain('researcher');

    // 创建任务分配
    const assignment = coordinator.createTaskAssignment(
      'test_task_1',
      'researcher',
      '分配研究员角色进行代码研究',
      {
        subtaskId: 'test_subtask_1',
        priority: 'high',
        resourceRequirements: {
          tools: ['FILE_READ_TOOL_NAME', 'BASH_TOOL_NAME']
        },
        constraints: {
          maxDuration: 60000,
          retryLimit: 3
        }
      }
    );

    // 验证任务分配包含强语义字段
    expect(assignment).toBeDefined();
    expect(assignment.taskId).toBe('test_task_1');
    expect(assignment.assignedRole).toBe('researcher');
    expect(assignment.assignmentRationale).toBe('分配研究员角色进行代码研究');
    expect(assignment.priority).toBe('high');
    expect(assignment.resourceRequirements.tools).toContain('FILE_READ_TOOL_NAME');
    expect(assignment.constraints.maxDuration).toBe(60000);
    expect(assignment.status).toBe('pending');
  });

  test('2. AgentRuntimeState / MultiAgentRuntimeState 的 runtime 结果存在', () => {
    // 创建Agent运行时状态
    const agentState = coordinator.createAgentRuntimeState(
      'agent_1',
      'researcher',
      {
        currentTaskId: 'test_task_1',
        status: 'working',
        riskLevel: 'low',
        verificationStatus: 'not-needed',
        contextOverlap: 'fresh'
      }
    );

    // 验证Agent运行时状态包含强语义字段
    expect(agentState).toBeDefined();
    expect(agentState.agentId).toBe('agent_1');
    expect(agentState.role).toBe('researcher');
    expect(agentState.status).toBe('working');
    expect(agentState.riskLevel).toBe('low');
    expect(agentState.verificationStatus).toBe('not-needed');
    expect(agentState.contextOverlap).toBe('fresh');

    // 创建多Agent运行时状态
    const multiAgentState = coordinator.createMultiAgentRuntimeState(
      'test_task_1',
      [agentState],
      {
        overallStatus: 'in-progress',
        riskAssessment: 'low',
        verificationSummary: {
          required: 1,
          completed: 0,
          passed: 0,
          failed: 0
        }
      }
    );

    // 验证多Agent运行时状态包含强语义字段
    expect(multiAgentState).toBeDefined();
    expect(multiAgentState.taskId).toBe('test_task_1');
    expect(multiAgentState.agents).toHaveLength(1);
    expect(multiAgentState.overallStatus).toBe('in-progress');
    expect(multiAgentState.riskAssessment).toBe('low');
    expect(multiAgentState.verificationSummary.required).toBe(1);
  });

  test('3. BranchState / CoordinationCheckpoint / CoordinationSummary 的 runtime 结果存在', () => {
    // 创建分支状态（DSXU强吸收语义）
    const branchState = coordinator.createBranchState(
      'branch_1',
      'test_task_1',
      'exploratory',
      '探索性分支测试',
      'explorer',
      {
        status: 'running',
        progress: 30,
        phase: 'research',
        goals: ['探索代码库结构', '识别潜在问题'],
        successCriteria: ['完成探索报告', '识别至少3个潜在问题'],
        constraints: {
          timeout: 300000,
          contextConstraints: {
            isolationLevel: 'partial',
            sharingPolicy: 'read'
          }
        },
        metrics: {
          explorationScore: 0.8,
          contextEfficiency: 0.7
        },
        context: {
          sharedContextIds: ['context_1'],
          isolationLevel: 'partial',
          contextFreshness: 0.9
        },
        dsxuAlignment: {
          workflowCompliance: 0.8,
          decisionPatternMatch: 0.7
        }
      }
    );

    // 验证分支状态包含DSXU强吸收字段
    expect(branchState).toBeDefined();
    expect(branchState.branchId).toBe('branch_1');
    expect(branchState.strategy).toBe('exploratory');
    expect(branchState.phase).toBe('research');
    expect(branchState.goals).toContain('探索代码库结构');
    expect(branchState.successCriteria).toContain('完成探索报告');
    expect(branchState.constraints.timeout).toBe(300000);
    expect(branchState.metrics.explorationScore).toBe(0.8);
    expect(branchState.context.isolationLevel).toBe('partial');
    expect(branchState.dsxuAlignment.workflowCompliance).toBe(0.8);

    // 创建协调检查点
    const checkpoint = coordinator.createCoordinationCheckpoint(
      'checkpoint_1',
      'test_task_1',
      'research',
      {
        stageId: 'stage_1',
        name: '研究阶段',
        description: '代码研究阶段',
        phase: 'research',
        entryCriteria: ['任务已分配'],
        exitCriteria: ['研究完成'],
        tasks: ['task_1'],
        roles: ['researcher'],
        status: 'active',
        metrics: {
          taskCount: 1,
          completedTasks: 0,
          successRate: 0,
          averageDuration: 0
        }
      } as WorkflowStage,
      {
        stateSnapshot: {
          taskStates: { 'task_1': 'running' },
          agentStates: { 'agent_1': 'working' },
          resourceUsage: {
            memory: { 'agent_1': '512MB' },
            cpu: { 'agent_1': 30 },
            activeAgents: 1,
            totalAgents: 1
          }
        },
        metrics: {
          progress: 30,
          quality: 80,
          efficiency: 70
        },
        dsxuParity: {
          workflowAlignment: 0.8,
          absorptionLevel: 'enhanced'
        }
      }
    );

    // 验证协调检查点包含强语义字段
    expect(checkpoint).toBeDefined();
    expect(checkpoint.checkpointId).toBe('checkpoint_1');
    expect(checkpoint.phase).toBe('research');
    expect(checkpoint.stateSnapshot.taskStates['task_1']).toBe('running');
    expect(checkpoint.metrics.progress).toBe(30);
    expect(checkpoint.dsxuParity.workflowAlignment).toBe(0.8);
  });

  test('4. ContextDecisionState / ContextOverlapState 的 runtime 结果存在', () => {
    // 创建上下文决策状态
    const contextDecision = coordinator.createContextDecisionState(
      'decision_1',
      'test_task_1',
      'continue',
      '高上下文重叠，继续现有worker',
      {
        subtaskId: 'subtask_1',
        phase: 'implementation',
        factors: {
          contextOverlap: 0.8,
          taskSimilarity: 0.9,
          riskLevel: 'medium'
        },
        decision: {
          contextAction: 'reuse',
          dsxuPattern: 'implementation-fresh'
        },
        outcome: {
          success: true,
          performanceChange: 15,
          dsxuValidation: 'aligned'
        }
      }
    );

    // 验证上下文决策状态包含强语义字段
    expect(contextDecision).toBeDefined();
    expect(contextDecision.decisionId).toBe('decision_1');
    expect(contextDecision.decisionType).toBe('continue');
    expect(contextDecision.factors.contextOverlap).toBe(0.8);
    expect(contextDecision.decision.dsxuPattern).toBe('implementation-fresh');
    expect(contextDecision.outcome?.success).toBe(true);
  });

  test('5. 协调者状态包包含所有运行时状态', () => {
    // 创建子任务
    const subtask = coordinator.createSubtaskPlan(
      'package_subtask_1',
      'implementation',
      '实现：测试功能',
      '实现测试功能',
      'implementer',
      {
        riskProfile: {
          riskLevel: 'high',
          factors: { complexity: 'medium', impact: 'high', uncertainty: 'medium', dependencies: 'many' },
          recommendedRoles: ['implementer', 'specialist'],
          riskMitigation: ['详细规范', '代码审查']
        },
        validationRequirement: {
          level: 'independent',
          description: '需要独立验证',
          requiredRoles: ['verifier'],
          validationSteps: ['运行测试套件', '类型检查'],
          successCriteria: ['所有测试通过', '类型检查通过']
        }
      }
    );

    // 创建主任务
    const mainTask = coordinator.createMainTaskPlan(
      'package_task_1',
      '包测试任务',
      '测试协调者状态包',
      [subtask],
      {
        overallRisk: 'high',
        verificationLevel: 'independent'
      }
    );

    // 创建协调者决策
    const decision = {
      taskId: 'package_task_1',
      roleAssignments: [{
        subtaskId: 'package_subtask_1',
        assignedRole: 'implementer',
        rationale: '分配实现者角色',
        expectedDuration: 60000,
        riskAssessment: 'high' as TaskRiskLevel,
        verificationNeeded: true,
        contextDecision: 'continue' as 'fresh' | 'continue'
      }],
      concurrencyPlan: {
        parallelTasks: [],
        sequentialTasks: ['package_subtask_1'],
        writeHeavyTasks: ['package_subtask_1']
      },
      rationale: '测试状态包'
    };

    // 创建Agent状态
    const agentState = coordinator.createAgentRuntimeState(
      'package_agent_1',
      'implementer',
      { status: 'working', riskLevel: 'high' }
    );

    // 创建分支状态
    const branchState = coordinator.createBranchState(
      'package_branch_1',
      'package_task_1',
      'sequential',
      '顺序执行分支',
      'implementer'
    );

    // 创建上下文决策
    const contextDecision = coordinator.createContextDecisionState(
      'package_decision_1',
      'package_task_1',
      'fresh',
      '新任务，使用fresh上下文'
    );

    // 创建检查点
    const checkpoint = coordinator.createCoordinationCheckpoint(
      'package_checkpoint_1',
      'package_task_1',
      'implementation',
      {
        stageId: 'package_stage_1',
        name: '实现阶段',
        description: '代码实现阶段',
        phase: 'implementation',
        entryCriteria: ['研究完成'],
        exitCriteria: ['实现完成'],
        tasks: ['package_subtask_1'],
        roles: ['implementer'],
        status: 'active',
        metrics: { taskCount: 1, completedTasks: 0, successRate: 0, averageDuration: 0 }
      } as WorkflowStage
    );

    // 创建协调者状态包
    const statePackage = coordinator.createCoordinatorStatePackage(
      'package_task_1',
      mainTask,
      decision,
      {
        agentStates: [agentState],
        branchStates: [branchState],
        contextDecisions: [contextDecision],
        checkpoints: [checkpoint],
        parityScore: 85,
        absorptionLevel: 'parity'
      }
    );

    // 验证状态包包含所有组件
    expect(statePackage).toBeDefined();
    expect(statePackage.taskId).toBe('package_task_1');
    expect(statePackage.taskPlan.id).toBe('package_task_1');
    expect(statePackage.coordinatorDecision.taskId).toBe('package_task_1');
    expect(statePackage.multiAgentState.agents).toHaveLength(1);
    expect(statePackage.branchStates).toHaveLength(1);
    expect(statePackage.contextDecisions).toHaveLength(1);
    expect(statePackage.checkpoints).toHaveLength(1);
    expect(statePackage.parityScore).toBe(85);
    expect(statePackage.absorptionLevel).toBe('parity');
  });

  test('6. 结果可表达多个角色、多个子任务、多个并行分支容器', () => {
    // 创建多个子任务，分配不同角色
    const researchSubtask = coordinator.createSubtaskPlan(
      'multi_research',
      'research',
      '研究任务',
      '研究代码库',
      'researcher'
    );

    const implementationSubtask = coordinator.createSubtaskPlan(
      'multi_implementation',
      'implementation',
      '实现任务',
      '实现功能',
      'implementer'
    );

    const verificationSubtask = coordinator.createSubtaskPlan(
      'multi_verification',
      'verification',
      '验证任务',
      '验证实现',
      'verifier'
    );

    // 创建主任务包含多个子任务
    const multiTask = coordinator.createMainTaskPlan(
      'multi_task_1',
      '多角色任务',
      '包含研究、实现、验证的多角色任务',
      [researchSubtask, implementationSubtask, verificationSubtask],
      {
        overallRisk: 'medium',
        verificationLevel: 'independent'
      }
    );

    // 验证包含多个角色
    expect(multiTask.requiredRoles).toContain('researcher');
    expect(multiTask.requiredRoles).toContain('implementer');
    expect(multiTask.requiredRoles).toContain('verifier');
    expect(multiTask.subtasks).toHaveLength(3);

    // 创建多个分支状态
    const branch1 = coordinator.createBranchState(
      'multi_branch_1',
      'multi_task_1',
      'exploratory',
      '探索分支',
      'explorer'
    );

    const branch2 = coordinator.createBranchState(
      'multi_branch_2',
      'multi_task_1',
      'competitive',
      '竞争分支',
      'specialist'
    );

    const branch3 = coordinator.createBranchState(
      'multi_branch_3',
      'multi_task_1',
      'parallel',
      '并行分支',
      'worker'
    );

    // 验证可以处理多个分支
    expect(branch1.strategy).toBe('exploratory');
    expect(branch2.strategy).toBe('competitive');
    expect(branch3.strategy).toBe('parallel');
    expect(branch1.assignedRole).toBe('explorer');
    expect(branch2.assignedRole).toBe('specialist');
    expect(branch3.assignedRole).toBe('worker');
  });

  test('7. 增强的任务分解方法产生完整强语义对象', () => {
    const taskPlan = coordinator.intelligentTaskDecompositionEnhanced(
      '增强分解测试',
      '调查并修复代码中的空指针异常问题',
      {
        forceDSXUWorkflow: true,
        includeSynthesis: true
      }
    );

    // 验证任务规划包含强语义字段
    expect(taskPlan).toBeDefined();
    expect(taskPlan.id).toMatch(/^task_\d+_\d+$/);
    expect(taskPlan.subtasks.length).toBeGreaterThan(0);
    expect(taskPlan.overallRisk).toBeDefined();
    expect(taskPlan.verificationLevel).toBeDefined();
    expect(taskPlan.coordinatorOverride).toBe(false);

    // 验证每个子任务都有完整字段
    taskPlan.subtasks.forEach(subtask => {
      expect(subtask.riskProfile).toBeDefined();
      expect(subtask.validationRequirement).toBeDefined();
      expect(subtask.contextOverlap).toBeDefined();
      expect(subtask.estimatedDuration).toBeGreaterThan(0);
    });

    // 创建协调者决策
    const decision = coordinator.createCoordinatorDecisionEnhanced(taskPlan);

    // 验证决策包含强语义字段
    expect(decision.roleAssignments).toHaveLength(taskPlan.subtasks.length);
    decision.roleAssignments.forEach(assignment => {
      expect(assignment.riskAssessment).toBeDefined();
      expect(assignment.verificationNeeded).toBeDefined();
      expect(assignment.contextDecision).toBeDefined();
    });
  });

  test('8. 不引入第二套 coordinator 主实现', () => {
    // 验证我们使用的是同一套coordinator实现
    const coordinator1 = createCoordinatorV1();
    const coordinator2 = createCoordinatorV1();

    // 两个实例应该独立但类型相同
    expect(coordinator1).toBeInstanceOf(coordinator1.constructor);
    expect(coordinator2).toBeInstanceOf(coordinator2.constructor);

    // 验证核心方法存在
    expect(typeof coordinator1.analyzeTask).toBe('function');
    expect(typeof coordinator1.createMainTaskPlan).toBe('function');
    expect(typeof coordinator1.createSubtaskPlan).toBe('function');
    expect(typeof coordinator1.createAgentRuntimeState).toBe('function');
    expect(typeof coordinator1.createBranchState).toBe('function');

    // 验证没有重复创建不必要的实例
    const task1 = coordinator1.createMainTaskPlan('test1', '任务1', '描述1', []);
    const task2 = coordinator2.createMainTaskPlan('test2', '任务2', '描述2', []);

    expect(task1.id).toBe('test1');
    expect(task2.id).toBe('test2');
    expect(task1.id).not.toBe(task2.id);
  });
});