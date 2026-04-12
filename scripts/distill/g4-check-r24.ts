/**
 * R5-24 弱 mutation testing — G4 蒸馏校验器
 *
 * 用法: bun run scripts/distill/g4-check-r24.ts
 */

import { resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const mod = await import(resolve(ROOT, 'src/services/mutation'));
  const { generateMutations, runMutationTests, resetIdCounter } = mod;

  let passed = 0;
  let failed = 0;

  function check(id: string, condition: boolean, msg: string) {
    if (condition) { console.log(`  ✅ ${id}`); passed++; }
    else { console.log(`  ❌ ${id}: ${msg}`); failed++; }
  }

  // ── generateMutations 测试 ──

  resetIdCounter();
  const source1 = `function add(a, b) {
  if (a === 0) return b;
  return a + b;
}`;

  const muts1 = generateMutations(source1, 'test.ts');
  check('gen-01', muts1.length > 0, `expected >0 mutations, got ${muts1.length}`);
  check('gen-02', muts1.some(m => m.operator === 'M01'), 'expected M01 (arithmetic) mutation');
  check('gen-03', muts1.some(m => m.operator === 'M02'), 'expected M02 (relational) mutation');
  check('gen-04', muts1.some(m => m.operator === 'M06'), 'expected M06 (return delete) mutation');

  // 禁用操作符
  resetIdCounter();
  const muts2 = generateMutations(source1, 'test.ts', ['M01', 'M02']);
  check('gen-05', !muts2.some(m => m.operator === 'M01'), 'M01 should be disabled');
  check('gen-06', !muts2.some(m => m.operator === 'M02'), 'M02 should be disabled');

  // ── M05 常量替换 ──
  resetIdCounter();
  const source2 = `const flag = true;\nconst count = 0;`;
  const muts3 = generateMutations(source2, 'test.ts', ['M10']); // disable M10 to not conflict
  check('gen-07', muts3.some(m => m.operator === 'M05' && m.after.includes('false')), 'M05 should replace true→false');

  // ── M07 条件取反 ──
  resetIdCounter();
  const source3 = `if (x > 0) { doSomething(); }`;
  const muts4 = generateMutations(source3, 'test.ts');
  check('gen-08', muts4.some(m => m.operator === 'M07' && m.after.includes('!(')), 'M07 should negate condition');

  // ── runMutationTests 测试 ──

  // 完美测试 → killRate 100%
  const report1 = await runMutationTests(
    source1, 'test.ts',
    { maxMutations: 10 },
    {
      mockTestRunner: async () => ({ passed: false, output: 'test failed as expected' }),
    }
  );
  check('run-01', report1.killRate === 1.0, `expected killRate=1.0, got ${report1.killRate}`);
  check('run-02', report1.survived === 0, `expected 0 survivors, got ${report1.survived}`);

  // 无效测试 → killRate 0%
  const report2 = await runMutationTests(
    source1, 'test.ts',
    { maxMutations: 10 },
    {
      mockTestRunner: async () => ({ passed: true, output: 'all tests passed' }),
    }
  );
  check('run-03', report2.killRate === 0, `expected killRate=0, got ${report2.killRate}`);
  check('run-04', report2.survivors.length === report2.total, `all should survive`);

  // 混合结果
  let callCount = 0;
  const report3 = await runMutationTests(
    source1, 'test.ts',
    { maxMutations: 6 },
    {
      mockTestRunner: async () => {
        callCount++;
        return { passed: callCount % 2 === 0, output: '' };
      },
    }
  );
  check('run-05', report3.killed > 0 && report3.survived > 0, 'mixed results expected');
  check('run-06', Math.abs(report3.killRate - report3.killed / report3.total) < 0.01, 'killRate calculation');

  // Budget 限制
  const report4 = await runMutationTests(
    source1, 'test.ts',
    { maxMutations: 2 },
    {
      mockTestRunner: async () => ({ passed: false, output: '' }),
    }
  );
  check('run-07', report4.total <= 2, `maxMutations=2, got ${report4.total}`);

  // Mock mutation generator
  const report5 = await runMutationTests(
    'any source', 'test.ts',
    {},
    {
      mockMutationGenerator: () => [
        { id: 'custom-1', operator: 'M01', file: 'test.ts', line: 1, before: 'a+b', after: 'a-b' },
        { id: 'custom-2', operator: 'M05', file: 'test.ts', line: 2, before: 'true', after: 'false' },
      ],
      mockTestRunner: async (_f, m) => ({ passed: m.id === 'custom-2', output: '' }),
    }
  );
  check('run-08', report5.total === 2, `expected 2 mutations from mock generator`);
  check('run-09', report5.killed === 1 && report5.survived === 1, 'custom-1 killed, custom-2 survived');

  console.log(`\n  R5-24 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
