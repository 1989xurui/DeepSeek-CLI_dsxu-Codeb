/**
 * R5-30 Property-based test — G4 蒸馏校验器
 * 用法: bun run scripts/distill/g4-check-r30.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const mod = await import(resolve(ROOT, 'src/services/pbt'));
  const { suggestProperties, runPbt, generatePropertyTest, inferTemplates } = mod;
  let passed = 0, failed = 0;

  function check(id: string, ok: boolean, msg = '') {
    if (ok) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  // inferTemplates
  const t1 = inferTemplates('parseJSON', 'function parseJSON(s) { return JSON.parse(s); }');
  check('infer-01', t1.includes('idempotent'), `parseJSON should suggest idempotent, got ${t1}`);

  const t2 = inferTemplates('encodeBase64', 'function encodeBase64(s) { return btoa(s); }');
  check('infer-02', t2.includes('invertible'), `encode should suggest invertible, got ${t2}`);

  const t3 = inferTemplates('sortArray', 'function sortArray(arr) { return arr.sort(); }');
  check('infer-03', t3.includes('monotonic'), `sort should suggest monotonic, got ${t3}`);

  const t4 = inferTemplates('insertItem', 'function insertItem(arr, x) { return [...arr, x]; }');
  check('infer-04', t4.includes('invariant'), `insert should suggest invariant, got ${t4}`);

  const t5 = inferTemplates('addNumbers', 'function addNumbers(a, b) { return a + b; }');
  check('infer-05', t5.includes('commutative'), `add should suggest commutative, got ${t5}`);

  // generatePropertyTest
  const code1 = generatePropertyTest('parseJSON', 'idempotent', './parser');
  check('gen-01', code1.includes('idempotent'), 'should contain idempotent');
  check('gen-02', code1.includes('parseJSON'), 'should contain function name');
  check('gen-03', code1.includes('import'), 'should contain import');

  const code2 = generatePropertyTest('addNumbers', 'commutative', './math');
  check('gen-04', code2.includes('commutative'), 'should contain commutative');

  // suggestProperties
  const suggestions = await suggestProperties('test.ts', {
    mockSourceReader: async () => `
export function parseInput(s: string) {
  return JSON.parse(s);
}

export function addValues(a: number, b: number) {
  return a + b;
}

export function logMessage(msg: string) {
  console.log(msg);
}
`,
    mockPurityCheck: (name, source) => {
      // logMessage is impure
      return name !== 'logMessage';
    },
  });

  check('suggest-01', suggestions.length >= 1, `should suggest >=1, got ${suggestions.length}`);
  check('suggest-02', suggestions.every(s => s.functionName !== 'logMessage'), 'impure functions should be excluded');
  check('suggest-03', suggestions.every(s => s.confidence > 0 && s.confidence <= 1), 'confidence in (0,1]');
  check('suggest-04', suggestions.every(s => s.generatedCode.length > 0), 'should have generated code');

  // runPbt with mock
  const result = await runPbt('test code', {
    mockRunner: async (code, runs) => ({
      passed: true,
      runs,
      shrinkSteps: 0,
    }),
  });
  check('run-01', result.passed, 'mock run should pass');
  check('run-02', result.runs === 100, `default runs should be 100, got ${result.runs}`);

  // runPbt with counterexample
  const result2 = await runPbt('buggy test', {
    runs: 50,
    mockRunner: async (code, runs) => ({
      passed: false,
      runs,
      counterexample: { input: [0, -1], output: NaN },
      shrinkSteps: 12,
    }),
  });
  check('run-03', !result2.passed, 'should detect bug');
  check('run-04', result2.counterexample !== undefined, 'should have counterexample');
  check('run-05', result2.shrinkSteps === 12, `shrinkSteps should be 12, got ${result2.shrinkSteps}`);

  console.log(`\n  R5-30 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
main();
