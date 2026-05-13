import { describe, expect, test } from 'bun:test';
import { SkillRegistry, buildInvocationPlan, resolvePromptPlan, selectSkills } from '../../engine/skills-registry-v1';
import { createPromptStack, addPromptFragment, bindSkillToPromptLayers } from '../../engine/prompt-stack-v1';
import { createSkillMainlinePorts, createSkillMainlineRuntime } from '../../engine/runtime-core';
import { createQueryLoopSkillPromptState, projectSkillPromptNextRoundInput } from '../../engine/query-loop';
import type { SkillDefinition } from '../../engine/skills-types-v1';

function mkSkill(id: string, trigger: string): SkillDefinition {
  return {
    skillId: id,
    metadata: {
      name: id,
      description: `${id} desc`,
      version: '1.0.0',
      owner: 'duxu',
      tags: ['analysis'],
    },
    input: { requiredFields: ['taskText'], optionalFields: [], schemaHint: 'simple' },
    output: { outputFields: ['result'], qualitySignals: ['ok'], failureSignals: ['err'] },
    triggers: [{ id: `${id}-trigger`, type: 'keyword', expression: trigger, weight: 1 }],
    constraints: [],
  };
}

describe('V10-3 skills mainline harness', () => {
  test('skills/prompt stack enters mainline ports and affects next round', () => {
    const registry = new SkillRegistry();
    registry.register(mkSkill('analysis-skill', 'analyze'), 100);

    const selection = selectSkills(registry, {
      context: { taskId: 'harness-task', taskText: 'analyze module', runtimeStateHints: [], sessionHints: [] },
      requestedTags: ['analysis'],
      policy: { mode: 'single-best', maxSkills: 1, conflictPolicy: 'prefer-higher-priority' },
    });

    let stack = createPromptStack();
    stack = addPromptFragment(stack, { fragmentId: 'sys-1', layer: 'system', text: 'system baseline', priority: 5, source: 'base' });
    stack = addPromptFragment(stack, { fragmentId: 'skill-1', layer: 'skill', text: 'invoke analysis skill', priority: 4, source: 'skill' });

    const prompt = resolvePromptPlan(stack);
    const plan = buildInvocationPlan({
      selected: selection,
      bindings: [bindSkillToPromptLayers('analysis-skill', [{ layer: 'skill', fragmentId: 'skill-1' }])],
      promptStackId: stack.stackId,
    });

    const ports = createSkillMainlinePorts();
    const runtime = createSkillMainlineRuntime();

    const q0 = createQueryLoopSkillPromptState('harness-task');
    const q1 = ports.consumeQueryLoopSkillPrompt(q0, { skillPlan: plan, promptResolution: prompt });
    const next = projectSkillPromptNextRoundInput(q1);

    const coordinatorOut = ports.consumeCoordinatorSkillResolution({
      taskId: 'harness-task',
      selectedSkillIds: plan.executionOrder,
      resolutionTrace: { reasons: plan.trace.reasons, discardedSkillIds: plan.trace.discardedSkillIds },
    });

    const session0 = runtime.createSkillPromptSessionState('harness-task');
    const session1 = ports.persistSkillPromptSession(session0, {
      planId: plan.planId,
      selectedSkillIds: plan.executionOrder,
      promptStackId: prompt.stackId,
      finalPrompt: prompt.finalPrompt,
      selectedFragments: prompt.trace.selectedFragmentIds,
      reasons: plan.trace.reasons,
      discardedSkillIds: plan.trace.discardedSkillIds,
    });

    const recoveryOut = ports.buildSkillPromptRecovery({
      skillFailures: [],
      skillConflicts: [],
      promptConflicts: [],
    });

    expect(next.hasSkillPlan).toBe(true);
    expect(next.promptInjected).toBe(true);
    expect(coordinatorOut.consumeByDecision.skillCount).toBe(1);
    expect(session1.invocation.selectedSkillIds[0]).toBe('analysis-skill');
    expect(recoveryOut.action).toBe('continue');
  });
});
