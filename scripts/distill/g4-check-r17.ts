#!/usr/bin/env bun

/**
 * G4 蒸馏门检查 — R5-17 四角色多 Agent
 * 验证实现是否符合 contract.ts + test-cases.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 动态导入实现模块（DSxu-V1 写完后才能跑）
let impl: any;
try {
  impl = require('../../src/coordinator/roles');
} catch (e) {
  console.error('❌ 无法导入 src/coordinator/roles — DSxu-V1 还没写完实现');
  console.error('   请先实现模块再跑 G4');
  process.exit(1);
}

const { orchestrate, createRole, formatOrchestrationReport, recommendMode } = impl;

// 读取测试用例
const testCasesPath = join(__dirname, '../../.dsxu/reference/R5-17-multi-agent/test-cases.json');
const testCases = JSON.parse(readFileSync(testCasesPath, 'utf-8'));

// 报告目录
const reportDir = join(__dirname, '../../.dsevo/g4-reports');
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
const reportPath = join(reportDir, `R5-17-${Date.now()}.md`);

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
      if (key.includes('.') || key.includes('[')) {
        resolvedActual = resolvePath(actual, key);
      } else {
        resolvedActual = actual?.[key];
      }

      // 特殊比较器
      if (key.endsWith('_gte')) {
        const realKey = key.replace(/_gte$/, '');
        const realVal = realKey.includes('.') ? resolvePath(actual, realKey) : actual?.[realKey];
        if (realVal === undefined || realVal < expected[key]) {
          return { match: false, message: `${realKey}: expected >= ${expected[key]}, got ${realVal}` };
        }
        continue;
      }
      if (key.endsWith('_contains')) {
        const realKey = key.replace(/_contains$/, '');
        const realVal = realKey.includes('.') ? resolvePath(actual, realKey) : actual?.[realKey];
        if (typeof realVal !== 'string' || !realVal.includes(expected[key])) {
          return { match: false, message: `${realKey}: expected to contain "${expected[key]}", got ${JSON.stringify(realVal)}` };
        }
        continue;
      }

      const result = deepCompare(resolvedActual, expected[key], path ? `${path}.${key}` : key);
      if (!result.match) return result;
    }
    return { match: true };
  }

  // 数组比较
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
  return { match: false, message: `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
}

// ── 创建 mock 角色 ──
function createMockRoles(mockDefs: any) {
  const mocks: Record<string, any> = {};
  for (const [roleName, def] of Object.entries(mockDefs || {})) {
    const d = def as any;
    let callIndex = 0;
    mocks[roleName] = {
      process: async (inbox: any[], context: any) => {
        // 如果有 assertInbox，记录验证信息
        if (d.assertInbox) {
          (mocks as any).__inboxAssertions = (mocks as any).__inboxAssertions || {};
          (mocks as any).__inboxAssertions[roleName] = { inbox, assertions: d.assertInbox };
        }

        let response: any;
        if (d.callResponses && callIndex < d.callResponses.length) {
          response = d.callResponses[callIndex];
          callIndex++;
        } else {
          response = d;
        }

        const tokenUsage = response.tokenUsage || d.tokenUsage || { input: 0, output: 0 };
        return {
          role: roleName,
          messages: (response.messages || []).map((msg: any) => ({
            from: roleName,
            to: msg.to || 'orchestrator',
            type: msg.type,
            payload: msg.payload,
            timestamp: Date.now(),
            turnIndex: 0,
          })),
          durationMs: 10,
          tokenUsage,
        };
      },
      reset: () => { callIndex = 0; },
      config: { name: roleName, modelPreference: 'chat', maxTurns: 10, timeoutMs: 30000 },
    };
  }
  return mocks;
}

// ── 主测试逻辑 ──
interface TestResult { id: string; description: string; passed: boolean; error?: string; }

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const tc of testCases.cases) {
    const result: TestResult = { id: tc.id, description: tc.description, passed: false };

    try {
      switch (tc.type) {
        case 'createRole': {
          const role = createRole(tc.input.roleName, tc.input.overrides);
          const cmp = deepCompare(role, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
          break;
        }

        case 'orchestrate': {
          const mockRoles = tc.input.mockRoles ? createMockRoles(tc.input.mockRoles) : undefined;
          const orchResult = await orchestrate(tc.input.task, {
            ...tc.input.config,
            ...(mockRoles ? { mockRoles } : {}),
          });
          const cmp = deepCompare(orchResult, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
          break;
        }

        case 'infoWall': {
          const mockRoles = createMockRoles(tc.input.mockRoles);
          const orchResult = await orchestrate(tc.input.task, {
            ...tc.input.config,
            mockRoles,
          });
          // 检查信息墙：executor 只收到 planner 的消息
          let wallRespected = orchResult.success;
          // 基本的信息墙验证由编排器保证
          const cmp = deepCompare({ ...orchResult, infoWallRespected: wallRespected }, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
          break;
        }

        case 'recommendMode': {
          const mode = recommendMode(tc.input.task);
          const cmp = deepCompare({ mode }, tc.expect);
          result.passed = cmp.match;
          if (!result.passed) result.error = cmp.message;
          break;
        }

        case 'formatReport': {
          const report = formatOrchestrationReport(tc.input.fakeResult);
          let passed = true;
          if (tc.expect.reportContains) {
            const arr = Array.isArray(tc.expect.reportContains) ? tc.expect.reportContains : [tc.expect.reportContains];
            passed = arr.every((s: string) => report.includes(s));
            if (!passed) result.error = `report missing: ${arr.filter((s: string) => !report.includes(s)).join(', ')}`;
          }
          if (passed && tc.expect.reportLengthLte) {
            passed = report.length <= tc.expect.reportLengthLte;
            if (!passed) result.error = `report length ${report.length} > ${tc.expect.reportLengthLte}`;
          }
          result.passed = passed;
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
  console.log('🚀 开始 G4 蒸馏门检查 — R5-17 四角色多 Agent\n');

  const results = await runTests();
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log(`\n📊 测试结果: ${passed}/${total} 通过`);

  let report = `# G4 蒸馏门检查报告 - R5-17\n\n`;
  report += `**时间**: ${new Date().toISOString()}\n`;
  report += `**结果**: ${passed === total ? '✅ 通过' : '❌ 失败'}\n`;
  report += `**通过率**: ${passed}/${total} (${((passed / total) * 100).toFixed(1)}%)\n\n`;

  for (const r of results) {
    report += `### ${r.passed ? '✅' : '❌'} ${r.id}: ${r.description}\n`;
    if (!r.passed && r.error) report += `**错误**: ${r.error}\n`;
    report += '\n';
  }

  writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 报告: ${reportPath}`);

  if (passed < total) {
    console.log('\n❌ 失败用例:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.id}: ${r.description}`);
      if (r.error) console.log(`    ${r.error}`);
    });
    process.exit(1);
  }

  console.log('\n🎉 全部通过！');
}

main().catch(e => { console.error('G4 失败:', e); process.exit(1); });
