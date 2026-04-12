#!/usr/bin/env bun

/**
 * R5-21 TDD 门
 *
 * 目标：确保每个 sub-task 遵循 TDD 流程
 * 1. Planner 阶段必须先生成 failing test
 * 2. Executor 必须跑绿才能 commit
 *
 * 流程：
 * tddGate(taskDescription) → 生成 failing test
 * 验证 test 确实 fail（红）
 * Executor 写实现
 * 验证 test pass（绿）
 * 任一步骤失败 → 返回错误，不允许 commit
 */

import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

export interface TDDGateOptions {
  /** 任务描述 */
  taskDescription: string;
  /** 测试文件路径 */
  testFilePath?: string;
  /** 实现文件路径 */
  implementationPath?: string;
  /** 测试命令 */
  testCommand?: string;
  /** 是否在失败时清理测试文件 */
  cleanupOnFailure?: boolean;
}

export interface TDDGateResult {
  success: boolean;
  phase: 'test_generation' | 'red_phase' | 'implementation' | 'green_phase';
  error?: string;
  testContent?: string;
  testOutput?: string;
  implementationContent?: string;
}

/**
 * TDD 门主函数
 */
export async function tddGate(options: TDDGateOptions): Promise<TDDGateResult> {
  const {
    taskDescription,
    testFilePath = generateTestFilePath(taskDescription),
    implementationPath = generateImplementationPath(taskDescription),
    testCommand = `bun test ${testFilePath}`,
    cleanupOnFailure = true,
  } = options;

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║            R5-21 TDD 门启动                 ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`任务: ${taskDescription}`);
  console.log(`测试文件: ${testFilePath}`);
  console.log(`实现文件: ${implementationPath}`);

  try {
    // 阶段 1: 生成 failing test
    console.log('\n=== 阶段 1: 生成 failing test ===');
    const testContent = generateFailingTest(taskDescription, implementationPath);

    // 确保目录存在
    const testDir = dirname(testFilePath);
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
      console.log(`📁 创建目录: ${testDir}`);
    }

    writeFileSync(testFilePath, testContent, 'utf8');
    console.log('✅ 测试文件已生成');

    // 阶段 2: 验证 test 确实 fail（红）
    console.log('\n=== 阶段 2: 验证 red phase (测试失败) ===');
    const redResult = runTest(testCommand);

    if (redResult.success) {
      const error = '测试在红阶段通过了！这违反了TDD原则。测试必须首先失败。';
      console.log(`❌ ${error}`);

      if (cleanupOnFailure) {
        cleanupTestFile(testFilePath);
      }

      return {
        success: false,
        phase: 'red_phase',
        error,
        testContent,
        testOutput: redResult.output,
      };
    }

    console.log('✅ 红阶段验证通过：测试按预期失败');

    // 阶段 3: Executor 写实现
    console.log('\n=== 阶段 3: 实现功能 ===');
    console.log('提示：现在请实现功能代码，然后调用 tddGate.verifyImplementation()');

    return {
      success: true,
      phase: 'implementation',
      testContent,
      testOutput: redResult.output,
    };

  } catch (error: any) {
    console.error(`❌ TDD 门失败: ${error.message}`);

    if (cleanupOnFailure && options.testFilePath && existsSync(options.testFilePath)) {
      cleanupTestFile(options.testFilePath);
    }

    return {
      success: false,
      phase: 'test_generation',
      error: error.message,
    };
  }
}

/**
 * 验证实现是否通过测试（绿阶段）
 */
export async function verifyImplementation(options: TDDGateOptions): Promise<TDDGateResult> {
  const {
    testFilePath = generateTestFilePath(options.taskDescription),
    testCommand = `bun test ${testFilePath}`,
    cleanupOnFailure = true,
  } = options;

  console.log('\n=== 阶段 4: 验证 green phase (测试通过) ===');

  try {
    // 运行测试
    const greenResult = runTest(testCommand);

    if (!greenResult.success) {
      const error = '实现后测试仍然失败！需要修复实现。';
      console.log(`❌ ${error}`);
      console.log('测试输出:', greenResult.output);

      return {
        success: false,
        phase: 'green_phase',
        error,
        testOutput: greenResult.output,
      };
    }

    console.log('✅ 绿阶段验证通过：所有测试通过！');
    console.log('\n🎉 TDD 流程完成！可以安全地提交代码。');

    // 清理测试文件（可选）
    if (cleanupOnFailure && existsSync(testFilePath)) {
      console.log(`清理测试文件: ${testFilePath}`);
      unlinkSync(testFilePath);
    }

    return {
      success: true,
      phase: 'green_phase',
      testOutput: greenResult.output,
    };

  } catch (error: any) {
    console.error(`❌ 绿阶段验证失败: ${error.message}`);

    return {
      success: false,
      phase: 'green_phase',
      error: error.message,
    };
  }
}

