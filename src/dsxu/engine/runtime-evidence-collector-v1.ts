import { AsyncLocalStorage } from 'node:async_hooks';

export interface RuntimeEvidence {
  lifecycleTransitions: Array<{ entity: string; from: string; to: string; reason: string; at: number }>;
  mainlineConsumptions: Array<{ module: string; signalType: string; detail: string; at: number }>;
}

export interface WorkloadContextScope {
  workloadType: 'interactive' | 'cron' | 'background';
  requestId?: string;
}

const workloadContextStorage = new AsyncLocalStorage<WorkloadContextScope>();

export function collectRuntimeEvidence(): RuntimeEvidence {
  return { lifecycleTransitions: [], mainlineConsumptions: [] };
}

export function recordLifecycleTransition(
  evidence: RuntimeEvidence,
  input: { entity: string; from: string; to: string; reason: string },
): RuntimeEvidence {
  evidence.lifecycleTransitions.push({ ...input, at: Date.now() });
  return evidence;
}

export function recordMainlineConsumption(
  evidence: RuntimeEvidence,
  input: { module: string; signalType: string; detail: string },
): RuntimeEvidence {
  evidence.mainlineConsumptions.push({ ...input, at: Date.now() });
  return evidence;
}

export function generateTestCoverageReport(evidence: RuntimeEvidence): {
  modulesCovered: string[];
  transitionCount: number;
  consumptionCount: number;
  hasCompleteMainlineEvidence: boolean;
} {
  const modulesCovered = [...new Set(evidence.mainlineConsumptions.map((e) => e.module))];
  return {
    modulesCovered,
    transitionCount: evidence.lifecycleTransitions.length,
    consumptionCount: evidence.mainlineConsumptions.length,
    hasCompleteMainlineEvidence: ['query-loop', 'gear-box', 'session', 'recovery'].every((m) => modulesCovered.includes(m)),
  };
}

export function runWithWorkloadContext<T>(scope: WorkloadContextScope, fn: () => T): T {
  return workloadContextStorage.run(scope, fn);
}

export function getWorkloadContext(): WorkloadContextScope | undefined {
  return workloadContextStorage.getStore();
}

export function inferWorkloadContext(input: { isCron?: boolean; isBackground?: boolean; requestId?: string }): WorkloadContextScope {
  return {
    workloadType: input.isCron ? 'cron' : input.isBackground ? 'background' : 'interactive',
    requestId: input.requestId,
  };
}
