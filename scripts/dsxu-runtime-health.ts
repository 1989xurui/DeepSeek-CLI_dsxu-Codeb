#!/usr/bin/env bun

import { runHealthChecks } from '../src/services/health/index';

const report = await runHealthChecks();

console.log(JSON.stringify(report, null, 2));
console.log(`Runtime health: ${report.overall}`);
for (const result of report.checks) {
  console.log(`${result.status} ${result.name}: ${result.message}`);
}

if (report.overall === 'FAIL') {
  process.exitCode = 1;
}
