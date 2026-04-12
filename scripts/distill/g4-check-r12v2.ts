/**
 * R5-12v2 mini-graph DAG — G4 蒸馏校验器
 *
 * 用法: bun run scripts/distill/g4-check-r12v2.ts
 */

import { resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const mod = await import(resolve(ROOT, 'src/coordinator/dag'));
  const { topologicalSort, getLayers, runDag, linearDag, reflexionDag, mapReduceDag, debateDag } = mod;

  let passed = 0;
  let failed = 0;

  function check(id: string, condition: boolean, msg: string = '') {
    if (condition) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  // ── Templates ──
  const linear = linearDag();
  check('tpl-01', linear.nodes.length === 4, `linear should have 4 nodes, got ${linear.nodes.length}`);
  check('tpl-02', linear.entry === 'planner', 'linear entry should be planner');

  const mr = mapReduceDag(3);
  check('tpl-03', mr.nodes.length === 7, `map-reduce(3) should have 7 nodes (planner+3exec+reducer+critic+verifier), got ${mr.nodes.length}`);

  const debate = debateDag();
  check('tpl-04', debate.nodes.length === 5, `debate should have 5 nodes, got ${debate.nodes.length}`);

  // ── Topological sort ──
  const sorted = topologicalSort(linear);
  check('topo-01', sorted[0] === 'planner', 'planner should be first');
  check('topo-02', sorted[sorted.length - 1] === 'verifier', 'verifier should be last');
  check('topo-03', sorted.indexOf('executor') < sorted.indexOf('critic'), 'executor before critic');

  // 环检测
  try {
    topologicalSort({
      nodes: [
        { id: 'a', kind: 'custom', deps: ['b'], retryPolicy: { max: 0, backoffMs: 0 }, timeoutMs: 1000, onFailure: 'abort' },
        { id: 'b', kind: 'custom', deps: ['a'], retryPolicy: { max: 0, backoffMs: 0 }, timeoutMs: 1000, onFailure: 'abort' },
      ],
      entry: 'a', exit: 'b',
    });
    check('topo-04', false, 'should throw on cycle');
  } catch (e: any) {
    check('topo-04', e.message.includes('cycle'), `error should mention cycle: ${e.message}`);
  }

  // ── Layers ──
  const layers = getLayers(mr);
  check('layer-01', layers.length >= 3, `map-reduce should have >=3 layers, got ${layers.length}`);
  check('layer-02', layers[0].includes('planner'), 'first layer should have planner');

  // ── runDag ──

  // 全部成功
  const result1 = await runDag(linear, {
    mockNodeExecutor: async (node) => ({ result: `${node.id} done` }),
  });
  check('run-01', result1.status === 'success', `expected success, got ${result1.status}`);
  check('run-02', result1.failedNodes.length === 0, 'no failed nodes');
  check('run-03', Object.keys(result1.nodeResults).length === 4, 'all 4 nodes should have results');

  // 节点失败 + abort
  const result2 = await runDag(linear, {
    mockNodeExecutor: async (node) => {
      if (node.id === 'executor') throw new Error('executor crashed');
      return { result: 'ok' };
    },
  });
  check('run-04', result2.status !== 'success', 'should not be success when executor fails');
  check('run-05', result2.failedNodes.includes('executor'), 'executor should be in failedNodes');

  // Map-reduce: 并发节点, 部分失败 + continue
  const result3 = await runDag(mr, {
    mockNodeExecutor: async (node) => {
      if (node.id === 'executor-1') throw new Error('one executor fails');
      return { result: `${node.id} ok` };
    },
  });
  check('run-06', result3.nodeResults['executor-0']?.status === 'success', 'executor-0 should succeed');
  check('run-07', result3.failedNodes.includes('executor-1'), 'executor-1 should fail');

  // Debate template
  const result4 = await runDag(debate, {
    mockNodeExecutor: async (node) => ({ result: `${node.id} voted` }),
  });
  check('run-08', result4.status === 'success', 'debate should succeed');
  check('run-09', result4.nodeResults['voter']?.status === 'success', 'voter should succeed');

  // Empty dag
  const emptyDag = { nodes: [], entry: '', exit: '' };
  const result5 = await runDag(emptyDag, {});
  check('run-10', result5.status === 'success', 'empty dag should succeed');

  console.log(`\n  R5-12v2 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
