/**
 * R5-31 IDE LSP — G4 checker
 * bun run scripts/distill/g4-check-r31.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const { handleRequest } = await import(resolve(ROOT, 'src/services/lsp'));
  let p = 0, f = 0;
  const ck = (id: string, ok: boolean, m = '') => { if (ok) { console.log(`  ✅ ${id}`); p++; } else { console.log(`  ❌ ${id}: ${m}`); f++; } };

  // hover
  const r1 = await handleRequest({ method: 'hover', params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 10, character: 5 } } });
  ck('hover-01', r1.result?.contents?.value?.includes('10'), `hover should reference line`);
  ck('hover-02', r1.durationMs >= 0, 'duration >= 0');

  // completion
  const r2 = await handleRequest({ method: 'completion', params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 5, character: 10 } } });
  ck('comp-01', r2.result?.items?.length >= 1, 'should have completions');

  // codeAction
  const r3 = await handleRequest({ method: 'codeAction', params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 1, character: 0 } } });
  ck('action-01', Array.isArray(r3.result) && r3.result.length >= 1, 'should have code actions');

  // diagnostics
  const r4 = await handleRequest({ method: 'diagnostics', params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 0, character: 0 } } });
  ck('diag-01', r4.result?.uri === 'file:///test.ts', 'should return uri');

  // mock handler
  const r5 = await handleRequest(
    { method: 'hover', params: { textDocument: { uri: 'x' }, position: { line: 0, character: 0 } } },
    { mockHandler: async () => ({ custom: true }) }
  );
  ck('mock-01', r5.result?.custom === true, 'mock handler should work');

  // references
  const r6 = await handleRequest({ method: 'references', params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 0, character: 0 } } });
  ck('ref-01', Array.isArray(r6.result), 'references should be array');

  // definition
  const r7 = await handleRequest({ method: 'definition', params: { textDocument: { uri: 'file:///test.ts' }, position: { line: 0, character: 0 } } });
  ck('def-01', r7.result?.uri === 'file:///test.ts', 'definition should return uri');

  console.log(`\n  R5-31 G4: ${p}/${p + f} passed\n`);
  process.exit(f > 0 ? 1 : 0);
}
main();
