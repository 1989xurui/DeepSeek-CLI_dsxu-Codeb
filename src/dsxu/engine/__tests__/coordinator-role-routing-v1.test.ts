/**
 * Coordinator Role Routing V1 测试
 *
 * 测试至少覆盖：
 * 1. AgentRole 结构存在
 * 2. 同一主任务可分配到至少两种角色
 * 3. role routing 输出是结构化对象，不是字符串
 * 4. runtime-core 至少能拿到一种 coordinator 结构
 */

import { describe, test, expect } from 'bun:test';
import {
  // 从 runtime-core 导入
  createCoordinatorV1,
  createSimpleRoleRouting,
  AgentRole,
  AGENT_ROLE_CONFIGS,
  recommendRoleForTask,
  isRoleSuitableForTask,
  // 从源文件导入以进行更详细的测试
  type RoleRoutingOutput,
  type CoordinatorDecision,
  type MainTaskPlan,
  type SubtaskPlan
} from '../runtime-core';

describe('Coordinator Role Routing V1', () => {
  // 测试 1: AgentRole 结构存在
  describe('AgentRole Structure', () => {
    test('AgentRole 类型应该存在', () => {
      // 测试类型存在
      const role: AgentRole = 'researcher';
      expect(role).toBe('researcher');
    });

    test('AGENT_ROLE_CONFIGS 应该包含所有角色', () => {
      const expectedRoles: AgentRole[] = ['researcher', 'implementer', 'verifier', 'coordinator', 'specialist'];

      expectedRoles.forEach(role => {
        expect(AGENT_ROLE_CONFIGS[role]).toBeDefined();
        expect(AGENT_ROLE_CONFIGS[role].role).toBe(role);
        expect(AGENT_ROLE_CONFIGS[role].description).toBeDefined();
        expect(AGENT_ROLE_CONFIGS[role].capabilities).toBeInstanceOf(Array);
        expect(AGENT_ROLE_CONFIGS[role].constraints).toBeInstanceOf(Array);
        expect(AGENT_ROLE_CONFIGS[role].typicalTasks).toBeInstanceOf(Array);
      });
    });

    test('角色配置应该合理', () => {
      const researcherConfig = AGENT_ROLE_CONFIGS.researcher;
      expect(researcherConfig.capabilities).toContain('深度代码分析');
      expect(researcherConfig.constraints).toContain('不能修改生产代码');
      expect(researcherConfig.typicalTasks).toContain('调查复杂问题');
    });
  });

  // 测试 2: 同一主任务可分配到至少两种角色
  describe('Multi-Role Assignment', () => {
    test('简单角色路由应该分配多种角色', () => {
      const routing = createSimpleRoleRouting(
        '修复认证模块的空指针异常',
        '在认证模块中发现空指针异常，需要修复'
      );

      // 检查任务计划
      expect(routing.taskPlan).toBeDefined();
      expect(routing.taskPlan.subtasks).toBeInstanceOf(Array);
      expect(routing.taskPlan.subtasks.length).toBeGreaterThan(1);

      // 检查分配的角色
      const assignedRoles = routing.decision.roleAssignments.map(ra => ra.assignedRole);
      const uniqueRoles = new Set(assignedRoles);

      expect(uniqueRoles.size).toBeGreaterThan(1);
      expect(uniqueRoles.size).toBe(3); // researcher, implementer, verifier
      expect(uniqueRoles.has('researcher')).toBe(true);
      expect(uniqueRoles.has('implementer')).toBe(true);
      expect(uniqueRoles.has('verifier')).toBe(true);
    });

    test('CoordinatorV1 应该能智能分配多种角色', () => {
      const coordinator = createCoordinatorV1();
      const routing = coordinator.analyzeTask(
        '实现用户注册功能',
        '需要实现用户注册功能，包括表单验证、数据库存储和邮件确认'
      );

      const assignedRoles = routing.decision.roleAssignments.map(ra => ra.assignedRole);
      const uniqueRoles = new Set(assignedRoles);

      expect(uniqueRoles.size).toBeGreaterThan(1);
    });
  });

  // 测试 3: role routing 输出是结构化对象，不是字符串
  describe('Structured Output', () => {
    test('createSimpleRoleRouting 应该返回结构化对象', () => {
      const routing = createSimpleRoleRouting('测试任务', '测试描述');

      // 检查整体结构
      expect(typeof routing).toBe('object');
      expect(routing).toHaveProperty('decision');
      expect(routing).toHaveProperty('taskPlan');
      expect(routing).toHaveProperty('timestamp');
      expect(typeof routing.timestamp).toBe('number');

      // 检查 decision 结构
      const decision = routing.decision;
      expect(decision).toHaveProperty('taskId');
      expect(decision).toHaveProperty('roleAssignments');
      expect(decision).toHaveProperty('concurrencyPlan');
      expect(decision).toHaveProperty('rationale');
      expect(typeof decision.rationale).toBe('string');

      // 检查 roleAssignments 结构
      expect(decision.roleAssignments).toBeInstanceOf(Array);
      if (decision.roleAssignments.length > 0) {
        const assignment = decision.roleAssignments[0];
        expect(assignment).toHaveProperty('subtaskId');
        expect(assignment).toHaveProperty('assignedRole');
        expect(assignment).toHaveProperty('rationale');
      }

      // 检查 taskPlan 结构
      const taskPlan = routing.taskPlan;
      expect(taskPlan).toHaveProperty('id');
      expect(taskPlan).toHaveProperty('title');
      expect(taskPlan).toHaveProperty('description');
      expect(taskPlan).toHaveProperty('subtasks');
      expect(taskPlan).toHaveProperty('requiredRoles');
      expect(taskPlan).toHaveProperty('estimatedComplexity');
    });

    test('输出不应该只是字符串', () => {
      const routing = createSimpleRoleRouting('测试任务', '测试描述');

      // 确保不是简单的字符串
      expect(typeof routing).not.toBe('string');
      expect(typeof routing.decision).not.toBe('string');
      expect(typeof routing.taskPlan).not.toBe('string');

      // 确保有嵌套结构
      expect(routing.decision.roleAssignments).toBeInstanceOf(Array);
      expect(routing.taskPlan.subtasks).toBeInstanceOf(Array);
    });
  });

  // 测试 4: runtime-core 至少能拿到一种 coordinator 结构
  describe('Runtime Core Integration', () => {
    test('应该能从 runtime-core 导入 coordinator 类型', () => {
      // 这些导入已经在文件顶部，这里只是验证它们可用
      const routing = createSimpleRoleRouting('集成测试', '测试 runtime-core 集成');

      expect(routing).toBeDefined();
      expect(routing.decision.taskId).toBeDefined();
      expect(routing.taskPlan.title).toBe('集成测试');
    });

    test('应该能使用推荐角色函数', () => {
      const researchRole = recommendRoleForTask('research', 'medium');
      const implementationRole = recommendRoleForTask('implementation', 'medium');
      const verificationRole = recommendRoleForTask('verification', 'medium');
      const synthesisRole = recommendRoleForTask('synthesis', 'medium');

      expect(researchRole).toBe('researcher');
      expect(implementationRole).toBe('implementer');
      expect(verificationRole).toBe('verifier');
      expect(synthesisRole).toBe('coordinator');
    });

    test('应该能检查角色适合性', () => {
      expect(isRoleSuitableForTask('researcher', 'research')).toBe(true);
      expect(isRoleSuitableForTask('implementer', 'implementation')).toBe(true);
      expect(isRoleSuitableForTask('verifier', 'verification')).toBe(true);
      expect(isRoleSuitableForTask('coordinator', 'synthesis')).toBe(true);
    });

    test('应该能创建和使用 CoordinatorV1 实例', () => {
      const coordinator = createCoordinatorV1();
      expect(coordinator).toBeDefined();
      expect(typeof coordinator.analyzeTask).toBe('function');
      expect(typeof coordinator.validateRoleAssignments).toBe('function');

      const routing = coordinator.analyzeTask('测试任务', '测试描述');
      expect(routing).toBeDefined();

      const validation = coordinator.validateRoleAssignments(routing.decision);
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('issues');
      expect(Array.isArray(validation.issues)).toBe(true);
    });
  });

  // 额外测试：任务分解功能
  describe('Task Decomposition', () => {
    test('应该能智能分解任务', () => {
      const coordinator = createCoordinatorV1();
      const taskPlan = coordinator.intelligentTaskDecomposition(
        '重构用户认证系统',
        '需要重构用户认证系统，改用 JWT 令牌，添加双因素认证，并更新相关测试'
      );

      expect(taskPlan).toBeDefined();
      expect(taskPlan.id).toMatch(/^task_\d+/);
      expect(taskPlan.title).toBe('重构用户认证系统');
      expect(taskPlan.subtasks.length).toBeGreaterThan(0);
      expect(taskPlan.requiredRoles.length).toBeGreaterThan(0);
      expect(['simple', 'medium', 'complex']).toContain(taskPlan.estimatedComplexity);

      // 检查子任务结构
      taskPlan.subtasks.forEach(subtask => {
        expect(subtask).toHaveProperty('id');
        expect(subtask).toHaveProperty('type');
        expect(subtask).toHaveProperty('title');
        expect(subtask).toHaveProperty('assignedRole');
        expect(subtask).toHaveProperty('dependencies');
        expect(Array.isArray(subtask.dependencies)).toBe(true);
      });
    });

    test('应该能创建协调者决策', () => {
      const coordinator = createCoordinatorV1();
      const taskPlan = coordinator.intelligentTaskDecomposition(
        '修复登录 bug',
        '用户登录时偶尔失败，需要调查并修复'
      );

      const decision = coordinator.createCoordinatorDecision(taskPlan);

      expect(decision.taskId).toBe(taskPlan.id);
      expect(decision.roleAssignments.length).toBe(taskPlan.subtasks.length);
      expect(decision.concurrencyPlan).toBeDefined();
      expect(decision.concurrencyPlan.parallelTasks).toBeInstanceOf(Array);
      expect(decision.concurrencyPlan.sequentialTasks).toBeInstanceOf(Array);
      expect(typeof decision.rationale).toBe('string');
    });
  });

  // 额外测试：并发规划
  describe('Concurrency Planning', () => {
    test('决策应该包含并发规划', () => {
      const routing = createSimpleRoleRouting('测试任务', '测试描述');

      expect(routing.decision.concurrencyPlan).toBeDefined();
      expect(routing.decision.concurrencyPlan.parallelTasks).toBeInstanceOf(Array);
      expect(routing.decision.concurrencyPlan.sequentialTasks).toBeInstanceOf(Array);

      // 在简单路由中，所有任务应该是顺序的
      expect(routing.decision.concurrencyPlan.parallelTasks.length).toBe(0);
      expect(routing.decision.concurrencyPlan.sequentialTasks.length).toBe(3);
    });

    test('智能分解应该考虑并行任务', () => {
      const coordinator = createCoordinatorV1();
      const taskPlan = coordinator.intelligentTaskDecomposition(
        '大型重构任务',
        '需要同时研究多个模块并进行重构'
      );

      const decision = coordinator.createCoordinatorDecision(taskPlan);

      // 研究任务应该可以并行
      const researchTasks = taskPlan.subtasks.filter(t => t.type === 'research');
      if (researchTasks.length > 1) {
        expect(decision.concurrencyPlan.parallelTasks.length).toBeGreaterThan(0);
      }
    });
  });
});
