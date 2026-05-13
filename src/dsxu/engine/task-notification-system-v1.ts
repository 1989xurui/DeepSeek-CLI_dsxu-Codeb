import type { TaskLifecycleEngine, TaskLifecycleStatus } from './task-lifecycle-engine-v1';

export function generateTaskNotificationXml(input: {
  taskId: string;
  status: TaskLifecycleStatus;
  summary: string;
  outputFile?: string;
  toolUseId?: string;
}): string {
  const outputLine = input.outputFile ? `\n<output-file>${input.outputFile}</output-file>` : '';
  const toolUseLine = input.toolUseId ? `\n<tool-use-id>${input.toolUseId}</tool-use-id>` : '';
  return `<task-notification>\n<task-id>${input.taskId}</task-id>${toolUseLine}${outputLine}\n<status>${input.status}</status>\n<summary>${input.summary}</summary>\n</task-notification>`;
}

export function enqueueTaskNotification(engine: TaskLifecycleEngine, input: {
  taskId: string;
  status: TaskLifecycleStatus;
  summary: string;
}): void {
  engine.pendingNotifications.push({ taskId: input.taskId, status: input.status, summary: input.summary });
}

export function emitTaskTerminatedSdk(engine: TaskLifecycleEngine, input: {
  taskId: string;
  status: TaskLifecycleStatus;
  summary: string;
}): void {
  engine.sdkTerminatedEvents.push({ taskId: input.taskId, status: input.status, summary: input.summary });
}

export function dequeueTaskNotification(engine: TaskLifecycleEngine): {
  taskId: string;
  status: TaskLifecycleStatus;
  summary: string;
} | undefined {
  return engine.pendingNotifications.shift();
}

export function peekPendingTaskNotifications(engine: TaskLifecycleEngine): Array<{
  taskId: string;
  status: TaskLifecycleStatus;
  summary: string;
}> {
  return [...engine.pendingNotifications];
}
