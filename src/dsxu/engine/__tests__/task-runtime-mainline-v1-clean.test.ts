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
import { emitTaskTerminatedSdk, enqueueTaskNotification, generateTaskNotificationXml } from '../task-notification-system-v1';
import { applyTaskLifecycleToSession, createSessionTaskLifecycleState } from '../session';

describe('task-runtime-mainline-v1-clean', () => {
  test('main/background/local tasks have real lifecycle transitions', () => {
    const engine = createTaskLifecycleEngine();
    const main = registerMainSessionTask(engine, { taskId: 'main-1', description: 'main session task' });
    expect(main.status).toBe('running');
    const bg = startBackgroundSession(engine, { taskId: 'bg-1', description: 'background task' });
    expect(bg.kind).toBe('background-session');
    const local = createLocalAgentTask(engine, { taskId: 'agent-1', description: 'agent task', agentId: 'a-1' });
    expect(local.metadata?.agentId).toBe('a-1');

    foregroundMainSessionTask(engine, 'main-1');
    completeMainSessionTask(engine, 'main-1', true);
    const stopped = stopTask(engine, 'bg-1');
    expect(stopped.status).toBe('stopped');
  });

  test('stop/notify/sdk/session-consume are connected', () => {
    const engine = createTaskLifecycleEngine();
    registerMainSessionTask(engine, { taskId: 'main-2', description: 'task 2' });
    const xml = generateTaskNotificationXml({ taskId: 'main-2', status: 'running', summary: 'started' });
    expect(xml).toContain('<task-notification>');

    enqueueTaskNotification(engine, { taskId: 'main-2', status: 'running', summary: 'queued' });
    emitTaskTerminatedSdk(engine, { taskId: 'main-2', status: 'completed', summary: 'done' });
    expect(engine.pendingNotifications).toHaveLength(1);
    expect(engine.sdkTerminatedEvents).toHaveLength(1);

    let state = createSessionTaskLifecycleState();
    state = applyTaskLifecycleToSession(state, { taskId: 'main-2', status: 'running', summary: 'go' });
    state = applyTaskLifecycleToSession(state, { taskId: 'main-2', status: 'completed', summary: 'ok' });
    expect(state.completedTaskIds).toContain('main-2');
    expect(state.activeTaskIds).not.toContain('main-2');
  });
});
