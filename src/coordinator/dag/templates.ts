/**
 * R5-12v2 DAG Templates — 4 编排模式映射为 DAG spec
 */

import type { DagSpec, DagNode } from './types';

const DEFAULT_RETRY = { max: 1, backoffMs: 500 };
const DEFAULT_TIMEOUT = 30_000;

function node(id: string, kind: DagNode['kind'], deps: string[] = [], overrides?: Partial<DagNode>): DagNode {
  return {
    id, kind, deps,
    retryPolicy: overrides?.retryPolicy ?? DEFAULT_RETRY,
    timeoutMs: overrides?.timeoutMs ?? DEFAULT_TIMEOUT,
    onFailure: overrides?.onFailure ?? 'abort',
    config: overrides?.config,
  };
}

/** Linear: Planner → Executor → Critic → Verifier */
export function linearDag(): DagSpec {
  return {
    nodes: [
      node('planner', 'planner'),
      node('executor', 'executor', ['planner']),
      node('critic', 'critic', ['executor']),
      node('verifier', 'verifier', ['critic']),
    ],
    entry: 'planner',
    exit: 'verifier',
  };
}

/** Reflexion: Planner → Executor → Critic → (loop or Verifier) */
export function reflexionDag(maxRetries: number = 3): DagSpec {
  return {
    nodes: [
      node('planner', 'planner'),
      node('executor', 'executor', ['planner'], { retryPolicy: { max: maxRetries, backoffMs: 500 } }),
      node('critic', 'critic', ['executor']),
      node('verifier', 'verifier', ['critic']),
    ],
    entry: 'planner',
    exit: 'verifier',
  };
}

/** Map-Reduce: Planner → [Executor×N] → Reducer → Critic → Verifier */
export function mapReduceDag(executorCount: number = 3): DagSpec {
  const executors: DagNode[] = [];
  for (let i = 0; i < executorCount; i++) {
    executors.push(node(`executor-${i}`, 'executor', ['planner'], { onFailure: 'continue' }));
  }

  return {
    nodes: [
      node('planner', 'planner'),
      ...executors,
      node('reducer', 'reducer', executors.map(e => e.id)),
      node('critic', 'critic', ['reducer']),
      node('verifier', 'verifier', ['critic']),
    ],
    entry: 'planner',
    exit: 'verifier',
  };
}

/** Debate: [Executor-A, Executor-B] → Voter → Verifier */
export function debateDag(): DagSpec {
  return {
    nodes: [
      node('planner', 'planner'),
      node('executor-a', 'executor', ['planner']),
      node('executor-b', 'executor', ['planner']),
      node('voter', 'voter', ['executor-a', 'executor-b']),
      node('verifier', 'verifier', ['voter']),
    ],
    entry: 'planner',
    exit: 'verifier',
  };
}
