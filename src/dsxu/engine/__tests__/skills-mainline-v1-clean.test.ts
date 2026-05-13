import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { SkillDefinition } from '../skills-types-v1';
import { SkillRegistry, buildInvocationPlan, resolvePromptPlan, selectSkills } from '../skills-registry-v1';
import { addPromptFragment, bindSkillToPromptLayers, createPromptStack } from '../prompt-stack-v1';
import { createQueryLoopSkillPromptState, consumeSkillPromptInQueryLoop, projectSkillPromptNextRoundInput } from '../query-loop';
import { consumeSkillResolutionInCoordinator } from '../coordinator-v1';
import { createSkillPromptSessionState, applySkillPromptToSession } from '../session';
import { consumeSkillPromptForRecovery } from '../recovery';
import { createSkillMainlinePorts, createSkillMainlineRuntime } from '../runtime-core';

function mkSkill(id: string, tag: 'analysis' | 'code-edit' | 'test', trigger: string, priority: number): { skill: SkillDefinition; priority: number } {
  return {
    priority,
    skill: {
      skillId: id,
      metadata: {
        name: id,
        description: `${id} desc`,
        version: '1.0.0',
        owner: 'duxu',
        tags: [tag],
      },
      input: { requiredFields: ['taskText'], optionalFields: [], schemaHint: 'simple' },
      output: { outputFields: ['result'], qualitySignals: ['ok'], failureSignals: ['err'] },
      triggers: [{ id: `${id}-trigger`, type: 'keyword', expression: trigger, weight: 1 }],
      constraints: [],
    },
  };
}

function buildSkillPromptFixture() {
  const registry = new SkillRegistry();
  const a = mkSkill('analysis-skill', 'analysis', 'analyze', 90);
  const b = mkSkill('test-skill', 'test', 'test', 70);
  registry.register(a.skill, a.priority);
  registry.register(b.skill, b.priority);

  const selected = selectSkills(registry, {
    context: { taskId: 'skill-mainline-task', taskText: 'analyze and test this module', runtimeStateHints: [], sessionHints: [] },
    requestedTags: ['analysis', 'test'],
    policy: { mode: 'multi-skill', maxSkills: 2, conflictPolicy: 'prefer-higher-priority' },
  });

  let stack = createPromptStack();
  stack = addPromptFragment(stack, { fragmentId: 'sys-1', layer: 'system', text: 'System base policy', priority: 5, source: 'base' });
  stack = addPromptFragment(stack, { fragmentId: 'task-1', layer: 'task', text: 'Task: analyze and test', priority: 4, source: 'task' });
  stack = addPromptFragment(stack, { fragmentId: 'skill-1', layer: 'skill', text: 'Use analysis-skill first', priority: 4, source: 'skill' });
  stack = addPromptFragment(stack, { fragmentId: 'ctx-1', layer: 'context', text: 'Recent failures exist', priority: 3, source: 'context' });

  const promptPlan = resolvePromptPlan(stack);
  const bindings = [
    bindSkillToPromptLayers('analysis-skill', [{ layer: 'skill', fragmentId: 'skill-1' }]),
    bindSkillToPromptLayers('test-skill', [{ layer: 'task', fragmentId: 'task-1' }]),
  ];
  const invocationPlan = buildInvocationPlan({ selected, bindings, promptStackId: stack.stackId });

  return { selected, promptPlan, invocationPlan, stack };
}

