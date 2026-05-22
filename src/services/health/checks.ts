import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { HealthCheck, HealthCheckResult } from './contract';

export function createDefaultHealthChecks(): HealthCheck[] {
  return [
    check('bunRuntime', 'environment', 'critical', async () => {
      return `Bun ${Bun.version} is available`;
    }),
    check('packageJson', 'environment', 'critical', async () => {
      const raw = await readFile('package.json', 'utf-8');
      const pkg = JSON.parse(raw);
      return `package ${pkg.name ?? 'unknown'} parsed`;
    }),
    check('fileSystemAccess', 'environment', 'critical', async () => {
      const dir = join('.dsxu', 'health');
      const file = join(dir, 'probe.txt');
      await mkdir(dir, { recursive: true });
      await writeFile(file, 'ok', 'utf-8');
      const content = await readFile(file, 'utf-8');
      await rm(file, { force: true });
      if (content !== 'ok') throw new Error('probe content mismatch');
      return 'read/write probe passed';
    }),
    check('mainlineVerificationHealth', 'tool', 'critical', async () => {
      const envelope = await import('../../dsxu/engine/post-mutation-verification-envelope');
      const tdd = await import('../../coordinator/tdd-gate/index');
      if (typeof envelope.buildPostMutationVerificationEnvelope !== 'function') {
        throw new Error('post-mutation verification envelope missing');
      }
      if (typeof tdd.tddGate !== 'function') throw new Error('tddGate missing');
      return 'Tool Gate post-mutation verification and TDD module loaded';
    }),
    check('staticAnalysisBridge', 'tool', 'critical', async () => {
      const mod = await import('../static-analysis/bridge');
      if (typeof mod.createStaticAnalysisBridge !== 'function') {
        throw new Error('createStaticAnalysisBridge missing');
      }
      return 'static analysis bridge loaded';
    }),
    check('evidenceDirectory', 'environment', 'warning', async () => {
      await access(join('docs', 'generated'));
      return 'docs/generated exists';
    }),
    check('publicChallengeEvidence', 'tool', 'warning', async () => {
      await access(join('docs', 'generated', 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json'));
      return 'public challenge evidence exists';
    }),
    check('cacheDirectory', 'cache', 'info', async () => {
      await mkdir('.dsxu', { recursive: true });
      return '.dsxu cache directory is accessible';
    }),
    check('modelConnectivity', 'model', 'warning', async () => {
      if (!process.env.DEEPSEEK_API_KEY) {
        return warn('DEEPSEEK_API_KEY is not set; live model ping skipped');
      }
      return 'DeepSeek API key is present; live ping intentionally skipped by health dry path';
    }),
  ];
}

function check(
  name: HealthCheck['name'],
  category: HealthCheck['category'],
  severity: HealthCheck['severity'],
  runCheck: () => Promise<string | { status: 'WARN'; message: string }>,
): HealthCheck {
  return {
    name,
    category,
    severity,
    async run(): Promise<HealthCheckResult> {
      const startTime = Date.now();
      try {
        const result = await runCheck();
        if (typeof result === 'object' && result.status === 'WARN') {
          return {
            name,
            category,
            severity,
            status: 'WARN',
            message: result.message,
            durationMs: Date.now() - startTime,
          };
        }
        return {
          name,
          category,
          severity,
          status: 'PASS',
          message: result,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          name,
          category,
          severity,
          status: 'FAIL',
          message: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
      }
    },
  };
}

function warn(message: string): { status: 'WARN'; message: string } {
  return { status: 'WARN', message };
}
