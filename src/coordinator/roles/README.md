# R5-17 Multi-Agent Role Coordination

四角色多 agent 协调器，用于代码修改任务。

## 架构

### 角色
1. **Planner** (规划者)
   - 模型偏好: `reasoner`
   - 职责: 分析任务，制定实现计划
   - 输出: `plan` 消息

2. **Executor** (执行者)
   - 模型偏好: `chat`
   - 职责: 根据计划实现代码变更
   - 输出: `patch` 消息 (git diff 格式)

3. **Critic** (审查者)
   - 模型偏好: `reasoner`
   - 职责: 审查计划和 patch，给出批准或拒绝
   - 输出: `approval` 或 `rejection` 消息

4. **Verifier** (验证者)
   - 模型偏好: `chat`
   - 职责: 运行测试，验证功能正确性
   - 输出: `verification` 消息

### 编排模式
- **linear**: 线性流程 (Planner → Executor → Critic → Verifier)
- **reflexion**: 反射循环 (Executor ↔ Critic 循环直到批准)
- **map-reduce**: 并行处理多个文件
- **debate**: 多方案辩论 (Planner 生成多个方案，Critic 选择最佳)

### 信息墙
- 角色之间只通过 `MessageEnvelope` 通信
- 看不到其他角色的内部状态
- 每个角色有独立的系统提示和模型偏好

## 使用

### 基本用法
```typescript
import { orchestrate, recommendMode } from './coordinator/roles';

const task = {
  taskId: 'fix-login',
  description: 'Fix bug in login flow',
  targetFiles: ['src/auth/login.ts'],
  cwd: process.cwd(),
  existingTests: ['test/auth/login.test.ts'],
};

const mode = recommendMode(task);
const result = await orchestrate(task, { mode });

if (result.success) {
  console.log('Success! Patch:', result.finalPatch);
} else {
  console.error('Failed:', result.error);
}
```

### 配置选项
```typescript
const config = {
  mode: 'reflexion',           // 编排模式
  maxTotalTurns: 20,           // 总轮数限制
  maxTotalDurationMs: 120000,  // 总超时
  criticRejectionThreshold: 0.4, // 拒绝率阈值（超过则降级）
  maxReflexionLoops: 3,        // Reflexion 最大循环次数
  mapReduceParallel: 3,        // Map-Reduce 并行数
  roleOverrides: {             // 角色配置覆盖
    planner: { maxTurns: 2 },
    executor: { timeoutMs: 30000 },
  },
};
```

### 结果结构
```typescript
interface OrchestrationResult {
  success: boolean;            // 是否成功
  mode: string;                // 使用的模式
  finalPatch?: string;         // 最终 patch（成功时）
  messageLog: MessageEnvelope[]; // 完整消息流水
  roleStats: Record<string, {   // 角色统计
    invocations: number;
    totalDurationMs: number;
    totalTokens: { input: number; output: number };
  }>;
  criticRejectionRate: number; // Critic 拒绝率
  totalDurationMs: number;     // 总耗时
  totalTurns: number;          // 总轮数
  error?: string;              // 错误信息
}
```

## 自动降级

当 `criticRejectionRate > criticRejectionThreshold` (默认 0.4) 时，系统会自动从复杂模式降级到 `linear` 模式。

## 扩展

### 添加新角色
1. 在 `contract.ts` 中定义角色类型
2. 在 `role-implementations.ts` 中实现角色类
3. 在 `DEFAULT_ROLE_CONFIGS` 中添加默认配置
4. 在 `createRole` 工厂函数中添加实例化逻辑

### 添加新模式
1. 在 `contract.ts` 中定义模式类型
2. 在 `orchestrator.ts` 中实现模式逻辑
3. 更新 `recommendMode` 函数（如果需要）

## 测试

```bash
# 运行测试
npm test -- src/coordinator/roles/__tests__/orchestrator.test.ts
```

## 文件结构
```
src/coordinator/roles/
├── contract.ts              # 类型定义和接口
├── orchestrator.ts          # 编排器实现
├── role-implementations.ts  # 角色具体实现
├── index.ts                 # 主入口
├── __tests__/
│   └── orchestrator.test.ts # 测试
└── README.md                # 本文档
```

## 设计原则

1. **信息墙**: 角色隔离，只能通过消息通信
2. **模型适配**: 不同角色使用不同模型（reasoner/chat）
3. **弹性降级**: 高拒绝率时自动降级到简单模式
4. **可观测性**: 完整的消息流水和统计信息
5. **可扩展性**: 易于添加新角色和模式