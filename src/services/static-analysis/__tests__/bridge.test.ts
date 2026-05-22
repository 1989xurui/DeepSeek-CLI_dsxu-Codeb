/**
 * 静态分析桥接器测试
 */

import { StaticAnalysisBridge, createStaticAnalysisBridge } from '../bridge';
import { buildStaticAnalysisToolGatePolicy, invokeStaticAnalysisToolGate } from '../tool-gate';

describe('Static Analysis Bridge', () => {
  let bridge: StaticAnalysisBridge;
  const savedEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of [
      'DSXU_STATIC_ANALYSIS_TOOL_GATE',
      'DSXU_STATIC_ANALYSIS_TOOL_GATE_BLOCKING',
    ]) {
      savedEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    bridge = new StaticAnalysisBridge({ enabled: false });
    process.env.DSXU_STATIC_ANALYSIS_TOOL_GATE = '';
    process.env.DSXU_STATIC_ANALYSIS_TOOL_GATE_BLOCKING = '';
  });

  afterAll(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('应该使用默认配置', () => {
    const defaultBridge = new StaticAnalysisBridge();
    const options = defaultBridge.getOptions();

    expect(options.enabled).toBe(true);
    expect(options.failOnCritical).toBe(true);
    expect(options.maxCriticalIssues).toBe(0);
  });

  test('应该允许自定义配置', () => {
    const customBridge = new StaticAnalysisBridge({
      enabled: false,
      failOnCritical: false,
      maxCriticalIssues: 5,
    });

    const options = customBridge.getOptions();
    expect(options.enabled).toBe(false);
    expect(options.failOnCritical).toBe(false);
    expect(options.maxCriticalIssues).toBe(5);
  });

  test('analyzeAfterPatch 禁用时应跳过', async () => {
    const disabledBridge = new StaticAnalysisBridge({ enabled: false });
    const patchInfo = {
      filePaths: ['src/test.ts'],
      patchContent: '',
    };

    const result = await disabledBridge.analyzeAfterPatch(patchInfo);

    expect(result.shouldBlock).toBe(false);
    expect(result.criticPrompt).toContain('已禁用');
  });

  test('checkShouldBlock 应该根据错误问题数决定', () => {
    const testBridge = new StaticAnalysisBridge({ failOnCritical: true, maxCriticalIssues: 2 });

    // 模拟结果：3个错误问题（超过阈值2）
    const mockResult = {
      passed: false,
      totalIssues: 3,
      errors: 3,
      warnings: 0,
      issues: [
        { severity: 'error', source: 'tsc', file: 'a.ts', line: 1, column: 1, rule: 'TS1', message: 'error' },
        { severity: 'error', source: 'eslint', file: 'b.js', line: 2, column: 2, rule: 'no-console', message: 'error' },
        { severity: 'error', source: 'eslint', file: 'c.js', line: 3, column: 3, rule: 'eqeqeq', message: 'error' },
      ],
      durationMs: 0,
      layers: {
        astGrep: { passed: true, issues: [], durationMs: 0 },
        tsc: { passed: false, issues: [{ severity: 'error', source: 'tsc', file: 'a.ts', line: 1, column: 1, rule: 'TS1', message: 'error' }], durationMs: 0 },
        eslint: { passed: false, issues: [{ severity: 'error', source: 'eslint', file: 'b.js', line: 2, column: 2, rule: 'no-console', message: 'error' }, { severity: 'error', source: 'eslint', file: 'c.js', line: 3, column: 3, rule: 'eqeqeq', message: 'error' }], durationMs: 0 },
      },
    };

    // 使用私有方法测试（通过类型断言）
    const { shouldBlock, blockReason } = (testBridge as any).checkShouldBlock(mockResult);
    expect(shouldBlock).toBe(true);
    expect(blockReason).toContain('发现 3 个错误级别问题');
  });

  test('checkShouldBlock 不应该在 failOnCritical=false 时阻止', () => {
    const testBridge = new StaticAnalysisBridge({ failOnCritical: false });

    const mockResult = {
      passed: false,
      totalIssues: 1,
      errors: 1,
      warnings: 0,
      issues: [
        { severity: 'error', source: 'tsc', file: 'a.ts', line: 1, column: 1, rule: 'TS1', message: 'error' },
      ],
      durationMs: 0,
      layers: {
        astGrep: { passed: true, issues: [], durationMs: 0 },
        tsc: { passed: false, issues: [{ severity: 'error', source: 'tsc', file: 'a.ts', line: 1, column: 1, rule: 'TS1', message: 'error' }], durationMs: 0 },
        eslint: { passed: true, issues: [], durationMs: 0 },
      },
    };

    const { shouldBlock } = (testBridge as any).checkShouldBlock(mockResult);
    expect(shouldBlock).toBe(false);
  });

  test('checkShouldBlock 应该在关键层失败时阻止', () => {
    const testBridge = new StaticAnalysisBridge({ failOnCritical: true });

    const mockResult = {
      passed: false,
      totalIssues: 0,
      errors: 0,
      warnings: 0,
      issues: [],
      durationMs: 0,
      layers: {
        astGrep: { passed: true, issues: [], durationMs: 0 },
        tsc: { passed: false, issues: [{ severity: 'error', source: 'tsc', file: 'a.ts', line: 1, column: 1, rule: 'gate.tool-error', message: 'tsc failed' }], durationMs: 0 },
        eslint: { passed: true, issues: [], durationMs: 0 },
      },
    };

    const { shouldBlock, blockReason } = (testBridge as any).checkShouldBlock(mockResult);
    expect(shouldBlock).toBe(true);
    expect(blockReason).toContain('关键分析层失败');
  });

  test('getAnalysisSummary 应该生成正确摘要', () => {
    const mockResult = {
      passed: false,
      totalIssues: 3,
      errors: 1,
      warnings: 1,
      issues: [
        { severity: 'error', source: 'tsc', file: 'a.ts', line: 1, column: 1, rule: 'TS1', message: 'error' },
        { severity: 'warning', source: 'eslint', file: 'b.js', line: 2, column: 2, rule: 'no-console', message: 'warning' },
        { severity: 'info', source: 'eslint', file: 'c.js', line: 3, column: 3, rule: 'prefer-const', message: 'info' },
      ],
      durationMs: 1234,
      layers: {
        astGrep: { passed: true, issues: [], durationMs: 100, skipped: false },
        tsc: { passed: false, issues: [{ severity: 'error', source: 'tsc', file: 'a.ts', line: 1, column: 1, rule: 'TS1', message: 'error' }], durationMs: 800, skipped: false },
        eslint: { passed: true, issues: [{ severity: 'warning', source: 'eslint', file: 'b.js', line: 2, column: 2, rule: 'no-console', message: 'warning' }, { severity: 'info', source: 'eslint', file: 'c.js', line: 3, column: 3, rule: 'prefer-const', message: 'info' }], durationMs: 334, skipped: false },
      },
    };

    const summary = bridge.getAnalysisSummary(mockResult);
    expect(summary).toContain('astGrep: ✅');
    expect(summary).toContain('tsc: ❌');
    expect(summary).toContain('eslint: ✅');
    expect(summary).toContain('Issues: 3 (❌1 ⚠️1)');
    expect(summary).toContain('Duration: 1234ms');
  });

  test('updateOptions 应该合并配置', () => {
    bridge.updateOptions({ maxCriticalIssues: 10, failOnCritical: false });
    const options = bridge.getOptions();

    expect(options.maxCriticalIssues).toBe(10);
    expect(options.failOnCritical).toBe(false);
    // 其他选项应该保持不变
    expect(options.enabled).toBe(false);
  });

  test('createStaticAnalysisBridge 应该创建实例', () => {
    const bridge = createStaticAnalysisBridge({ enabled: false });
    expect(bridge).toBeInstanceOf(StaticAnalysisBridge);
    expect(bridge.getOptions().enabled).toBe(false);
  });

  test('tool gate defaults to a visible advisory envelope instead of silent skip', async () => {
    const result = await invokeStaticAnalysisToolGate({
      filePaths: ['src/sample.ts'],
      patchContent: 'export const sample = 1',
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.shouldBlock).toBe(false);
    expect(result.semantics).toBe('advisory-envelope');
    expect(result.policy).toMatchObject({
      enabled: true,
      runAnalysis: false,
      blocking: false,
      riskLevel: 'normal',
    });
    expect(result.error).toContain('post-mutation advisory envelope');
  });

  test('tool gate escalates provider/tool risk paths to blocking static-analysis policy by default', () => {
    const policy = buildStaticAnalysisToolGatePolicy([
      'src/services/api/deepseek-adapter.ts',
      'src/tools/FileEditTool/FileEditTool.ts',
    ]);

    expect(policy).toMatchObject({
      enabled: true,
      runAnalysis: true,
      blocking: true,
      riskLevel: 'risk-blocking',
    });
    expect(policy.matchedRule).toBe('provider-route-cost-cache');
  });

  test('tool gate blocks release claim source that keeps external parity tokens after mutation', async () => {
    const externalModel = ['G', 'PT'].join('');
    const referenceProduct = ['Cl', 'aude'].join('');
    const percentToken = ['95', '%'].join('');

    const result = await invokeStaticAnalysisToolGate({
      filePaths: ['src/claim.ts'],
      patchContent: [
        'export function buildReadmeClaim(evidence: Evidence): string {',
        `  const rejected = /${externalModel}|${referenceProduct}|${percentToken}/`,
        '  if (evidence.targetManifest) return "DSXU internal evidence"',
        '  return rejected.source',
        '}',
      ].join('\n'),
    });

    expect(result.status).toBe('FAIL');
    expect(result.shouldBlock).toBe(true);
    expect(result.policy).toMatchObject({
      blocking: true,
      riskLevel: 'risk-blocking',
      matchedRule: 'release-claim-source-hygiene',
    });
    expect(result.error).toContain('[external-claim-token]');
  });

  test('tool gate ignores removed external parity tokens when post-mutation claim source is clean', async () => {
    const externalModel = ['G', 'PT'].join('');

    const result = await invokeStaticAnalysisToolGate({
      filePaths: ['src/claim.ts'],
      patchContent: [
        '@@',
        `-export function buildReadmeClaim() { return "${externalModel}" }`,
        '+export function buildReadmeClaim() { return "DSXU internal evidence validated." }',
      ].join('\n'),
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.shouldBlock).toBe(false);
    expect(result.semantics).toBe('advisory-envelope');
  });

  test('tool gate can still be explicitly disabled for boundary evidence', async () => {
    process.env.DSXU_STATIC_ANALYSIS_TOOL_GATE = '0';

    const result = await invokeStaticAnalysisToolGate({
      filePaths: ['src/services/api/deepseek-adapter.ts'],
      patchContent: 'export const sample = 1',
    });

    expect(result.status).toBe('SKIPPED');
    expect(result.semantics).toBe('skipped');
    expect(result.policy).toMatchObject({
      enabled: false,
      runAnalysis: false,
      blocking: false,
      riskLevel: 'risk-blocking',
    });
  });
});