describe('V10-3 Phase C skills mainline clean checks', () => {
  test('1) query-loop consumes SkillInvocationPlan', () => {
    const { invocationPlan, promptPlan } = buildSkillPromptFixture();
    const q0 = createQueryLoopSkillPromptState('skill-mainline-task');
    const q1 = consumeSkillPromptInQueryLoop(q0, { skillPlan: invocationPlan, promptResolution: promptPlan });
    expect(q1.skillPlan?.planId).toBe(invocationPlan.planId);
  });

  test('2) query-loop consumes PromptStack resolution result', () => {
    const { invocationPlan, promptPlan } = buildSkillPromptFixture();
    const q0 = createQueryLoopSkillPromptState('skill-mainline-task');
    const q1 = consumeSkillPromptInQueryLoop(q0, { skillPlan: invocationPlan, promptResolution: promptPlan });
    expect(q1.promptResolution?.stackId).toBe(promptPlan.stackId);
  });

  test('3) next-round input is affected by skill/prompt results', () => {
    const { invocationPlan, promptPlan } = buildSkillPromptFixture();
    const q0 = createQueryLoopSkillPromptState('skill-mainline-task');
    const q1 = consumeSkillPromptInQueryLoop(q0, { skillPlan: invocationPlan, promptResolution: promptPlan });
    const next = projectSkillPromptNextRoundInput(q1);
    expect(next.hasSkillPlan).toBe(true);
    expect(next.promptInjected).toBe(true);
    expect(next.selectedSkillIds.length).toBeGreaterThan(0);
  });

  test('4) coordinator can consume skill resolution result', () => {
    const { invocationPlan } = buildSkillPromptFixture();
    const out = consumeSkillResolutionInCoordinator({
      taskId: 'skill-mainline-task',
      selectedSkillIds: invocationPlan.executionOrder,
      resolutionTrace: { reasons: invocationPlan.trace.reasons, discardedSkillIds: invocationPlan.trace.discardedSkillIds },
    });
    expect(out.consumeByDecision.skillCount).toBeGreaterThan(0);
  });

  test('5) session holds skill invocation state', () => {
    const { invocationPlan, promptPlan } = buildSkillPromptFixture();
    const s0 = createSkillPromptSessionState('skill-mainline-task');
    const s1 = applySkillPromptToSession(s0, {
      planId: invocationPlan.planId,
      selectedSkillIds: invocationPlan.executionOrder,
      promptStackId: promptPlan.stackId,
      finalPrompt: promptPlan.finalPrompt,
      selectedFragments: promptPlan.trace.selectedFragmentIds,
      reasons: invocationPlan.trace.reasons,
      discardedSkillIds: invocationPlan.trace.discardedSkillIds,
    });
    expect(s1.invocation.planId).toBe(invocationPlan.planId);
    expect(s1.invocation.selectedSkillIds.length).toBeGreaterThan(0);
  });

  test('6) session holds prompt snapshot/summary', () => {
    const { invocationPlan, promptPlan } = buildSkillPromptFixture();
    const s0 = createSkillPromptSessionState('skill-mainline-task');
    const s1 = applySkillPromptToSession(s0, {
      planId: invocationPlan.planId,
      selectedSkillIds: invocationPlan.executionOrder,
      promptStackId: promptPlan.stackId,
      finalPrompt: promptPlan.finalPrompt,
      selectedFragments: promptPlan.trace.selectedFragmentIds,
      reasons: invocationPlan.trace.reasons,
      discardedSkillIds: invocationPlan.trace.discardedSkillIds,
    });
    expect(s1.promptSnapshot.stackId).toBe(promptPlan.stackId);
    expect(s1.promptSnapshot.summary.length).toBeGreaterThan(0);
  });

  test('7) recovery consumes skill failure or prompt conflict', () => {
    const out = consumeSkillPromptForRecovery({
      skillFailures: [{ skillId: 'analysis-skill', reason: 'timeout' }],
      skillConflicts: [],
      promptConflicts: [{ fragmentIds: ['f1', 'f2'], reason: 'layer conflict' }],
    });
    expect(out.action).toBe('rebuild-prompt');
  });

  test('8) recovery outputs structured result', () => {
    const out = consumeSkillPromptForRecovery({
      skillFailures: [{ skillId: 'analysis-skill', reason: 'timeout' }],
      skillConflicts: [],
      promptConflicts: [],
    });
    expect(out).toHaveProperty('action');
    expect(out).toHaveProperty('severity');
    expect(out).toHaveProperty('suggestions');
    expect(out).toHaveProperty('trace');
  });

  test('9) runtime-core exports official skill mainline entry', () => {
    const ports = createSkillMainlinePorts();
    const runtime = createSkillMainlineRuntime();
    expect(typeof ports.consumeQueryLoopSkillPrompt).toBe('function');
    expect(typeof ports.consumeCoordinatorSkillResolution).toBe('function');
    expect(runtime.ports).toBeDefined();
  });

  test('10) no second main loop implementation', async () => {
    const text = await Bun.file(join(process.cwd(), 'src/dsxu/engine/query-loop.ts')).text();
    expect(text.includes('query-loop-v2')).toBe(false);
  });

  test('11) no second session/recovery/skill system implementation', async () => {
    const sessionText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/session.ts')).text();
    const recoveryText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/recovery/index.ts')).text();
    const skillsText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/skills-registry-v1.ts')).text();
    expect(sessionText.includes('session-v2')).toBe(false);
    expect(recoveryText.includes('recovery-v2')).toBe(false);
    expect(skillsText.includes('skills-registry-v2')).toBe(false);
  });

  test('12) verifies real mainline consumption, not object existence', () => {
    const { invocationPlan, promptPlan } = buildSkillPromptFixture();
    const ports = createSkillMainlinePorts();

    const q0 = createQueryLoopSkillPromptState('skill-mainline-task');
    const q1 = ports.consumeQueryLoopSkillPrompt(q0, { skillPlan: invocationPlan, promptResolution: promptPlan });
    const next = projectSkillPromptNextRoundInput(q1);

    const c1 = ports.consumeCoordinatorSkillResolution({
      taskId: 'skill-mainline-task',
      selectedSkillIds: invocationPlan.executionOrder,
      resolutionTrace: { reasons: invocationPlan.trace.reasons, discardedSkillIds: invocationPlan.trace.discardedSkillIds },
    });

    const s0 = createSkillPromptSessionState('skill-mainline-task');
    const s1 = ports.persistSkillPromptSession(s0, {
      planId: invocationPlan.planId,
      selectedSkillIds: invocationPlan.executionOrder,
      promptStackId: promptPlan.stackId,
      finalPrompt: promptPlan.finalPrompt,
      selectedFragments: promptPlan.trace.selectedFragmentIds,
      reasons: invocationPlan.trace.reasons,
      discardedSkillIds: invocationPlan.trace.discardedSkillIds,
    });

    const r1 = ports.buildSkillPromptRecovery({
      skillFailures: [{ skillId: 'analysis-skill', reason: 'timeout' }],
      skillConflicts: [],
      promptConflicts: [],
    });

    expect(next.hasSkillPlan).toBe(true);
    expect(c1.consumeByDecision.skillCount).toBeGreaterThan(0);
    expect(s1.invocation.status).toBe('running');
    expect(r1.action).toBe('retry-skill');
  });
});
