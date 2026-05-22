import { describe, test, expect } from 'bun:test';
import {
  topologicalSort,
  getLayers,
  runDag,
  linearDag,
  mapReduceDag,
  debateDag,
  planExecuteVerifyDag,
} from '../index';
import type { DagSpec, DagNode } from '../types';

// ── helpers ────────────────────────────────────────────────────────

function node(id: string, deps: string[] = [], overrides?: Partial<DagNode>): DagNode {
  return {
    id,
    kind: 'executor',
    deps,
    retryPolicy: { max: 0, backoffMs: 0 },
    timeoutMs: 5000,
    onFailure: 'abort',
    ...overrides,
  };
}

// ── Templates ──────────────────────────────────────────────────────

describe('DAG templates', () => {
  test('linearDag has 4 nodes', () => {
    const spec = linearDag();
    expect(spec.nodes.length).toBe(4);
    expect(spec.entry).toBe('planner');
    expect(spec.exit).toBe('verifier');
  });

  test('mapReduceDag default has planner + 3 executors + reducer + critic + verifier', () => {
    const spec = mapReduceDag(3);
    expect(spec.nodes.length).toBe(7);
    expect(spec.entry).toBe('planner');
    expect(spec.exit).toBe('verifier');
  });

  test('debateDag has 5 nodes with two executors', () => {
    const spec = debateDag();
    expect(spec.nodes.length).toBe(5);
    const executors = spec.nodes.filter(n => n.kind === 'executor');
    expect(executors.length).toBe(2);
  });

  test('planExecuteVerifyDag exposes the PEV chain', () => {
    const spec = planExecuteVerifyDag();
    expect(spec.nodes.map(n => n.id)).toEqual(['plan', 'execute', 'verify']);
    expect(spec.entry).toBe('plan');
    expect(spec.exit).toBe('verify');
    expect(spec.nodes[1].deps).toEqual(['plan']);
    expect(spec.nodes[2].deps).toEqual(['execute']);
    expect(spec.nodes[2].config?.gates).toContain('tdd-gate');
  });
});

// ── topologicalSort ────────────────────────────────────────────────

describe('topologicalSort', () => {
  test('returns correct order for linear chain', () => {
    const spec: DagSpec = {
      nodes: [node('c', ['b']), node('a'), node('b', ['a'])],
      entry: 'a',
      exit: 'c',
    };
    const sorted = topologicalSort(spec);
    expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    expect(sorted.indexOf('b')).toBeLessThan(sorted.indexOf('c'));
  });

  test('throws on cycle', () => {
    const spec: DagSpec = {
      nodes: [node('a', ['b']), node('b', ['a'])],
      entry: 'a',
      exit: 'b',
    };
    expect(() => topologicalSort(spec)).toThrow(/cycle/i);
  });

  test('throws on unknown dependency', () => {
    const spec: DagSpec = {
      nodes: [node('a', ['missing'])],
      entry: 'a',
      exit: 'a',
    };
    expect(() => topologicalSort(spec)).toThrow(/unknown/i);
  });
});

// ── getLayers ───────────────────────────────────────────────────────

describe('getLayers', () => {
  test('parallel nodes are in the same layer', () => {
    const spec: DagSpec = {
      nodes: [node('root'), node('a', ['root']), node('b', ['root']), node('end', ['a', 'b'])],
      entry: 'root',
      exit: 'end',
    };
    const layers = getLayers(spec);
    expect(layers.length).toBe(3);
    // a and b should be in the same layer
    const midLayer = layers[1];
    expect(midLayer).toContain('a');
    expect(midLayer).toContain('b');
  });

  test('linear chain produces one node per layer', () => {
    const spec: DagSpec = {
      nodes: [node('a'), node('b', ['a']), node('c', ['b'])],
      entry: 'a',
      exit: 'c',
    };
    const layers = getLayers(spec);
    expect(layers.length).toBe(3);
    expect(layers[0]).toEqual(['a']);
    expect(layers[1]).toEqual(['b']);
    expect(layers[2]).toEqual(['c']);
  });
});

// ── runDag ─────────────────────────────────────────────────────────

describe('runDag', () => {
  test('all success when every node succeeds', async () => {
    const spec: DagSpec = {
      nodes: [node('a'), node('b', ['a'])],
      entry: 'a',
      exit: 'b',
    };
    const result = await runDag(spec, {
      mockNodeExecutor: async (n) => `output-${n.id}`,
    });
    expect(result.status).toBe('success');
    expect(result.failedNodes.length).toBe(0);
    expect(result.nodeResults['a'].status).toBe('success');
    expect(result.nodeResults['b'].status).toBe('success');
  });

  test('node failure with abort skips dependents', async () => {
    const spec: DagSpec = {
      nodes: [
        node('a'),
        node('b', ['a']),  // default onFailure = 'abort'
      ],
      entry: 'a',
      exit: 'b',
    };
    const result = await runDag(spec, {
      mockNodeExecutor: async (n) => {
        if (n.id === 'a') throw new Error('fail');
        return 'ok';
      },
    });
    expect(result.status).not.toBe('success');
    expect(result.failedNodes).toContain('a');
    expect(result.nodeResults['b'].status).toBe('skipped');
  });

  test('partial failure with continue allows independent nodes', async () => {
    const spec: DagSpec = {
      nodes: [
        node('root'),
        node('a', ['root'], { onFailure: 'continue' }),
        node('b', ['root'], { onFailure: 'continue' }),
      ],
      entry: 'root',
      exit: 'b',
    };
    const result = await runDag(spec, {
      mockNodeExecutor: async (n) => {
        if (n.id === 'a') throw new Error('fail-a');
        return `ok-${n.id}`;
      },
    });
    expect(result.status).toBe('partial');
    expect(result.nodeResults['root'].status).toBe('success');
    expect(result.nodeResults['a'].status).toBe('failed');
    expect(result.nodeResults['b'].status).toBe('success');
  });

  test('does not pretend to execute without an explicit mainline executor', async () => {
    const spec: DagSpec = {
      nodes: [node('plan')],
      entry: 'plan',
      exit: 'plan',
    };
    const result = await runDag(spec);

    expect(result.status).toBe('failed');
    expect(result.failedNodes).toContain('plan');
    expect(result.nodeResults['plan'].error ?? '').toContain('no DSXU mainline executor');
  });
});
