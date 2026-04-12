/**
 * R5-12v2 DAG Runner — 拓扑排序 + 并发调度 + retry
 */

import type { DagSpec, DagNode, DagRunResult, NodeResult, DagRunConfig } from './types';

/**
 * 拓扑排序（Kahn's algorithm）
 * 返回排好序的节点 id 列表。
 * 如果有环则抛出错误。
 */
export function topologicalSort(spec: DagSpec): string[] {
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of spec.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const node of spec.nodes) {
    for (const dep of node.deps) {
      if (!nodeMap.has(dep)) {
        throw new Error(`Node "${node.id}" depends on unknown node "${dep}"`);
      }
      adjacency.get(dep)!.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const next of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  if (sorted.length !== spec.nodes.length) {
    throw new Error('DAG contains a cycle — cannot topologically sort');
  }

  return sorted;
}

/**
 * 获取可并发执行的层级
 * 返回 string[][] — 每层的节点可以并行执行
 */
export function getLayers(spec: DagSpec): string[][] {
  const sorted = topologicalSort(spec);
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));
  const depth = new Map<string, number>();

  for (const id of sorted) {
    const node = nodeMap.get(id)!;
    let maxDepDep = -1;
    for (const dep of node.deps) {
      maxDepDep = Math.max(maxDepDep, depth.get(dep) ?? 0);
    }
    depth.set(id, maxDepDep + 1);
  }

  const layers: Map<number, string[]> = new Map();
  for (const [id, d] of depth) {
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(id);
  }

  return Array.from(layers.entries())
    .sort(([a], [b]) => a - b)
    .map(([, ids]) => ids);
}

/**
 * 运行 DAG
 */
export async function runDag(
  spec: DagSpec,
  config?: DagRunConfig
): Promise<DagRunResult> {
  const startTime = Date.now();
  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));
  const nodeResults: Record<string, NodeResult> = {};
  const nodeOutputs: Record<string, any> = {};
  const failedNodes: string[] = [];

  // 验证
  topologicalSort(spec); // throws on cycle

  const layers = getLayers(spec);

  for (const layer of layers) {
    // 并发执行同层节点
    const promises = layer.map(async (nodeId) => {
      const node = nodeMap.get(nodeId)!;

      // 检查依赖是否都成功
      const depsFailed = node.deps.some(dep => {
        const r = nodeResults[dep];
        return r && r.status !== 'success';
      });

      if (depsFailed && node.onFailure === 'abort') {
        const result: NodeResult = {
          nodeId,
          status: 'skipped',
          error: 'Dependency failed',
          durationMs: 0,
          retries: 0,
        };
        nodeResults[nodeId] = result;
        failedNodes.push(nodeId);
        return;
      }

      // 收集依赖输出作为输入
      const inputs: Record<string, any> = {};
      for (const dep of node.deps) {
        inputs[dep] = nodeOutputs[dep];
      }

      // 执行（带 retry）
      let lastError: string | undefined;
      let retries = 0;

      for (let attempt = 0; attempt <= node.retryPolicy.max; attempt++) {
        if (attempt > 0) {
          retries = attempt;
          await sleep(node.retryPolicy.backoffMs * attempt);
        }

        const nodeStart = Date.now();
        try {
          const output = await executeWithTimeout(
            () => executeNode(node, inputs, config),
            node.timeoutMs
          );

          nodeOutputs[nodeId] = output;
          nodeResults[nodeId] = {
            nodeId,
            status: 'success',
            output,
            durationMs: Date.now() - nodeStart,
            retries,
          };
          return; // success
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);

          if (lastError.includes('TIMEOUT')) {
            nodeResults[nodeId] = {
              nodeId,
              status: 'timeout',
              error: lastError,
              durationMs: Date.now() - nodeStart,
              retries,
            };
            failedNodes.push(nodeId);
            return;
          }
          // retry
        }
      }

      // All retries exhausted
      nodeResults[nodeId] = {
        nodeId,
        status: 'failed',
        error: lastError,
        durationMs: Date.now() - startTime,
        retries,
      };
      failedNodes.push(nodeId);
    });

    await Promise.all(promises);
  }

  // Determine overall status
  let status: DagRunResult['status'];
  if (failedNodes.length === 0) {
    status = 'success';
  } else if (failedNodes.length < spec.nodes.length) {
    status = 'partial';
  } else {
    status = 'failed';
  }

  return {
    status,
    nodeResults,
    failedNodes,
    durationMs: Date.now() - startTime,
  };
}

async function executeNode(
  node: DagNode,
  inputs: Record<string, any>,
  config?: DagRunConfig
): Promise<any> {
  if (config?.mockNodeExecutor) {
    return config.mockNodeExecutor(node, inputs);
  }
  // Real executor: dispatch to R5-17 role system
  return { nodeId: node.id, kind: node.kind, note: 'Real executor not yet wired' };
}

function executeWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    fn().then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
