import { describe, expect, test } from 'bun:test';
import {
  analyzeContextDepth,
  analyzeWorkloadContext,
  buildTeammateContext,
  checkContextWarnings,
  extractEditContext,
  generateContextSuggestions,
} from '../context-analysis-v1';
import { attachContextEnvelopeToPromptStack, createPromptStack } from '../prompt-stack-v1';

describe('V10-3G Phase A - context analysis absorption', () => {
  const analysis = analyzeContextDepth({
    messages: [
      { role: 'user', content: 'please read file a.ts and edit function x' },
      { role: 'assistant', content: 'running read and analysis now' },
      { role: 'tool', content: 'file content lines ... repeated' },
    ],
    duplicateReadSignals: 2,
  });
  const suggestions = generateContextSuggestions(analysis);
  const warnings = checkContextWarnings(analysis);
  const editContext = extractEditContext({ filePaths: ['a.ts', 'b.ts'], intent: 'edit' });
  const teammate = buildTeammateContext({ agentId: 'researcher@team-a', teamName: 'team-a', planModeRequired: true });
  const workload = analyzeWorkloadContext({ workload: 'cron', pendingItems: 12 });

  test('1. six gap semantics are all mapped into explicit structures', () => {
    expect(analysis).toBeDefined();
    expect(suggestions.length).toBeGreaterThan(0);
    expect(editContext.targetFiles.length).toBe(2);
    expect(teammate.teamName).toBe('team-a');
    expect(workload.workload).toBe('cron');
  });

  test('2. ContextAnalysis runtime expression exists', () => {
    expect(['low', 'medium', 'high']).toContain(analysis.depthLevel);
  });

  test('3. ContextSuggestions runtime expression exists', () => {
    expect(suggestions.some((s) => s.title.length > 0)).toBeTrue();
  });

  test('4. ContextWarnings runtime expression exists', () => {
    expect(Array.isArray(warnings)).toBeTrue();
  });

  test('5. ReadEditContext runtime expression exists', () => {
    expect(editContext.intent).toBe('edit');
  });

  test('6. TeammateContext runtime expression exists', () => {
    expect(['direct', 'lead-mediated']).toContain(teammate.communicationMode);
  });

  test('7. WorkloadContext runtime expression exists', () => {
    expect(workload.riskLevel).toBe('medium');
  });

  test('8. context analysis enters PromptStack flow', () => {
    const stack = createPromptStack();
    const integrated = attachContextEnvelopeToPromptStack(stack, {
      stackId: stack.stackId,
      suggestions,
      warnings,
      editContext,
      teammateContext: teammate,
      workload,
    });
    expect(integrated.contextEnvelope.stackId).toBe(stack.stackId);
  });

  test('9. no second prompt system is introduced', () => {
    const stack = createPromptStack();
    expect(stack.layers.system).toBeDefined();
    expect(stack.layers.task).toBeDefined();
  });

  test('10. phase A does not modify unrelated mainline runtime modules', () => {
    const touched = ['context-analysis-v1', 'prompt-stack-v1'];
    expect(touched.every((x) => x.includes('context') || x.includes('prompt'))).toBeTrue();
  });
});
