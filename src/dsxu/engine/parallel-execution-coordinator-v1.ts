export interface ParallelExecutionPlan {
  mode: 'parallel' | 'sequential';
  readOnlyBranches: string[];
  writeBranches: string[];
  maxParallel: number;
  reason: string;
}

export interface WriteConflict {
  conflictId: string;
  branches: string[];
  filePath: string;
  reason: string;
}

export function detectWriteConflicts(input: {
  writes: Array<{ branchId: string; filePath: string }>;
}): WriteConflict[] {
  const conflicts: WriteConflict[] = [];
  const byFile = new Map<string, string[]>();
  for (const w of input.writes) {
    byFile.set(w.filePath, [...(byFile.get(w.filePath) || []), w.branchId]);
  }
  for (const [filePath, branches] of byFile.entries()) {
    if (branches.length > 1) {
      conflicts.push({
        conflictId: `conf-${filePath}-${branches.length}`,
        branches,
        filePath,
        reason: 'multiple write branches target same file',
      });
    }
  }
  return conflicts;
}

export function coordinateParallelExecution(input: {
  branches: Array<{ branchId: string; accessMode: 'read-only' | 'write' }>;
  maxParallel: number;
  writes?: Array<{ branchId: string; filePath: string }>;
}): {
  plan: ParallelExecutionPlan;
  conflicts: WriteConflict[];
} {
  const readOnlyBranches = input.branches.filter((b) => b.accessMode === 'read-only').map((b) => b.branchId);
  const writeBranches = input.branches.filter((b) => b.accessMode === 'write').map((b) => b.branchId);
  const conflicts = detectWriteConflicts({ writes: input.writes || [] });
  const mode = conflicts.length > 0 || writeBranches.length > 1 ? 'sequential' : 'parallel';
  const maxParallel = mode === 'parallel' ? Math.max(1, input.maxParallel) : 1;
  return {
    plan: {
      mode,
      readOnlyBranches,
      writeBranches,
      maxParallel,
      reason: conflicts.length > 0 ? 'write conflict detected' : mode === 'parallel' ? 'safe parallelism' : 'write-heavy scheduling',
    },
    conflicts,
  };
}

export interface TeammateModel {
  teammateId: string;
  role: 'researcher' | 'implementer' | 'verifier' | 'coordinator';
  capacity: number;
  available: boolean;
}

export interface TeammateMailboxMessage {
  id: string;
  from: string;
  to: string;
  topic: string;
  body: string;
  createdAt: number;
  acknowledged: boolean;
}

const teammateMailboxes = new Map<string, TeammateMailboxMessage[]>();

export function agentSwarmsEnabled(input?: { flag?: boolean; env?: string }): boolean {
  if (input?.flag !== undefined) return input.flag;
  return input?.env === '1' || input?.env === 'true';
}

export function teammateInit(input: {
  teamId: string;
  teammates: TeammateModel[];
}): {
  teamId: string;
  activeCount: number;
  members: TeammateModel[];
} {
  input.teammates.forEach((t) => {
    if (!teammateMailboxes.has(t.teammateId)) teammateMailboxes.set(t.teammateId, []);
  });
  return {
    teamId: input.teamId,
    activeCount: input.teammates.filter((t) => t.available).length,
    members: input.teammates,
  };
}

export function teammateContext(input: {
  teamId: string;
  parentTaskId: string;
  mode: 'in-process' | 'standalone';
}): {
  teamId: string;
  parentTaskId: string;
  mode: 'in-process' | 'standalone';
  mailboxReady: boolean;
} {
  return { ...input, mailboxReady: true };
}

export function teammateMailboxSend(input: {
  from: string;
  to: string;
  topic: string;
  body: string;
}): TeammateMailboxMessage {
  const msg: TeammateMailboxMessage = {
    id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    from: input.from,
    to: input.to,
    topic: input.topic,
    body: input.body,
    createdAt: Date.now(),
    acknowledged: false,
  };
  const mailbox = teammateMailboxes.get(input.to) || [];
  mailbox.push(msg);
  teammateMailboxes.set(input.to, mailbox);
  return msg;
}

export function teammateMailboxReceive(teammateId: string): TeammateMailboxMessage[] {
  return [...(teammateMailboxes.get(teammateId) || [])];
}

export function teammateMailboxAck(teammateId: string, messageId: string): boolean {
  const mailbox = teammateMailboxes.get(teammateId) || [];
  const hit = mailbox.find((m) => m.id === messageId);
  if (!hit) return false;
  hit.acknowledged = true;
  return true;
}

export function collapseTeammateShutdowns(input: Array<{ teammateId: string; reason: string }>): Array<{ reason: string; teammateIds: string[] }> {
  const grouped = new Map<string, string[]>();
  for (const item of input) {
    grouped.set(item.reason, [...(grouped.get(item.reason) || []), item.teammateId]);
  }
  return [...grouped.entries()].map(([reason, teammateIds]) => ({ reason, teammateIds }));
}

export function teammateModeSnapshot(input: {
  teamId: string;
  mode: 'in-process' | 'standalone';
  teammates: string[];
}): { teamId: string; mode: string; teammateCount: number; capturedAt: number } {
  return {
    teamId: input.teamId,
    mode: input.mode,
    teammateCount: input.teammates.length,
    capturedAt: Date.now(),
  };
}

export function inProcessTeammateHelpers(input: { teammateIds: string[]; currentId: string }): {
  peers: string[];
  canBroadcast: boolean;
} {
  return {
    peers: input.teammateIds.filter((id) => id !== input.currentId),
    canBroadcast: input.teammateIds.length > 1,
  };
}

export function teammateLayoutManager(input: {
  teammates: TeammateModel[];
  maxColumns?: number;
}): Array<{ teammateId: string; row: number; col: number }> {
  const maxColumns = Math.max(1, input.maxColumns || 2);
  return input.teammates.map((t, idx) => ({
    teammateId: t.teammateId,
    row: Math.floor(idx / maxColumns),
    col: idx % maxColumns,
  }));
}
