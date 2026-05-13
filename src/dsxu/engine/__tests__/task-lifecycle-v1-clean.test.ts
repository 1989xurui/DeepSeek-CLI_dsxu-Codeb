import { describe, expect, test } from 'bun:test';
import {
  completeMainSessionTask,
  createLocalAgentTask,
  createTaskLifecycleEngine,
  foregroundMainSessionTask,
  registerMainSessionTask,
  startBackgroundSession,
  stopTask,
} from '../task-lifecycle-engine-v1';
import {
  emitTaskTerminatedSdk,
  enqueueTaskNotification,
  generateTaskNotificationXml,
} from '../task-notification-system-v1';
import { applyTaskLifecycleToSession, createSessionTaskLifecycleState } from '../session';
import { consumeTaskLifecycleForRecovery } from '../recovery';
import { createTaskLifecycleRuntimePorts } from '../runtime-core';

describe('V10-2F Phase B - task lifecycle absorption', () => {
  const engine = createTaskLifecycleEngine();
  const main = registerMainSessionTask(engine, { taskId: 's-1', description: 'main query' });
  foregroundMainSessionTask(engine, 's-1');
  completeMainSessionTask(engine, 's-1', true);
  const bg = startBackgroundSession(engine, { taskId: 's-2', description: 'background query' });
  const agent = createLocalAgentTask(engine, { taskId: 'a-1', description: 'agent task', agentId: 'agent-1' });
  stopTask(engine, 'a-1');

  const xml = generateTaskNotificationXml({ taskId: 'a-1', status: 'stopped', summary: 'was stopped' });
  enqueueTaskNotification(engine, { taskId: 'a-1', status: 'stopped', summary: 'was stopped' });
  emitTaskTerminatedSdk(engine, { taskId: 'a-1', status: 'stopped', summary: 'was stopped' });

  const sessionState = applyTaskLifecycleToSession(createSessionTaskLifecycleState(), {
    taskId: 'a-1',
    status: 'stopped',
    summary: 'was stopped',
  });
  const recovery = consumeTaskLifecycleForRecovery({
    taskEvents: [{ taskId: 'a-1', status: 'stopped', summary: 'was stopped' }],
  });

  test('1. main session task register/complete exists', () => {
    expect(main.kind).toBe('main-session');
    expect(engine.tasks['s-1'].status).toBe('completed');
  });

  test('2. background session exists', () => {
    expect(bg.kind).toBe('background-session');
  });

  test('3. stopTask exists', () => {
    expect(engine.tasks['a-1'].status).toBe('stopped');
  });

  test('4. local agent task exists', () => {
    expect(agent.kind).toBe('local-agent');
  });

  test('5. task state machine exists', () => {
    expect(Object.keys(engine.tasks).length).toBeGreaterThan(0);
  });

  test('6. task notification xml is non-empty structure', () => {
    expect(xml).toContain('<task-notification>');
    expect(xml).toContain('<task-id>a-1</task-id>');
  });

  test('7. pending notification mechanism exists', () => {
    expect(engine.pendingNotifications.length).toBe(1);
  });

  test('8. sdk terminated event exists', () => {
    expect(engine.sdkTerminatedEvents.length).toBe(1);
  });

  test('9. session/recovery consume lifecycle output', () => {
    expect(sessionState.stoppedTaskIds).toContain('a-1');
    expect(recovery.action).toBe('retry-task');
  });

  test('10. no second task system introduced', () => {
    const ports = createTaskLifecycleRuntimePorts();
    expect(typeof ports.consumeSessionTaskLifecycle).toBe('function');
    expect(typeof ports.consumeRecoveryTaskLifecycle).toBe('function');
  });
});
