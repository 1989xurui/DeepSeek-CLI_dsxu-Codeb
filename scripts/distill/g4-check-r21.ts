#!/usr/bin/env bun

/**
 * G4 蒸馏门检查 — R5-21 TDD Gate
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

let impl: any;
try {
  impl = require('../../src/coordinator/tdd-gate');
} catch (e) {
  console.error('❌ 无法导入 src/coordinator/tdd-gate');
  process.exit(1);
}

const { extractTestTargets, generateTestSpec, runRedPhase, runGreenPhase, tddGate } = impl;

const testCasesPath = join(__dirname, '../../.dsxu/reference/R5-21-tdd-gate/test-cases.json');
const testCases = JSON.parse(readFileSync(testCasesPath, 'utf-8'));

const reportDir = join(__dirname, '../../.dsevo/g4-reports');
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, `R5-21-${Date.now()}.md`);

// ── 测试逻辑 ──
interface TestResult { id: string; description: string; passed: boolean; error?: string; }

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const tc of testCases.cases) {
    const result: TestResult = { id: tc.id, description: tc.description, passed: false };

    try {
      switch (tc.type) {
        case 'extractTestTargets': {
          const targets = extractTestTargets(tc.input.taskDescription, tc.input.targetFiles);
          if (!Array.isArray(targets)) {
            result.error = `expected array, got ${typeof targets}`;
            break;
          }
          if (tc.expect.minLength && targets.length < tc.expect.minLength) {
            result.error = `expected >= ${tc.expect.minLength} targets, got ${targets.length}`;
            break;
          }
          if (tc.expect.containsAny) {
            const joined = targets.join(' ').toLowerCase();
            const found = tc.expect.containsAny.some((kw: string) => joined.includes(kw.toLowerCase()));
            if (!found) {
              result.error = `targets "${targets.join(', ')}" don't contain any of [${tc.expect.containsAny.join(', ')}]`;
              break;
            }
          }
          result.passed = true;
          break;
        }

        case 'generateTestSpec': {
          const mockGen = async () => tc.input.mockGenerator;
          const spec = await generateTestSpec(tc.input.context, { mockTestGenerator: mockGen });

          if (tc.expect.filePath && spec.filePath !== tc.expect.filePath) {
            result.error = `filePath: expected "${tc.expect.filePath}", got "${spec.filePath}"`;
            break;
          }
          if (tc.expect.targetName && spec.targetName !== tc.expect.targetName) {
            result.error = `targetName: expected "${tc.expect.targetName}", got "${spec.targetName}"`;
            break;
          }
          if (tc.expect.testDescriptions_length !== undefined && spec.testDescriptions.length !== tc.expect.testDescriptions_length) {
            result.error = `testDescriptions.length: expected ${tc.expect.testDescriptions_length}, got ${spec.testDescriptions.length}`;
            break;
          }
          if (tc.expect.content_contains && !spec.content.includes(tc.expect.content_contains)) {
            result.error = `content missing "${tc.expect.content_contains}"`;
            break;
          }
          if (tc.expect.content_not_contains && spec.content.includes(tc.expect.content_not_contains)) {
            result.error = `content should NOT contain "${tc.expect.content_not_contains}"`;
            break;
          }
          result.passed = true;
          break;
        }

        case 'runRedPhase': {
          const mockRunner = async () => tc.input.mockRunnerResult;
          const res = await runRedPhase(tc.input.testSpec, { mockTestRunner: mockRunner });
          if (res.success !== tc.expect.success) {
            result.error = `success: expected ${tc.expect.success}, got ${res.success}`;
            break;
          }
          result.passed = true;
          break;
        }

        case 'runGreenPhase': {
          const mockRunner = async () => tc.input.mockRunnerResult;
          const res = await runGreenPhase(tc.input.testSpec, { mockTestRunner: mockRunner });
          if (res.success !== tc.expect.success) {
            result.error = `success: expected ${tc.expect.success}, got ${res.success}`;
            break;
          }
          result.passed = true;
          break;
        }

        case 'tddGate': {
          let callIdx = 0;
          const mockRunner = async () => {
            const r = tc.input.mockRunnerResults[callIdx] || tc.input.mockRunnerResults[tc.input.mockRunnerResults.length - 1];
            callIdx++;
            return r;
          };
          const mockGen = async () => tc.input.mockGenerator;
          const res = await tddGate(tc.input.context, {
            mockTestGenerator: mockGen,
            mockTestRunner: mockRunner,
          });

          if (res.passed !== tc.expect.passed) {
            result.error = `passed: expected ${tc.expect.passed}, got ${res.passed}`;
            break;
          }
          if (tc.expect['redPhase.success'] !== undefined && res.redPhase.success !== tc.expect['redPhase.success']) {
            result.error = `redPhase.success: expected ${tc.expect['redPhase.success']}, got ${res.redPhase.success}`;
            break;
          }
          if (tc.expect['greenPhase.success'] !== undefined && res.greenPhase?.success !== tc.expect['greenPhase.success']) {
            result.error = `greenPhase.success: expected ${tc.expect['greenPhase.success']}, got ${res.greenPhase?.success}`;
            break;
          }
          if (tc.expect.hasGreenPhase === false && res.greenPhase !== undefined) {
            result.error = `expected no greenPhase, but got one`;
            break;
          }
          result.passed = true;
          break;
        }

        default:
          result.error = `unknown test type: ${tc.type}`;
      }
    } catch (err: any) {
      result.error = err.message || String(err);
    }

    results.push(result);
  }

  return results;
}

async function main() {
  console.log('🚀 开始 G4 蒸馏门检查 — R5-21 TDD Gate\n');
  const results = await runTests();
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  const report = [
    `# G4 Report: R5-21 TDD Gate`,
    `- 时间: ${new Date().toISOString()}`,
    `- 结果: ${passed}/${total}`,
    ``,
    `## 详细结果`,
    ...results.map(r => `- ${r.passed ? '✅' : '❌'} ${r.id}: ${r.description}${r.error ? `\n  错误: ${r.error}` : ''}`),
  ].join('\n');

  writeFileSync(reportPath, report, 'utf-8');
  console.log(`📊 测试结果: ${passed}/${total} 通过`);
  console.log(`📄 报告: ${reportPath}`);

  if (passed < total) {
    console.log(`\n❌ 失败用例:`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.id}: ${r.description}`);
      if (r.error) console.log(`    ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 全部通过！');
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
