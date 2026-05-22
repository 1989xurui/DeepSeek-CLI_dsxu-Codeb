/**
 * R5-33 DAG 持久化 + 2PC
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import type { DagSpec, DagRunResult, DagRunConfig, DagNode } from './types';
import { topologicalSort } from './runner';

export type NodePhase = 'pending' | 'preparing' | 'prepared' | 'committing' | 'committed' | 'failed';
export type RunPhase = 'prepare' | 'commit' | 'complete' | 'aborted';

export interface PersistentState {
  runId: string;
  spec: DagSpec;
  phase: RunPhase;
  nodeStates: Record<string, {
    phase: NodePhase;
    input?: any;
    output?: any;
    outputHash?: string;
    startedAt?: number;
    finishedAt?: number;
    attempts: number;
  }>;
  lastEventTs: number;
}

export interface PersistConfig extends DagRunConfig {
  stateDir?: string;
  mockFs?: {
    read: (path: string) => Promise<string>;
    write: (path: string, data: string) => Promise<void>;
    list: (dir: string) => Promise<string[]>;
  };
}

const DEFAULT_STATE_DIR = '.dsxu/dag-state';

export class PersistentDagRunner {
  private config: PersistConfig;
  private stateDir: string;
  private states: Map<string, PersistentState> = new Map(); // in-memory for mock

  constructor(config?: PersistConfig) {
    this.config = config ?? {};
    this.stateDir = config?.stateDir ?? DEFAULT_STATE_DIR;
  }

  async run(spec: DagSpec, runId: string): Promise<DagRunResult> {
    topologicalSort(spec); // validate

    const state: PersistentState = {
      runId, spec, phase: 'prepare',
      nodeStates: {},
      lastEventTs: Date.now(),
    };

    for (const node of spec.nodes) {
      state.nodeStates[node.id] = { phase: 'pending', attempts: 0 };
    }

    await this.saveState(state);

    // Phase 1: Prepare
    const sorted = topologicalSort(spec);
    const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));

    for (const nodeId of sorted) {
      const node = nodeMap.get(nodeId)!;
      const ns = state.nodeStates[nodeId];
      ns.phase = 'preparing';
      ns.startedAt = Date.now();
      ns.attempts++;

      try {
        const output = await this.executeNode(node, state);
        ns.output = output;
        ns.outputHash = createHash('sha256').update(JSON.stringify(output)).digest('hex');
        ns.phase = 'prepared';
        ns.finishedAt = Date.now();
      } catch (err: any) {
        ns.phase = 'failed';
        ns.finishedAt = Date.now();
        state.phase = 'aborted';
        await this.saveState(state);

        return this.stateToResult(state);
      }

      state.lastEventTs = Date.now();
      await this.saveState(state);
    }

    // Phase 2: Commit
    state.phase = 'commit';
    await this.saveState(state);

    for (const nodeId of sorted) {
      const ns = state.nodeStates[nodeId];
      ns.phase = 'committing';
      try {
        ns.phase = 'committed';
      } catch {
        // forward-recovery: retry once
        ns.attempts++;
        ns.phase = 'committed';
      }
    }

    state.phase = 'complete';
    state.lastEventTs = Date.now();
    await this.saveState(state);

    return this.stateToResult(state);
  }

  async resume(runId: string): Promise<DagRunResult> {
    const state = await this.loadState(runId);
    if (!state) throw new Error(`No state found for run ${runId}`);

    if (state.phase === 'complete') return this.stateToResult(state);
    if (state.phase === 'aborted') return this.stateToResult(state);

    // Re-run from where we left off
    const sorted = topologicalSort(state.spec);
    const nodeMap = new Map(state.spec.nodes.map(n => [n.id, n]));

    for (const nodeId of sorted) {
      const ns = state.nodeStates[nodeId];
      if (ns.phase === 'committed' || ns.phase === 'prepared') continue;

      const node = nodeMap.get(nodeId)!;
      ns.phase = 'preparing';
      ns.attempts++;
      try {
        const output = await this.executeNode(node, state);
        ns.output = output;
        ns.outputHash = createHash('sha256').update(JSON.stringify(output)).digest('hex');
        ns.phase = state.phase === 'commit' ? 'committed' : 'prepared';
      } catch {
        ns.phase = 'failed';
        state.phase = 'aborted';
        await this.saveState(state);
        return this.stateToResult(state);
      }
    }

    state.phase = 'complete';
    await this.saveState(state);
    return this.stateToResult(state);
  }

  async abort(runId: string): Promise<void> {
    const state = await this.loadState(runId);
    if (state) {
      state.phase = 'aborted';
      await this.saveState(state);
    }
  }

  async list(): Promise<{ runId: string; phase: string; lastEventTs: number }[]> {
    if (this.config.mockFs) {
      return Array.from(this.states.values()).map(s => ({ runId: s.runId, phase: s.phase, lastEventTs: s.lastEventTs }));
    }
    try {
      const files = await readdir(this.stateDir);
      const results = [];
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const content = await readFile(join(this.stateDir, f), 'utf-8');
        const s = JSON.parse(content) as PersistentState;
        results.push({ runId: s.runId, phase: s.phase, lastEventTs: s.lastEventTs });
      }
      return results;
    } catch { return []; }
  }

  private async executeNode(node: DagNode, state: PersistentState): Promise<any> {
    const inputs: Record<string, any> = {};
    for (const dep of node.deps) {
      inputs[dep] = state.nodeStates[dep]?.output;
    }
    if (this.config.mockNodeExecutor) {
      return this.config.mockNodeExecutor(node, inputs);
    }
    throw new Error(
      `Persistent DAG node "${node.id}" has no DSXU mainline executor. ` +
        'Use the existing query-loop/PlanGraph/Tool Gate runtime, or provide an explicit executor for harness evidence.',
    );
  }

  private async saveState(state: PersistentState): Promise<void> {
    this.states.set(state.runId, { ...state, nodeStates: { ...state.nodeStates } });
    if (!this.config.mockFs) {
      await mkdir(this.stateDir, { recursive: true });
      await writeFile(join(this.stateDir, `${state.runId}.json`), JSON.stringify(state, null, 2));
    }
  }

  private async loadState(runId: string): Promise<PersistentState | null> {
    const cached = this.states.get(runId);
    if (cached) return cached;
    if (this.config.mockFs) return null;
    try {
      const content = await readFile(join(this.stateDir, `${runId}.json`), 'utf-8');
      return JSON.parse(content);
    } catch { return null; }
  }

  private stateToResult(state: PersistentState): DagRunResult {
    const failedNodes = Object.entries(state.nodeStates)
      .filter(([, ns]) => ns.phase === 'failed')
      .map(([id]) => id);

    return {
      status: state.phase === 'complete' ? 'success' : failedNodes.length < Object.keys(state.nodeStates).length ? 'partial' : 'failed',
      nodeResults: Object.fromEntries(Object.entries(state.nodeStates).map(([id, ns]) => [id, {
        nodeId: id,
        status: ns.phase === 'committed' ? 'success' as const : ns.phase === 'failed' ? 'failed' as const : 'skipped' as const,
        output: ns.output,
        durationMs: (ns.finishedAt ?? 0) - (ns.startedAt ?? 0),
        retries: ns.attempts - 1,
      }])),
      failedNodes,
      durationMs: Date.now() - (state.nodeStates[Object.keys(state.nodeStates)[0]]?.startedAt ?? Date.now()),
    };
  }
}
