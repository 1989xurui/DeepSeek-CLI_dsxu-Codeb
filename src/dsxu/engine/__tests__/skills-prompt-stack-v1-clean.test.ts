import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { SkillDefinition } from '../skills-types-v1';
import { SkillRegistry, buildInvocationPlan, resolvePromptPlan, selectSkills } from '../skills-registry-v1';
import { addPromptFragment, bindSkillToPromptLayers, createPromptStack } from '../prompt-stack-v1';

function mkSkill(input: {
  id: string;
  name: string;
  tags: Array<'code-edit' | 'analysis' | 'test' | 'recovery'>;
  trigger: string;
  singleWriter?: boolean;
}): SkillDefinition {
  return {
    skillId: input.id,
    metadata: {
      name: input.name,
      description: `${input.name} description`,
      version: '1.0.0',
      owner: 'duxu',
      tags: input.tags,
    },
    input: { requiredFields: ['taskText'], optionalFields: ['context'], schemaHint: 'simple' },
    output: { outputFields: ['result'], qualitySignals: ['stable'], failureSignals: ['error'] },
    triggers: [{ id: `${input.id}-trigger`, type: 'keyword', expression: input.trigger, weight: 1 }],
    constraints: input.singleWriter ? [{ id: `${input.id}-sw`, type: 'single-writer', description: 'single writer' }] : [],
  };
}

describe('V10-3 Phase A skills/prompt stack skeleton clean checks', () => {
  test('1) SkillDefinition / SkillRegistry can be created', () => {
    const registry = new SkillRegistry();
    const skill = mkSkill({ id: 'skill-a', name: 'SkillA', tags: ['analysis'], trigger: 'analyze' });
    const entry = registry.register(skill, 90);
    expect(entry.skill.skillId).toBe('skill-a');
  });

  test('2) multiple skills can be registered', () => {
    const registry = new SkillRegistry();
    registry.register(mkSkill({ id: 'skill-a', name: 'SkillA', tags: ['analysis'], trigger: 'analyze' }));
    registry.register(mkSkill({ id: 'skill-b', name: 'SkillB', tags: ['code-edit'], trigger: 'edit' }));
    expect(registry.list().length).toBe(2);
  });

  test('3) PromptLayer / PromptStack can be created', () => {
    const stack = createPromptStack();
    expect(stack.stackId.length).toBeGreaterThan(0);
    expect(stack.layers.system).toBeArray();
  });

  test('4) PromptStack supports four layers', () => {
    const stack = createPromptStack();
    expect(Object.keys(stack.layers).sort()).toEqual(['context', 'skill', 'system', 'task']);
  });

  test('5) SkillPromptBinding exists', () => {
    const binding = bindSkillToPromptLayers('skill-a', [
      { layer: 'skill', fragmentId: 'f-skill-1' },
      { layer: 'context', fragmentId: 'f-ctx-1' },
    ]);
    expect(binding.skillId).toBe('skill-a');
    expect(binding.requiredLayers.includes('skill')).toBe(true);
  });

  test('6) SkillInvocationPlan can be generated', () => {
    const registry = new SkillRegistry();
    registry.register(mkSkill({ id: 'skill-a', name: 'SkillA', tags: ['analysis'], trigger: 'analyze' }), 100);

    const selected = selectSkills(registry, {
      context: { taskId: 't-1', taskText: 'please analyze', runtimeStateHints: [], sessionHints: [] },
      requestedTags: ['analysis'],
      policy: { mode: 'single-best', maxSkills: 1, conflictPolicy: 'prefer-higher-priority' },
    });

    const plan = buildInvocationPlan({
      selected,
      bindings: [bindSkillToPromptLayers('skill-a', [{ layer: 'skill', fragmentId: 'frag-a' }])],
      promptStackId: 'stack-1',
    });

    expect(plan.selectedSkills.length).toBe(1);
    expect(plan.executionOrder[0]).toBe('skill-a');
  });

  test('7) PromptConflictPolicy is structured', () => {
    const stack = createPromptStack({ conflictPolicy: { mode: 'merge', preserveTrace: true } });
    expect(stack.conflictPolicy.mode).toBe('merge');
    expect(stack.conflictPolicy.preserveTrace).toBe(true);
  });

  test('8) SkillResolutionTrace can be recorded', () => {
    const registry = new SkillRegistry();
    registry.register(mkSkill({ id: 'skill-a', name: 'SkillA', tags: ['analysis'], trigger: 'analyze' }), 100);
    const selected = selectSkills(registry, {
      context: { taskId: 't-2', taskText: 'analyze now', runtimeStateHints: [], sessionHints: [] },
      requestedTags: ['analysis'],
      policy: { mode: 'single-best', maxSkills: 1, conflictPolicy: 'prefer-higher-priority' },
    });
    const plan = buildInvocationPlan({ selected, bindings: [], promptStackId: 'stack-2' });
    expect(plan.trace.selectedSkillIds).toEqual(['skill-a']);
  });

  test('9) objects are runtime-serializable', () => {
    const registry = new SkillRegistry();
    registry.register(mkSkill({ id: 'skill-a', name: 'SkillA', tags: ['analysis'], trigger: 'analyze' }), 100);

    let stack = createPromptStack();
    stack = addPromptFragment(stack, {
      fragmentId: 'sys-1',
      layer: 'system',
      text: 'system base',
      priority: 5,
      source: 'base',
    });

    const selected = selectSkills(registry, {
      context: { taskId: 't-3', taskText: 'analyze this', runtimeStateHints: [], sessionHints: [] },
      requestedTags: ['analysis'],
      policy: { mode: 'single-best', maxSkills: 1, conflictPolicy: 'prefer-higher-priority' },
    });
    const prompt = resolvePromptPlan(stack);
    const plan = buildInvocationPlan({ selected, bindings: [], promptStackId: stack.stackId });

    expect(JSON.parse(JSON.stringify({ stack, prompt, plan }))).toBeDefined();
  });

  test('10) no mainline module dependency required for skeleton', async () => {
    const text = await Bun.file(join(process.cwd(), 'src/dsxu/engine/skills-registry-v1.ts')).text();
    expect(text.includes("from './query-loop'")).toBe(false);
    expect(text.includes("from './runtime-core'")).toBe(false);
  });
});
