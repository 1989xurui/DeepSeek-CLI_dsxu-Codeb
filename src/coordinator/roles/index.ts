/**
 * R5-17 Multi-Agent Role Coordination — Main Entry
 *
 * 导出所有公共接口和函数。
 *
 * 路径：src/coordinator/roles/index.ts
 */

// 导出类型和接口
export * from './contract';

// 导出编排器
export { orchestrate, setRoleFactory } from './orchestrator';

// 导出角色实现
export { createRole, formatOrchestrationReport, recommendMode } from './role-implementations';

// 导出消息工具函数
export { createEnvelope, filterInbox, extractPayload } from './message';

// 初始化角色工厂
import { setRoleFactory } from './orchestrator';
import { createRole } from './role-implementations';

setRoleFactory(createRole);

/**
 * 示例用法
 *
 * ```typescript
 * import { orchestrate, recommendMode } from './coordinator/roles';
 *
 * const task = {
 *   taskId: 'test-1',
 *   description: 'Fix bug in login flow',
 *   targetFiles: ['src/auth/login.ts'],
 *   cwd: process.cwd(),
 *   existingTests: ['test/auth/login.test.ts'],
 * };
 *
 * const mode = recommendMode(task);
 * const result = await orchestrate(task, { mode });
 *
 * if (result.success) {
 *   console.log('Success! Patch:', result.finalPatch);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */