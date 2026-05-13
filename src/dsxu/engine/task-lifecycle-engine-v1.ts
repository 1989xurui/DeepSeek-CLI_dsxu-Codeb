export type TaskKind = 'main-session' | 'background-session' | 'local-agent';
export type TaskLifecycleStatus = 'running' | 'completed' | 'failed' | 'stopped';

export interface LifecycleTask {
  taskId: string;
  kind: TaskKind;
  description: string;
  status: TaskLifecycleStatus;
  startTime: number;
  endTime?: number;
  foregrounded?: boolean;
  metadata?: Record<string, any>;
}

export interface TaskLifecycleEngine {
  tasks: Record<string, LifecycleTask>;
  pendingNotifications: Array<{ taskId: string; status: TaskLifecycleStatus; summary: string }>;
  sdkTerminatedEvents: Array<{ taskId: string; status: TaskLifecycleStatus; summary: string }>;
  shellTaskIds: Set<string>;
}

export function createTaskLifecycleEngine(): TaskLifecycleEngine {
  return { tasks: {}, pendingNotifications: [], sdkTerminatedEvents: [], shellTaskIds: new Set<string>() };
}

export function registerMainSessionTask(engine: TaskLifecycleEngine, input: { taskId: string; description: string }): LifecycleTask {
  const task: LifecycleTask = {
    taskId: input.taskId,
    kind: 'main-session',
    description: input.description,
    status: 'running',
    startTime: Date.now(),
    foregrounded: false,
  };
  engine.tasks[input.taskId] = task;
  return task;
}

export function completeMainSessionTask(engine: TaskLifecycleEngine, taskId: string, success: boolean): LifecycleTask {
  const task = engine.tasks[taskId];
  if (!task) throw new Error(`task not found: ${taskId}`);
  task.status = success ? 'completed' : 'failed';
  task.endTime = Date.now();
  return task;
}

export function foregroundMainSessionTask(engine: TaskLifecycleEngine, taskId: string): LifecycleTask {
  const task = engine.tasks[taskId];
  if (!task) throw new Error(`task not found: ${taskId}`);
  task.foregrounded = true;
  return task;
}

export function startBackgroundSession(engine: TaskLifecycleEngine, input: { taskId: string; description: string }): LifecycleTask {
  const task: LifecycleTask = {
    taskId: input.taskId,
    kind: 'background-session',
    description: input.description,
    status: 'running',
    startTime: Date.now(),
  };
  engine.tasks[input.taskId] = task;
  return task;
}

export function createLocalAgentTask(engine: TaskLifecycleEngine, input: { taskId: string; description: string; agentId: string }): LifecycleTask {
  const task: LifecycleTask = {
    taskId: input.taskId,
    kind: 'local-agent',
    description: input.description,
    status: 'running',
    startTime: Date.now(),
    metadata: { agentId: input.agentId },
  };
  engine.tasks[input.taskId] = task;
  return task;
}

export function createDreamTask(engine: TaskLifecycleEngine, input: { taskId: string; description: string; dreamMode?: 'explore' | 'synthesize' }): LifecycleTask {
  const task: LifecycleTask = {
    taskId: input.taskId,
    kind: 'background-session',
    description: input.description,
    status: 'running',
    startTime: Date.now(),
    metadata: { dreamMode: input.dreamMode || 'explore' },
  };
  engine.tasks[input.taskId] = task;
  return task;
}

export function createInProcessTeammateTask(engine: TaskLifecycleEngine, input: { taskId: string; description: string; teammateId: string }): LifecycleTask {
  const task: LifecycleTask = {
    taskId: input.taskId,
    kind: 'background-session',
    description: input.description,
    status: 'running',
    startTime: Date.now(),
    metadata: { teammateId: input.teammateId, inProcess: true },
  };
  engine.tasks[input.taskId] = task;
  return task;
}

export function createRemoteAgentTask(engine: TaskLifecycleEngine, input: { taskId: string; description: string; remoteAgentId: string }): LifecycleTask {
  const task: LifecycleTask = {
    taskId: input.taskId,
    kind: 'local-agent',
    description: input.description,
    status: 'running',
    startTime: Date.now(),
    metadata: { remoteAgentId: input.remoteAgentId, remote: true },
  };
  engine.tasks[input.taskId] = task;
  return task;
}

export function createLocalShellTask(engine: TaskLifecycleEngine, input: { taskId: string; description: string; command: string }): LifecycleTask {
  const task: LifecycleTask = {
    taskId: input.taskId,
    kind: 'background-session',
    description: input.description,
    status: 'running',
    startTime: Date.now(),
    metadata: { command: input.command, shell: true },
  };
  engine.tasks[input.taskId] = task;
  engine.shellTaskIds.add(input.taskId);
  return task;
}

export function stopTask(engine: TaskLifecycleEngine, taskId: string): LifecycleTask {
  const task = engine.tasks[taskId];
  if (!task) throw new Error(`task not found: ${taskId}`);
  if (task.status !== 'running') throw new Error(`task not running: ${taskId}`);
  task.status = 'stopped';
  task.endTime = Date.now();
  return task;
}

export function killShellTasks(engine: TaskLifecycleEngine, reason = 'killed-by-controller'): Array<{ taskId: string; status: TaskLifecycleStatus; reason: string }> {
  const killed: Array<{ taskId: string; status: TaskLifecycleStatus; reason: string }> = [];
  for (const taskId of engine.shellTaskIds) {
    const task = engine.tasks[taskId];
    if (!task || task.status !== 'running') continue;
    task.status = 'stopped';
    task.endTime = Date.now();
    task.metadata = { ...(task.metadata || {}), killReason: reason };
    killed.push({ taskId, status: task.status, reason });
  }
  return killed;
}

export function localShellTaskGuard(input: {
  command: string;
  allowWrite?: boolean;
}): { allow: boolean; reason: string } {
  const normalized = input.command.toLowerCase();
  const dangerous = /\brm\s+-rf\b|\bdel\s+\/s\b|\bformat\b/.test(normalized);
  if (dangerous) return { allow: false, reason: 'dangerous shell pattern detected' };
  const writeLike = /\b(write|edit|mv|cp|rename)\b/.test(normalized);
  if (writeLike && input.allowWrite !== true) return { allow: false, reason: 'write shell command requires allowWrite' };
  return { allow: true, reason: 'shell command allowed' };
}

export function buildPillLabel(input: { kind: TaskKind; status: TaskLifecycleStatus }): string {
  const kindTag =
    input.kind === 'main-session' ? 'MAIN' :
    input.kind === 'background-session' ? 'BG' :
    'AGENT';
  const statusTag =
    input.status === 'running' ? 'RUN' :
    input.status === 'completed' ? 'DONE' :
    input.status === 'failed' ? 'FAIL' :
    'STOP';
  return `${kindTag}:${statusTag}`;
}

export function isBackgroundTask(task: LifecycleTask): boolean {
  return task.kind === 'background-session' || task.kind === 'local-agent';
}

export function isTaskTerminal(status: TaskLifecycleStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}
