import { describe, expect, test } from 'bun:test';
import {
  detectStuckByActionHistory,
  evaluateIterationGuard,
  executeBatchSkill,
  mapToolUseToDSXUAssistantMessage,
  verifyContentConsistency,
} from '../skills-registry-v1';
import {
  analyzeContextWeighted,
  checkHighRiskBash,
  mergePromptStackLayers,
  resolveIntent,
} from '../query-context-builder-v1';
import {
  cascadeShutdownTasks,
  createRuntimeTaskGraph,
  transitionRuntimeTaskState,
  upsertRuntimeTask,
} from '../runtime-core';

describe('V10-3X core runtime parity', () => {
  test('Task A: batch DAG ordering is executable', () => {
    const result = executeBatchSkill({
      mode: 'parallel',
      tasks: [
        { id: 'A', goal: 'prepare' },
        { id: 'B', goal: 'build', dependsOn: ['A'] },
        { id: 'C', goal: 'verify', dependsOn: ['B'] },
      ],
    });
    expect(result.ok).toBeTrue();
    expect(result.output.plan.topologicalOrder).toEqual(['A', 'B', 'C']);
    expect(result.output.plan.hasDependencyCycle).toBeFalse();
  });

  test('Task A: dsxu tool_use protocol conversion exists', () => {
    const msg = mapToolUseToDSXUAssistantMessage({
      prefaceText: 'will use tool',
      toolUse: { id: 'tool-1', name: 'Read', input: { path: 'a.ts' } },
    });
    expect(msg.role).toBe('assistant');
    expect(msg.content[1]).toEqual({ type: 'tool_use', id: 'tool-1', name: 'Read', input: { path: 'a.ts' } });
  });

  test('Task A: loop/stuck/verifyContent runtime semantics exist', () => {
    const guard = evaluateIterationGuard({ depth: 9, maxDepth: 10, recentFingerprints: ['x', 'x', 'x'] });
    expect(guard.shouldBackoff).toBeTrue();
    expect(guard.shouldAbort).toBeTrue();

    const stuck = detectStuckByActionHistory([
      { action: 'read', fingerprint: 'f1', timestamp: 1 },
      { action: 'read', fingerprint: 'f1', timestamp: 2 },
      { action: 'read', fingerprint: 'f1', timestamp: 3 },
    ]);
    expect(stuck.stuck).toBeTrue();

    const verify = verifyContentConsistency({ before: 'a', after: 'b', expectedEditApplied: true });
    expect(verify.consistent).toBeTrue();
  });

  test('Task B: runtime task graph supports cascade shutdown', () => {
    const graph = createRuntimeTaskGraph();
    upsertRuntimeTask(graph, { taskId: 'root', state: 'running' });
    upsertRuntimeTask(graph, { taskId: 'child-1', state: 'running', parentTaskId: 'root' });
    upsertRuntimeTask(graph, { taskId: 'child-2', state: 'running', parentTaskId: 'child-1' });
    transitionRuntimeTaskState(graph, { taskId: 'child-2', to: 'running' });

    const stopped = cascadeShutdownTasks(graph, { rootTaskId: 'root', reason: 'manual-stop' });
    expect(stopped.map((x) => x.taskId).sort()).toEqual(['child-1', 'child-2', 'root']);
    expect(graph.tasks['child-2'].state).toBe('stopped');
  });

  test('Task C: intent matrix + bash guard + prompt stack merge are runtime-usable', () => {
    const intent = resolveIntent({ text: 'please refactor and simplify this module, then run test coverage' });
    expect(['refactor', 'test']).toContain(intent.intent);
    expect(intent.matchedFeatures.length).toBeGreaterThan(0);

    const bash = checkHighRiskBash({ command: 'rm -rf /' });
    expect(bash.totalRegexCount).toBeGreaterThanOrEqual(200);
    expect(bash.blocked).toBeTrue();

    const merged = mergePromptStackLayers({
      identity: ['You are DSXU.'],
      capability: ['Can edit code.'],
      context: ['Project uses TypeScript.'],
      constraint: ['Never use hardcoded fake audit data.'],
    });
    expect(merged.layers).toHaveLength(4);
    expect(merged.merged).toContain('Never use hardcoded fake audit data.');
  });

  test('Task C: weighted context selection prefers high-priority slices', () => {
    const weighted = analyzeContextWeighted({
      maxTokens: 20,
      messages: [
        { role: 'assistant', content: 'normal response text' },
        { role: 'error', content: 'critical exception stacktrace' },
        { role: 'tool', content: 'tool execution result with details' },
      ],
    });
    expect(weighted.selected.length).toBeGreaterThan(0);
    expect(weighted.total).toBeLessThanOrEqual(20);
  });
});
