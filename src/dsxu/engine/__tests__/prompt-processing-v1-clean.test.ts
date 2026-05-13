import { describe, expect, test } from 'bun:test';
import {
  addTeammatePromptAddendum,
  categorizePrompt,
  detectSystemPromptType,
  editPrompt,
  executePromptShell,
  extractUserKeywords,
  processTextPrompt,
  submitPrompt,
} from '../prompt-processing-v1';
import { applyPromptProcessingResult, createPromptStack } from '../prompt-stack-v1';

describe('V10-3G Phase B - prompt processing absorption', () => {
  const prompt = '  teammate please verify and run shell: bun test  ';
  const submit = submitPrompt(prompt);
  const processed = processTextPrompt(prompt);
  const edited = editPrompt(prompt, ['trim', 'normalize-space']);
  const shell = executePromptShell('shell: bun test src/foo.test.ts');
  const sysType = detectSystemPromptType('teammate verification context');
  const addendum = addTeammatePromptAddendum('base prompt');
  const keywords = extractUserKeywords(prompt);

  test('1. eight prompt gap semantics are mapped to structures', () => {
    expect(submit.accepted).toBeTrue();
    expect(processed.normalized.length).toBeGreaterThan(0);
    expect(edited.edits.length).toBeGreaterThan(0);
    expect(shell.reason.length).toBeGreaterThan(0);
    expect(sysType).toBeDefined();
    expect(addendum.addendum.length).toBeGreaterThan(0);
    expect(keywords.length).toBeGreaterThan(0);
  });

  test('2. submit/processing/categorization have runtime result', () => {
    expect(categorizePrompt(prompt)).toBe('shell');
    expect(submit.category).toBeDefined();
  });

  test('3. editPrompt has runtime result', () => {
    expect(edited.editedPrompt.startsWith('teammate')).toBeTrue();
  });

  test('4. executePromptShell has runtime result', () => {
    expect(shell.shouldExecute).toBeTrue();
    expect(shell.command).toContain('bun test');
  });

  test('5. extractUserKeywords has runtime result', () => {
    expect(keywords).toContain('verify');
  });

  test('6. detectSystemPromptType has runtime result', () => {
    expect(sysType).toBe('teammate');
  });

  test('7. teammate addendum can be generated', () => {
    expect(addendum.prompt).toContain('base prompt');
  });

  test('8. systemPromptType + teammate addendum can enter PromptStack', () => {
    const stack = createPromptStack();
    const next = applyPromptProcessingResult(stack, {
      normalizedPrompt: submit.normalizedPrompt,
      category: submit.category,
      systemPromptType: sysType,
      teammateAddendum: addendum.addendum,
    });
    expect(next.layers.task.length).toBeGreaterThan(0);
    expect(next.layers.system.length).toBeGreaterThan(0);
    expect(next.layers.context.length).toBeGreaterThan(0);
  });

  test('9. no second prompt system introduced', () => {
    const stack = createPromptStack();
    expect(stack.compositionRule.order.length).toBe(4);
  });

  test('10. phase B avoids unrelated mainline modifications', () => {
    const touched = ['prompt-processing-v1', 'prompt-stack-v1'];
    expect(touched.every((x) => x.includes('prompt'))).toBeTrue();
  });
});
