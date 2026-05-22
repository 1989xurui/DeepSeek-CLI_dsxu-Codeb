import { createDefaultHealthChecks } from './checks';
import type { HealthCheck, HealthReport } from './contract';

export async function runHealthChecks(
  checks: HealthCheck[] = createDefaultHealthChecks(),
): Promise<HealthReport> {
  const results = [];
  for (const check of checks) {
    results.push(await check.run());
  }

  const criticalFail = results.some(
    result => result.severity === 'critical' && result.status === 'FAIL',
  );
  const degraded = results.some(result => result.status !== 'PASS');

  return {
    overall: criticalFail ? 'FAIL' : degraded ? 'DEGRADED' : 'PASS',
    checks: results,
    generatedAt: new Date().toISOString(),
  };
}

export * from './contract';
export { createDefaultHealthChecks } from './checks';
