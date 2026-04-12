#!/usr/bin/env bun

/**
 * G4 蒸馏门检查 — R5-23 Self-Consistency Voting
 * 验证实现是否符合 contract.ts + test-cases.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 动态导入实现模块
let impl: any;
try {
  impl = require('../../src/coordinator/voting');
} catch (e) {
  console.error('❌ 无法导入 src/coordinator/voting — DSxu-V1 还没写完实现');
  console.error('   请先实现模块再跑 G4');
  process.exit(1);
}

const { vote, computeSimilarity, clusterCandidates, recommendN } = impl;

// 读取测试用例
const testCasesPath = join(__dirname, '../../.dsxu/reference/R5-23-voting/test-cases.json');
const testCases = JSON.parse(readFileSync(testCasesPath, 'utf-8'));

// 报告目录
const reportDir = join(__dirname, '../../.dsevo/g4-reports');
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, `R5-23-${Date.now()}.md`);

// ── 路径解析工具 ──
function resolvePath(obj: any, pathStr: string): any {
  const parts: string[] = [];
  let current = '';
  let inBracket = false;
  for (let i = 0; i < pathStr.length; i++) {
    const ch = pathStr[i];
    if (ch === '[') { if (current) { parts.push(current); current = ''; } inBracket = true; }
    else if (ch === ']') { if (current) { parts.push(current); current = ''; } inBracket = false; }
    else if (ch === '.' && !inBracket) { if (current) { parts.push(current); current = ''; } }
    else { current += ch; }
  }
  if (current) parts.push(current);
  let value = obj;
  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = /^\d+$/.test(part) ? value[parseInt(part)] : value[part];
  }
  return value;
}

function deepCompare(actual: any, expected: any, path: string = ''): { match: boolean; message?: string } {
  if (expected === undefined) return { match: true };

  if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
    for (const key in expected) {
      let resolvedActual: any;

      // 特殊比较器
      if (key.endsWith('_gte')) {
        const realKey = key.replace(/_gte$/, '');
        const realVal = (realKey.includes('.') || realKey.includes('[')) ? resolvePath(actual, realKey) : actual?.[realKey];
        if (realVal === undefined || realVal < expected[key]) {
          return { match: false, message: `${realKey}: expected >= ${expected[key]}, got ${realVal}` };
        }
        continue;
      }
      if (key.endsWith('_lte')) {
        const realKey = key.replace(/_lte$/, '');
        const realVal = (realKey.includes('.') || realKey.includes('[')) ? resolvePath(actual, realKey) : actual?.[realKey];
        if (realVal === undefined || realVal > expected[key]) {
          return { match: false, message: `${realKey}: expected <= ${expected[key]}, got ${realVal}` };
        }
        continue;
      }
      if (key.endsWith('_length')) {
        const realKey = key.replace(/_length$/, '');
        const realVal = (realKey.includes('.') || realKey.includes('[')) ? resolvePath(actual, realKey) : actual?.[realKey];
        const len = Array.isArray(realVal) ? realVal.length : 0;
        if (len !== expected[key]) {
          return { match: false, message: `${realKey}.length: expected ${expected[key]}, got ${len}` };
        }
        continue;
      }

      if (key.includes('.') || key.includes('[')) {
        resolvedActual = resolvePath(actual, key);
      } else {
        resolvedActual = actual?.[key];
      }

      const result = deepCompare(resolvedActual, expected[key], path ? `${path}.${key}` : key);
      if (!result.match) return result;
    }
    return { match: true };
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return { match: false, message: `${path}: expected array, got ${typeof actual}` };
    }
    for (let i = 0; i < expected.length; i++) {
      const result = deepCompare(actual[i], expected[i], `${path}[${i}]`);
      if (!result.match) return result;
    }
    return { match: true };
  }

  if (actual === expected) return { match: true };
  // 浮点数容差
  if (typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) < 0.01) {
    return { match: true };
  }
  return { match: false, message: `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
}

// ── 主测试逻辑 ──
interface TestResult { id: string; description: string; passed: boolean; error?: string; }

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const tc of testCases.cases) {
    const result: TestResult = { id: tc.id, description: tc.description, passed: false };

    try {
      switch (tc.type) {
        case 'similarity': {
          const sim = computeSimilarity(tc.input.a, tc.input.b, tc.input.method);
          const cmp = deepCompare({ similarity: sim }, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
          break;
        }

        case 'cluster': {
          const clusters = clusterCandidates(tc.input.candidates, tc.input.threshold, tc.input.method);
          const cmp = deepCompare({ clusterCount: clusters.length, clusters }, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
          break;
        }

        case 'vote': {
          const voteResult = await vote(tc.input.taskInput, tc.input.config);
          const cmp = deepCompare(voteResult, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
          break;
        }

        case 'recommendN': {
          const n = recommendN(tc.input.task);
          const cmp = deepCompare({ n }, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
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

// ── 主入口 ──
async function main() {
  console.log('🚀 开始 G4 蒸馏门检查 — R5-23 Self-Consistency Voting\n');

  const results = await runTests();
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  // 生成报告
  const report = [
    `# G4 Report: R5-23 Self-Consistency Voting`,
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

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
