/**
 * R5-28 SWE-bench runner — G4 蒸馏校验器
 *
 * 用法: bun run scripts/distill/g4-check-r28.ts
 *
 * 测试: loadSubset, runTask, runBatch, generateReport, generateDetailedReport
 * 全部通过 mock 注入，不需要真实 Python / 网络。
 */

import { resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..', '..');

function resolvePath(rel: string) {
  return resolve(ROOT, rel);
}

// ── 动态导入 ──────────────────────────────
async function loadModule() {
  return await import(resolvePath('src/services/eval/swe-bench'));
}

// ── 比较工具 ──────────────────────────────
function deepCompare(actual: any, expected: any, path = ''): string[] {
  const errors: string[] = [];

  if (expected === null || expected === undefined) {
    if (actual !== expected) errors.push(`${path}: expected ${expected}, got ${actual}`);
    return errors;
  }

  if (typeof expected === 'string') {
    if (expected.startsWith('_gte:')) {
      const threshold = parseFloat(expected.slice(5));
      if (typeof actual !== 'number' || actual < threshold) {
        errors.push(`${path}: expected >= ${threshold}, got ${actual}`);
      }
      return errors;
    }
    if (expected.startsWith('_lte:')) {
      const threshold = parseFloat(expected.slice(5));
      if (typeof actual !== 'number' || actual > threshold) {
        errors.push(`${path}: expected <= ${threshold}, got ${actual}`);
      }
      return errors;
    }
  }

  if (typeof expected === 'object' && expected !== null) {
    if ('_length' in expected) {
      if (!Array.isArray(actual) || actual.length !== expected._length) {
        errors.push(`${path}._length: expected ${expected._length}, got ${Array.isArray(actual) ? actual.length : 'not array'}`);
      }
    }
    for (const key of Object.keys(expected)) {
      if (key === '_length') continue;

      // 支持点号路径 "0.testsPassed", "byDifficulty.easy.passed"
      const parts = key.split('.');
      let target = actual;
      for (const p of parts) {
        target = target?.[p];
      }

      if (typeof expected[key] === 'object' && expected[key] !== null && !('_length' in expected[key])) {
        errors.push(...deepCompare(target, expected[key], `${path}.${key}`));
      } else if (typeof expected[key] === 'string' && (expected[key].startsWith('_gte:') || expected[key].startsWith('_lte:'))) {
        errors.push(...deepCompare(target, expected[key], `${path}.${key}`));
      } else {
        if (target !== expected[key]) {
          errors.push(`${path}.${key}: expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(target)}`);
        }
      }
    }
    return errors;
  }

  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || Math.abs(actual - expected) > 0.01) {
      errors.push(`${path}: expected ${expected}, got ${actual}`);
    }
    return errors;
  }

  if (actual !== expected) {
    errors.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  return errors;
}

// ── Mock 工厂 ──────────────────────────────
function createMockTask(id: string, difficulty: 'easy' | 'medium' | 'hard' = 'easy') {
  return {
    id,
    repo: `test/${id}`,
    baseCommit: 'abc123',
    problemStatement: `Fix bug in ${id}`,
    difficulty,
    languages: ['python'] as string[],
    multiFile: false,
    testPatch: '',
  };
}

function createMockResult(taskId: string, passed: boolean, opts: Partial<any> = {}) {
  return {
    taskId,
    generatedPatch: 'mock patch',
    testsPassed: passed,
    passedTests: passed ? (opts.totalTests ?? 5) : (opts.passedTests ?? 0),
    totalTests: opts.totalTests ?? 5,
    durationMs: opts.durationMs ?? 1000,
    ...(opts.error ? { error: opts.error } : {}),
  };
}

// ── 测试 ──────────────────────────────────
type TestCase = {
  id: string;
  fn: string;
  run: () => Promise<{ actual: any; expected: any }>;
};

