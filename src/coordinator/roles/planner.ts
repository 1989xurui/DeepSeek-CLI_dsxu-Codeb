/**
 * R5-17: Planner 角色
 * 使用 reasoner 模型分析任务，生成计划和子任务
 */

import { BaseAgent, AgentRole, Task, AgentResult, TaskFactory } from '../../agents/base-agent.js';

export interface Plan {
  id: string;
  taskId: string;
  description: string;
  steps: PlanStep[];
  estimatedTime: number; // 分钟
  requiredResources: string[];
  risks: RiskAssessment[];
  successCriteria: string[];
}

export interface PlanStep {
  id: string;
  description: string;
  type: 'analysis' | 'implementation' | 'testing' | 'review' | 'deployment';
  dependencies: string[]; // 依赖的其他步骤ID
  estimatedDuration: number; // 分钟
  assignedTo?: AgentRole;
  acceptanceCriteria: string[];
}

export interface RiskAssessment {
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export class Planner extends BaseAgent {
  private readonly model: string = 'deepseek-reasoner'; // reasoner 模型

  constructor(id: string = 'planner-1') {
    super(
      id,
      'planner',
      '任务规划者',
      [
        { name: 'task_analysis', description: '分析任务需求和约束' },
        { name: 'plan_generation', description: '生成详细实施计划' },
        { name: 'risk_assessment', description: '评估项目风险' },
        { name: 'resource_planning', description: '规划所需资源' },
        { name: 'subtask_decomposition', description: '将任务分解为子任务' }
      ]
    );
  }

  async process(task: Task): Promise<AgentResult> {
    this.logActivity('开始处理规划任务', { taskId: task.id, taskType: task.type });

    // 验证任务
    const validation = this.validateTask(task);
    if (!validation.valid) {
      return this.createErrorResult('任务验证失败', validation.errors);
    }

    try {
      // 分析任务
      const analysis = await this.analyzeTask(task);

      // 生成计划
      const plan = await this.generatePlan(task, analysis);

      // 创建子任务
      const subtasks = this.createSubtasks(task, plan);

      this.logActivity('规划完成', {
        taskId: task.id,
        planId: plan.id,
        steps: plan.steps.length,
        subtasks: subtasks.length
      });

      return this.createSuccessResult(
        {
          plan,
          subtasks,
          analysis
        },
        subtasks,
        {
          modelUsed: this.model,
          planningTime: new Date().toISOString(),
          complexity: this.assessComplexity(task)
        }
      );

    } catch (error: any) {
      this.logActivity('规划失败', { taskId: task.id, error: error.message });
      return this.createErrorResult(`规划失败: ${error.message}`, [error.stack]);
    }
  }

  /**
   * 分析任务
   */
  private async analyzeTask(task: Task): Promise<TaskAnalysis> {
    this.logActivity('分析任务', { taskId: task.id });

    // 这里应该调用 reasoner 模型进行实际分析
    // 目前使用模拟实现

    return {
      requirements: task.requirements,
      constraints: task.constraints,
      priority: task.priority,
      complexity: this.assessComplexity(task),
      dependencies: this.identifyDependencies(task),
      assumptions: this.extractAssumptions(task)
    };
  }

  /**
   * 生成详细计划
   */
  private async generatePlan(task: Task, analysis: TaskAnalysis): Promise<Plan> {
    this.logActivity('生成计划', { taskId: task.id });

    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 根据任务类型生成不同的步骤
    const steps = this.generatePlanSteps(task, analysis);

    // 评估风险
    const risks = this.assessRisks(task, analysis);

    // 估算时间
    const estimatedTime = steps.reduce((sum, step) => sum + step.estimatedDuration, 0);

    return {
      id: planId,
      taskId: task.id,
      description: `实施计划: ${task.description}`,
      steps,
      estimatedTime,
      requiredResources: this.identifyResources(task, analysis),
      risks,
      successCriteria: this.defineSuccessCriteria(task)
    };
  }

  /**
   * 生成计划步骤
   */
  private generatePlanSteps(task: Task, analysis: TaskAnalysis): PlanStep[] {
    const steps: PlanStep[] = [];
    let stepId = 1;

    // 分析阶段
    steps.push({
      id: `step_${stepId++}`,
      description: '详细需求分析',
      type: 'analysis',
      dependencies: [],
      estimatedDuration: 30,
      assignedTo: 'planner',
      acceptanceCriteria: ['需求明确', '约束清晰', '优先级确定']
    });

    // 设计阶段
    steps.push({
      id: `step_${stepId++}`,
      description: '系统设计',
      type: 'analysis',
      dependencies: ['step_1'],
      estimatedDuration: 45,
      assignedTo: 'planner',
      acceptanceCriteria: ['架构设计完成', '接口定义清晰']
    });

    // 实现阶段（根据任务复杂度动态生成）
    const implementationSteps = this.generateImplementationSteps(task, analysis);
    implementationSteps.forEach(step => {
      steps.push({
        ...step,
        id: `step_${stepId++}`,
        dependencies: step.dependencies.map(dep => `step_${dep}`)
      });
    });

    // 测试阶段
    steps.push({
      id: `step_${stepId++}`,
      description: '集成测试',
      type: 'testing',
      dependencies: implementationSteps.map((_, i) => `step_${3 + i}`),
      estimatedDuration: 30,
      assignedTo: 'verifier',
      acceptanceCriteria: ['所有测试通过', '无回归问题']
    });

    // 审查阶段
    steps.push({
      id: `step_${stepId++}`,
      description: '代码审查',
      type: 'review',
      dependencies: [`step_${stepId - 2}`], // 依赖测试步骤
      estimatedDuration: 20,
      assignedTo: 'critic',
      acceptanceCriteria: ['代码质量达标', '安全审查通过']
    });

    return steps;
  }

  /**
   * 生成实现步骤
   */
  private generateImplementationSteps(task: Task, analysis: TaskAnalysis): Omit<PlanStep, 'id'>[] {
    const steps: Omit<PlanStep, 'id'>[] = [];

    // 根据任务描述判断实现步骤
    if (task.description.includes('测试') || task.description.includes('test')) {
      steps.push({
        description: '编写测试用例',
        type: 'implementation',
        dependencies: ['2'], // 依赖设计步骤
        estimatedDuration: 25,
        assignedTo: 'executor',
        acceptanceCriteria: ['测试覆盖主要场景', '边界条件覆盖']
      });
    }

    if (task.description.includes('功能') || task.description.includes('feature')) {
      steps.push({
        description: '实现核心功能',
        type: 'implementation',
        dependencies: ['2'],
        estimatedDuration: 60,
        assignedTo: 'executor',
        acceptanceCriteria: ['功能完整实现', '代码符合规范']
      });
    }

    if (task.description.includes('修复') || task.description.includes('fix')) {
      steps.push({
        description: '修复问题',
        type: 'implementation',
        dependencies: ['2'],
        estimatedDuration: 40,
        assignedTo: 'executor',
        acceptanceCriteria: ['问题已修复', '无新问题引入']
      });
    }

    // 默认实现步骤
    if (steps.length === 0) {
      steps.push({
        description: '实现任务要求',
        type: 'implementation',
        dependencies: ['2'],
        estimatedDuration: 45,
        assignedTo: 'executor',
        acceptanceCriteria: ['任务要求满足', '代码质量达标']
      });
    }

    return steps;
  }

  /**
   * 创建子任务
   */
  private createSubtasks(task: Task, plan: Plan): Task[] {
    const subtasks: Task[] = [];

    // 为每个需要执行的步骤创建子任务
    for (const step of plan.steps) {
      if (step.assignedTo && step.assignedTo !== 'planner') {
        subtasks.push(
          TaskFactory.createImplementationTask(
            `${step.description} - ${task.description}`,
            {
              stepId: step.id,
              planId: plan.id,
              acceptanceCriteria: step.acceptanceCriteria,
              estimatedDuration: step.estimatedDuration
            },
            task.priority
          )
        );
      }
    }

    return subtasks;
  }

  /**
   * 评估任务复杂度
   */
  private assessComplexity(task: Task): 'simple' | 'medium' | 'complex' {
    const descLength = task.description.length;
    const reqCount = task.requirements.length;
    const constraintCount = task.constraints.length;

    const score = descLength * 0.1 + reqCount * 20 + constraintCount * 15;

    if (score < 50) return 'simple';
    if (score < 100) return 'medium';
    return 'complex';
  }

  /**
   * 识别依赖
   */
  private identifyDependencies(task: Task): string[] {
    const dependencies: string[] = [];

    if (task.description.includes('依赖') || task.description.includes('depend')) {
      dependencies.push('外部系统依赖');
    }

    if (task.description.includes('集成') || task.description.includes('integrate')) {
      dependencies.push('系统集成点');
    }

    if (task.description.includes('数据') || task.description.includes('data')) {
      dependencies.push('数据源访问');
    }

    return dependencies;
  }

  /**
   * 提取假设
   */
  private extractAssumptions(task: Task): string[] {
    const assumptions: string[] = [
      '开发环境可用',
      '所需工具已安装',
      '团队有相应技能'
    ];

    if (task.description.includes('API') || task.description.includes('接口')) {
      assumptions.push('API文档可用');
      assumptions.push('API访问权限已获得');
    }

    if (task.description.includes('测试')) {
      assumptions.push('测试环境可用');
      assumptions.push('测试数据可用');
    }

    return assumptions;
  }

  /**
   * 评估风险
   */
  private assessRisks(task: Task, analysis: TaskAnalysis): RiskAssessment[] {
    const risks: RiskAssessment[] = [
      {
        description: '需求理解偏差',
        probability: 'medium',
        impact: 'high',
        mitigation: '定期与需求方确认，建立验收标准'
      },
      {
        description: '技术实现困难',
        probability: 'low',
        impact: 'high',
        mitigation: '技术预研，准备备选方案'
      },
      {
        description: '时间估算偏差',
        probability: 'medium',
        impact: 'medium',
        mitigation: '设置缓冲时间，定期进度检查'
      }
    ];

    if (analysis.complexity === 'complex') {
      risks.push({
        description: '系统复杂度高',
        probability: 'high',
        impact: 'high',
        mitigation: '分阶段实施，增加审查环节'
      });
    }

    if (task.priority === 'critical') {
      risks.push({
        description: '关键任务压力',
        probability: 'high',
        impact: 'high',
        mitigation: '增加资源投入，密切监控进度'
      });
    }

    return risks;
  }

  /**
   * 识别所需资源
   */
  private identifyResources(task: Task, analysis: TaskAnalysis): string[] {
    const resources: string[] = ['开发环境', '版本控制系统', 'CI/CD流水线'];

    if (task.description.includes('测试')) {
      resources.push('测试环境', '测试工具', '测试数据');
    }

    if (task.description.includes('部署') || task.description.includes('deploy')) {
      resources.push('生产环境', '部署工具', '监控系统');
    }

    if (analysis.complexity === 'complex') {
      resources.push('架构师支持', '额外开发资源');
    }

    return resources;
  }

  /**
   * 定义成功标准
   */
  private defineSuccessCriteria(task: Task): string[] {
    const criteria: string[] = [
      '功能完整实现',
      '代码质量达标',
      '测试通过率100%',
      '文档完整'
    ];

    if (task.description.includes('性能') || task.description.includes('performance')) {
      criteria.push('性能指标达标');
    }

    if (task.description.includes('安全') || task.description.includes('security')) {
      criteria.push('安全审查通过');
    }

    return criteria;
  }
}

// 辅助接口
interface TaskAnalysis {
  requirements: string[];
  constraints: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  complexity: 'simple' | 'medium' | 'complex';
  dependencies: string[];
  assumptions: string[];
}