import { describe, expect, test } from 'bun:test';
import { handlePromptSubmit } from '../prompt-processing-v1';
import { applyPromptProcessingResult, createPromptStack } from '../prompt-stack-v1';
import { buildSystemPrompt, renderSystemPromptText } from '../system-prompt-builder-v1';
import { consumeSkillPromptInQueryLoop, createQueryLoopSkillPromptState, projectSkillPromptNextRoundInput } from '../query-loop';
import { applySkillPromptToSession, createSkillPromptSessionState } from '../session';
import { createSkillMainlineRuntime } from '../runtime-core';

describe('C02 prompt-stack mainline clean', () => {
  test('1. prompt submit -> prompt stack layering is runtime-executable', () => {
    const submit = handlePromptSubmit({ prompt: 'teammate please verify and edit this patch' });
    expect(submit.accepted).toBeTrue();

    const stack = createPromptStack();
    const next = applyPromptProcessingResult(stack, {
      normalizedPrompt: submit.normalizedPrompt,
      category: submit.category,
      systemPromptType: 'teammate',
      teammateAddendum: 'teammate addendum',
    });

    expect(next.layers.task.length).toBeGreaterThan(0);
    expect(next.layers.system.length).toBeGreaterThan(0);
    expect(next.layers.context.length).toBeGreaterThan(0);
  });

  test('2. system prompt stack merge keeps context semantics', () => {
    const prompt = buildSystemPrompt({
      defaultSystemPrompt: ['base-policy'],
      userContext: { intent: 'verify' },
      systemContext: { mode: 'mainline' },
      appendSystemPrompt: 'append:constraints',
    });
    expect(prompt.some((x) => x.includes('user-context.intent'))).toBeTrue();
    expect(prompt.some((x) => x.includes('system-context.mode'))).toBeTrue();

    const text = renderSystemPromptText({
      defaultSystemPrompt: ['base-policy'],
      userContext: { intent: 'verify' },
      systemContext: { mode: 'mainline' },
    });
    expect(text).toContain('base-policy');
  });

  test('3. query-loop consumes skill/prompt outputs as mainline state', () => {
    const q0 = createQueryLoopSkillPromptState('c02-task');
    const q1 = consumeSkillPromptInQueryLoop(q0, {
      skillPlan: {
        planId: 'plan-c02',
        executionOrder: ['verify', 'simplify'],
        trace: { selectedSkillIds: ['verify', 'simplify'], reasons: ['policy'] },
      },
      promptResolution: {
        stackId: 'stack-c02',
        finalPrompt: 'system\n\ntask\n\ncontext',
        trace: { selectedFragmentIds: ['f1', 'f2'], reasons: ['priority'] },
      },
    });
    const projected = projectSkillPromptNextRoundInput(q1);
    expect(projected.hasSkillPlan).toBeTrue();
    expect(projected.promptInjected).toBeTrue();
    expect(projected.selectedSkillIds).toEqual(['verify', 'simplify']);
  });

  test('4. session persists prompt-stack lifecycle snapshot', () => {
    const s0 = createSkillPromptSessionState('c02-task');
    const s1 = applySkillPromptToSession(s0, {
      planId: 'plan-c02',
      selectedSkillIds: ['verify'],
      promptStackId: 'stack-c02',
      finalPrompt: 'final prompt content',
      selectedFragments: ['frag-system', 'frag-task'],
      reasons: ['priority'],
      discardedSkillIds: ['debug'],
    });
    expect(s1.invocation.status).toBe('running');
    expect(s1.promptSnapshot.stackId).toBe('stack-c02');
    expect(s1.resolutionTrace.discardedSkillIds).toEqual(['debug']);
  });

  test('5. runtime-core exposes official single mainline entry for prompt flow', () => {
    const runtime = createSkillMainlineRuntime();
    expect(typeof runtime.ports.consumeQueryLoopSkillPrompt).toBe('function');
    expect(typeof runtime.ports.persistSkillPromptSession).toBe('function');
    expect(typeof runtime.createQueryLoopSkillPromptState).toBe('function');
    expect(typeof runtime.createSkillPromptSessionState).toBe('function');
  });
});
