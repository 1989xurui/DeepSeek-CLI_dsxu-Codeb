#!/usr/bin/env bun

/**
 * G4 蒸馏门检查
 * 验证 R5-22 静态预门实现是否符合蒸馏协议
 * 支持 test-cases.json v2 格式
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { runStaticGate, formatGateReport, shouldScan, StaticGateOptions, SpawnResult } from '../../src/services/static-analysis';

// 读取测试用例
const testCasesPath = join(__dirname, '../../.dsxu/reference/R5-22-static-pregate/test-cases.json');
const testCases = JSON.parse(readFileSync(testCasesPath, 'utf-8'));

// 创建报告目录
const reportDir = join(__dirname, '../../.dsevo/g4-reports');
if (!existsSync(reportDir)) {
  mkdirSync(reportDir, { recursive: true });
}

const reportPath = join(reportDir, `R5-22-${Date.now()}.md`);

interface TestResult {
  id: string;
  description: string;
  passed: boolean;
  error?: string;
  details?: any;
}

// 创建 mockSpawn 函数
function createMockSpawn(mockToolOutput: any) {
  return async (cmd: string, args: string[], timeoutMs: number): Promise<SpawnResult> => {
    console.log(`[mockSpawn] cmd: ${cmd}, args: ${JSON.stringify(args)}`);

    // 确定工具类型
    let toolType: string;
    if (cmd.includes('ast-grep') || args.some(arg => arg.includes('ast-grep'))) {
      toolType = 'ast-grep';
    } else if (cmd.includes('tsc') || args.some(arg => arg === 'tsc')) {
      toolType = 'tsc';
    } else if (cmd.includes('eslint') || args.some(arg => arg === 'eslint')) {
      toolType = 'eslint';
    } else {
      toolType = 'unknown';
    }

    console.log(`[mockSpawn] toolType: ${toolType}`);

    const mock = mockToolOutput[toolType];
    if (!mock) {
      console.log(`[mockSpawn] no mock for ${toolType}, returning success`);
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 10,
      };
    }

    // 处理超时情况
    if (mock.timedOut) {
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: true,
        durationMs: mock.durationMs || timeoutMs + 100,
      };
    }

    return {
      exitCode: mock.exitCode || 0,
      stdout: mock.stdout || '',
      stderr: mock.stderr || '',
      durationMs: 10,
    };
  };
}

// 解析 dotted-path 键（如 "issues[0].source"）为路径段数组
function resolvePath(obj: any, pathStr: string): any {
  const parts: string[] = [];
  let current = '';
  let inBracket = false;
  for (let i = 0; i < pathStr.length; i++) {
    const ch = pathStr[i];
    if (ch === '[') {
      if (current) { parts.push(current); current = ''; }
      inBracket = true;
    } else if (ch === ']') {
      if (current) { parts.push(current); current = ''; }
      inBracket = false;
    } else if (ch === '.' && !inBracket) {
      if (current) { parts.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  let value = obj;
  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = /^\d+$/.test(part) ? value[parseInt(part)] : value[part];
  }
  return value;
}

// 深度比较辅助函数
function deepCompare(actual: any, expected: any, path: string = ''): { match: boolean; message?: string } {
  if (expected === undefined) {
    return { match: true };
  }

  if (typeof expected === 'object' && !Array.isArray(expected)) {
    for (const key in expected) {
      // 关键修复：如果 key 包含 . 或 []，按路径导航 actual
      let resolvedActual: any;
      if (key.includes('.') || key.includes('[')) {
        resolvedActual = resolvePath(actual, key);
      } else {
        resolvedActual = actual?.[key];
      }
      const result = deepCompare(resolvedActual, expected[key], path ? `${path}.${key}` : key);
      if (!result.match) {
        return result;
      }
    }
    return { match: true };
  }

  // 简单值比较
  if (actual === expected) {
    return { match: true };
  }

  return { match: false, message: `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` };
}

async function runGoldenIOTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const testCase of testCases.cases) {
    const result: TestResult = {
      id: testCase.id,
      description: testCase.description,
      passed: false,
    };

    try {
      const type = testCase.type || 'default';

      switch (type) {
        case 'shouldScan':
          // 测试 shouldScan 函数
          const paths = testCase.input.paths || [];
          const allTrue = testCase.expect.allTrue === true;
          const allFalse = testCase.expect.allFalse === true;

          if (allTrue) {
            result.passed = paths.every(path => shouldScan(path));
          } else if (allFalse) {
            result.passed = paths.every(path => !shouldScan(path));
          }
          break;

        case 'mockLayer':
          // 测试 mock 模式
          const targetFiles = testCase.input.targetFiles || [];
          const options: StaticGateOptions = {
            ...(testCase.input.options || {}),
            mockSpawn: createMockSpawn(testCase.input.mockToolOutput || {}),
          };

          const gateResult = await runStaticGate(targetFiles, options);

          // 深度比较期望值
          const compareResult = deepCompare(gateResult, testCase.expect);
          result.passed = compareResult.match;
          if (!result.passed && compareResult.message) {
            result.error = compareResult.message;
          }
          break;

        case 'formatReport':
          // 测试 formatGateReport
          const report = formatGateReport(testCase.input.fakeResult);
          result.passed = true;

          // 检查报告内容
          if (testCase.expect.reportContains) {
            const contains = Array.isArray(testCase.expect.reportContains)
              ? testCase.expect.reportContains.every(str => report.includes(str))
              : report.includes(testCase.expect.reportContains);
            result.passed = result.passed && contains;
          }

          if (testCase.expect.reportLengthLte) {
            result.passed = result.passed && report.length <= testCase.expect.reportLengthLte;
          }
          break;

        default:
          // 默认测试 runStaticGate（无 mock）
          const defaultTargetFiles = testCase.input.targetFiles || [];
          const defaultOptions = testCase.input.options || {};

          console.log(`测试 ${testCase.id}: 调用 runStaticGate(${JSON.stringify(defaultTargetFiles)}, ${JSON.stringify(defaultOptions)})`);
          const defaultResult = await runStaticGate(defaultTargetFiles, defaultOptions);
          console.log(`测试 ${testCase.id}: 结果 passed=${defaultResult.passed}, totalIssues=${defaultResult.totalIssues}`);

          const defaultCompare = deepCompare(defaultResult, testCase.expect);
          result.passed = defaultCompare.match;
          if (!result.passed && defaultCompare.message) {
            result.error = defaultCompare.message;
          }
          break;
      }

      result.details = { type };

    } catch (error: any) {
      result.passed = false;
      result.error = error.message || String(error);
      console.error(`测试 ${testCase.id} 失败:`, error);
    }

    results.push(result);
  }

  return results;
}

async function main() {
  console.log('🚀 开始 G4 蒸馏门检查...\n');

  console.log('📋 运行 Golden I/O 测试...');
  const results = await runGoldenIOTests();

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;

  console.log(`\n📊 测试结果: ${passedCount}/${totalCount} 通过`);

  // 生成报告
  let report = `# G4 蒸馏门检查报告 - R5-22 静态预门\n\n`;
  report += `**时间**: ${new Date().toISOString()}\n`;
  report += `**结果**: ${allPassed ? '✅ 通过' : '❌ 失败'}\n`;
  report += `**通过率**: ${passedCount}/${totalCount} (${((passedCount / totalCount) * 100).toFixed(1)}%)\n\n`;

  report += `## 详细结果\n\n`;
  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    report += `### ${status} ${r.id}: ${r.description}\n`;
    if (!r.passed && r.error) {
      report += `**错误**: ${r.error}\n`;
    }
    if (r.details) {
      report += `**详情**: ${JSON.stringify(r.details, null, 2)}\n`;
    }
    report += `\n`;
  }

  // 写入报告
  writeFileSync(reportPath, report, 'utf-8');
  console.log(`📄 报告已保存: ${reportPath}`);

  // 输出摘要
  if (!allPassed) {
    console.log('\n❌ 以下测试失败:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.id}: ${r.description}`);
      if (r.error) console.log(`    错误: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('\n🎉 所有测试通过！G4 蒸馏门检查完成。');
  process.exit(0);
}

main().catch(error => {
  console.error('G4 检查失败:', error);
  process.exit(1);
});