async function main() {
  const mod = await loadModule();
  const tests: TestCase[] = [];

  // ── loadSubset 测试 ──
  tests.push({
    id: 'load-01',
    fn: 'loadSubset',
    run: async () => {
      const mockTasks = [createMockTask('t1'), createMockTask('t2'), createMockTask('t3')];
      const result = await mod.loadSubset('fake/path.json', {
        mockTaskLoader: async () => mockTasks,
      });
      return { actual: result, expected: { _length: 3 } };
    },
  });

  tests.push({
    id: 'load-02',
    fn: 'loadSubset',
    run: async () => {
      const result = await mod.loadSubset('empty.json', {
        mockTaskLoader: async () => [],
      });
      return { actual: result, expected: { _length: 0 } };
    },
  });

  // ── runTask 测试 ──
  tests.push({
    id: 'run-01',
    fn: 'runTask',
    run: async () => {
      const task = createMockTask('django__django-11099');
      const result = await mod.runTask(task, {
        mockRunner: async (t: any) => createMockResult(t.id, true, { passedTests: 5, totalTests: 5 }),
      });
      return {
        actual: result,
        expected: { taskId: 'django__django-11099', testsPassed: true, passedTests: 5, totalTests: 5 },
      };
    },
  });

  tests.push({
    id: 'run-02',
    fn: 'runTask',
    run: async () => {
      const task = createMockTask('sklearn-12345', 'hard');
      const result = await mod.runTask(task, {
        mockRunner: async (t: any) => createMockResult(t.id, false, { error: 'patch failed' }),
      });
      return {
        actual: result,
        expected: { taskId: 'sklearn-12345', testsPassed: false, error: 'patch failed' },
      };
    },
  });

  tests.push({
    id: 'run-03',
    fn: 'runTask',
    run: async () => {
      const task = createMockTask('flask-999', 'medium');
      const result = await mod.runTask(task, {
        mockRunner: async (t: any) => createMockResult(t.id, true, { durationMs: 1500 }),
      });
      return {
        actual: result,
        expected: { taskId: 'flask-999', testsPassed: true, durationMs: 1500 },
      };
    },
  });

  // ── runBatch 测试 ──
  tests.push({
    id: 'batch-01',
    fn: 'runBatch',
    run: async () => {
      const tasks = [
        createMockTask('t1', 'easy'),
        createMockTask('t2', 'medium'),
        createMockTask('t3', 'hard'),
      ];
      const passMap: Record<string, boolean> = { t1: true, t2: true, t3: false };
      const result = await mod.runBatch(tasks, {
        mockRunner: async (t: any) => createMockResult(t.id, passMap[t.id] ?? false),
      });
      return {
        actual: result,
        expected: { _length: 3, '0.testsPassed': true, '1.testsPassed': true, '2.testsPassed': false },
      };
    },
  });

  tests.push({
    id: 'batch-02',
    fn: 'runBatch',
    run: async () => {
      const result = await mod.runBatch([], {});
      return { actual: result, expected: { _length: 0 } };
    },
  });

  // ── generateReport 测试 ──
  tests.push({
    id: 'report-01',
    fn: 'generateReport',
    run: async () => {
      const results = [
        createMockResult('t1', true, { durationMs: 1000 }),
        createMockResult('t2', true, { durationMs: 2000 }),
        createMockResult('t3', false, { durationMs: 3000 }),
      ];
      const report = mod.generateReport(results);
      return {
        actual: report,
        expected: { totalTasks: 3, passedTasks: 2, passAt1: '_gte:0.6', totalDurationMs: 6000 },
      };
    },
  });

  tests.push({
    id: 'report-02',
    fn: 'generateReport',
    run: async () => {
      const report = mod.generateReport([]);
      return {
        actual: report,
        expected: { totalTasks: 0, passedTasks: 0, passAt1: 0 },
      };
    },
  });

  // ── generateDetailedReport 测试 ──
  tests.push({
    id: 'detail-01',
    fn: 'generateDetailedReport',
    run: async () => {
      const tasks = [
        { ...createMockTask('t1', 'easy'), languages: ['python'] },
        { ...createMockTask('t2', 'medium'), languages: ['python', 'javascript'] },
        { ...createMockTask('t3', 'hard'), languages: ['python'] },
      ];
      const results = [
        createMockResult('t1', true, { durationMs: 1000 }),
        createMockResult('t2', true, { durationMs: 2000 }),
        createMockResult('t3', false, { durationMs: 3000 }),
      ];
      const report = mod.generateDetailedReport(tasks, results);
      return {
        actual: report,
        expected: {
          totalTasks: 3,
          passedTasks: 2,
          'passAt1': '_gte:0.6',
          'byDifficulty.easy.passed': 1,
          'byDifficulty.medium.passed': 1,
          'byDifficulty.hard.passed': 0,
          'byLanguage.python.total': 3,
          'byLanguage.javascript.total': 1,
        },
      };
    },
  });

  tests.push({
    id: 'detail-02',
    fn: 'generateDetailedReport',
    run: async () => {
      const report = mod.generateDetailedReport([], []);
      return {
        actual: report,
        expected: { totalTasks: 0, passedTasks: 0, passAt1: 0 },
      };
    },
  });

  // ── 运行所有测试 ──
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const { actual, expected } = await test.run();
      const errors = deepCompare(actual, expected, test.id);

      if (errors.length === 0) {
        console.log(`  ✅ ${test.id} (${test.fn})`);
        passed++;
      } else {
        console.log(`  ❌ ${test.id} (${test.fn})`);
        for (const e of errors) console.log(`     ${e}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ ${test.id} (${test.fn}) — THREW: ${err}`);
      failed++;
    }
  }

  console.log(`\n  R5-28 G4: ${passed}/${passed + failed} passed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