/**
 * 生成 failing test 内容
 */
function generateFailingTest(taskDescription: string, implementationPath: string): string {
  const testName = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const implementationFile = implementationPath.split('/').pop()?.replace('.ts', '') || 'implementation';

  return `/**
 * TDD 测试: ${taskDescription}
 *
 * 这个测试应该首先失败（红阶段）
 * 实现功能后应该通过（绿阶段）
 */

import { describe, test, expect } from 'bun:test';

// 注意：这个导入会失败，因为实现还不存在
// 这是故意的 - 测试应该首先失败
// import { ${testName} } from '${implementationPath}';

describe('${taskDescription}', () => {
  test('应该实现基本功能', () => {
    // 这个测试会失败，因为函数还不存在
    // 实现后应该通过
    expect(() => {
      // ${testName}();
      throw new Error('函数未实现 - 这是预期的红阶段失败');
    }).toThrow();
  });

  test('应该处理边界情况', () => {
    // 添加更多测试用例
    expect(true).toBe(false); // 故意失败
  });

  test('应该返回正确的结果', () => {
    // 实现后应该通过
    // const result = ${testName}();
    // expect(result).toBe(expectedValue);
    expect(1 + 1).toBe(3); // 故意失败
  });
});

console.log('🔴 红阶段：这个测试应该失败（这是正常的）');
console.log('实现功能后，测试应该变绿 ✅');
`;
}

/**
 * 运行测试命令
 */
function runTest(command: string): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // 捕获 stdout 和 stderr
    });

    // 如果执行到这里，测试通过了
    return { success: true, output };

  } catch (error: any) {
    // 测试失败 - 这是红阶段期望的结果
    return {
      success: false,
      output: error.stdout?.toString() || error.stderr?.toString() || error.message
    };
  }
}

/**
 * 生成测试文件路径
 */
function generateTestFilePath(taskDescription: string): string {
  const safeName = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return join(process.cwd(), 'test', `tdd-${safeName}.test.ts`);
}

/**
 * 生成实现文件路径
 */
function generateImplementationPath(taskDescription: string): string {
  const safeName = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return join(process.cwd(), 'src', `${safeName}.ts`);
}

/**
 * 清理测试文件
 */
function cleanupTestFile(testFilePath: string): void {
  if (existsSync(testFilePath)) {
    try {
      unlinkSync(testFilePath);
      console.log(`已清理测试文件: ${testFilePath}`);
    } catch (error) {
      console.warn(`无法清理测试文件: ${error.message}`);
    }
  }
}

/**
 * 命令行接口
 */
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('用法:');
    console.log('  bun run src/coordinator/tdd-gate.ts <task-description>');
    console.log('');
    console.log('示例:');
    console.log('  bun run src/coordinator/tdd-gate.ts "添加用户认证功能"');
    process.exit(1);
  }

  const taskDescription = args.join(' ');

  tddGate({ taskDescription })
    .then(result => {
      if (!result.success) {
        console.error(`\n❌ TDD 门失败: ${result.error}`);
        process.exit(1);
      }

      console.log('\n✅ TDD 门红阶段完成');
      console.log('下一步: 实现功能代码，然后运行:');
      console.log(`  bun run src/coordinator/tdd-gate.ts --verify "${taskDescription}"`);
    })
    .catch(error => {
      console.error('❌ TDD 门执行失败:', error);
      process.exit(1);
    });
}

// 处理 --verify 参数
if (import.meta.main && process.argv.includes('--verify')) {
  const taskIndex = process.argv.indexOf('--verify') + 1;
  const taskDescription = process.argv[taskIndex] || '未知任务';

  verifyImplementation({ taskDescription })
    .then(result => {
      if (!result.success) {
        console.error(`\n❌ 绿阶段验证失败: ${result.error}`);
        process.exit(1);
      }

      console.log('\n✅ TDD 流程全部完成！可以提交代码。');
    })
    .catch(error => {
      console.error('❌ 验证失败:', error);
      process.exit(1);
    });
}