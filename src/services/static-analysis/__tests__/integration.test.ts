/**
 * Static analysis integration tests
 */

import { StaticAnalysisBridge } from '../bridge';
import { runStaticGate } from '../index';

describe('Static Analysis Integration', () => {
  let bridge: StaticAnalysisBridge;

  beforeEach(() => {
    bridge = new StaticAnalysisBridge({
      enabled: true,
      failOnCritical: true,
      maxCriticalIssues: 0,
      gateOptions: {
        maxDurationMs: 2000,
        shortCircuitOnError: true,
        mockSpawn: async () => ({
          exitCode: 0,
          stdout: '',
          stderr: '',
          durationMs: 10,
        }),
      },
    });
  });

  test('runStaticGate should return expected shape', async () => {
    const result = await runStaticGate(['test.ts'], {
      mockSpawn: async () => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 100,
      }),
    });

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('totalIssues');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('layers');
    expect(result.layers).toHaveProperty('astGrep');
    expect(result.layers).toHaveProperty('tsc');
    expect(result.layers).toHaveProperty('eslint');
  });

  test('bridge should integrate runStaticGate', async () => {
    const patchInfo = {
      filePaths: ['test.ts'],
      patchContent: 'test',
    };

    const result = await bridge.analyzeAfterPatch(patchInfo);

    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('criticPrompt');
    expect(result).toHaveProperty('shouldBlock');
    expect(typeof result.criticPrompt).toBe('string');
  });

  test('shouldScan should filter files', async () => {
    const { shouldScan } = await import('../index');

    expect(shouldScan('src/test.ts')).toBe(true);
    expect(shouldScan('src/test.js')).toBe(true);
    expect(shouldScan('src/test.tsx')).toBe(true);
    expect(shouldScan('src/test.jsx')).toBe(true);

    expect(shouldScan('node_modules/package/index.js')).toBe(false);
    expect(shouldScan('dist/bundle.js')).toBe(false);
    expect(shouldScan('.dsxu/config.ts')).toBe(false);
    expect(shouldScan('__tests__/test.test.ts')).toBe(false);
  });
});
