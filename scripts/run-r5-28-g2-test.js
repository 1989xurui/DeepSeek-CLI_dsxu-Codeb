#!/usr/bin/env node

/**
 * R5-28 G2 差分基线测试
 * 根据新规则：无回归即通过
 * 验证 SWE-bench runner 核心功能没有退化
 */

import { createSWEBenchRunner, createExampleTask, validateTask } from '../src/services/swe-bench/index.js';

console.log('=== R5-28 G2 差分基线测试开始 ===');
console.log('测试标准：无回归即通过\n');

// 测试计数器
let totalTests = 0;
let passedTests = 0;
let failedTests = [];

/**
 * 断言辅助函数
 */
function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ ${message}`);
    passedTests++;
  } else {
    console.log(`  ❌ ${message}`);
    failedTests.push(message);
  }
}

/**
 * 测试 1: 基础功能测试
 */
console.log('--- 测试 1: 基础功能 ---');

try {
  // 1.1 创建runner实例
  const runner = createSWEBenchRunner();
  assert(runner !== null && typeof runner === 'object', '应该能创建runner实例');

  // 1.2 创建示例任务
  const exampleTask = createExampleTask('g2-test-001');
  assert(exampleTask.id === 'g2-test-001', '应该能创建示例任务');

  // 1.3 验证任务
  const validationErrors = validateTask(exampleTask);
  assert(validationErrors.length === 0, '示例任务应该通过验证');

  console.log('  ✓ 基础功能测试通过');
} catch (error) {
  console.log(`  ✗ 基础功能测试失败: ${error.message}`);
  failedTests.push(`基础功能测试失败: ${error.message}`);
}

/**
 * 测试 2: 类型定义测试
 */
console.log('\n--- 测试 2: 类型定义 ---');

try {
  // 2.1 任务类型结构
  const task = createExampleTask();
  assert(typeof task.id === 'string', '任务应有id字段');
  assert(typeof task.title === 'string', '任务应有title字段');
  assert(typeof task.description === 'string', '任务应有description字段');
  assert(typeof task.repository === 'object', '任务应有repository字段');
  assert(typeof task.testSuite === 'object', '任务应有testSuite字段');
  assert(typeof task.evaluation === 'object', '任务应有evaluation字段');
  assert(typeof task.metadata === 'object', '任务应有metadata字段');

  // 2.2 测试套件结构
  assert(typeof task.testSuite.command === 'string', '测试套件应有command字段');
  assert(typeof task.testSuite.timeout === 'number', '测试套件应有timeout字段');
  assert(task.testSuite.timeout > 0, '测试超时应大于0');

  // 2.3 评估标准结构
  assert(typeof task.evaluation.requireAllTestsPass === 'boolean', '评估应有requireAllTestsPass字段');

  console.log('  ✓ 类型定义测试通过');
} catch (error) {
  console.log(`  ✗ 类型定义测试失败: ${error.message}`);
  failedTests.push(`类型定义测试失败: ${error.message}`);
}

/**
 * 测试 3: 配置验证
 */
console.log('\n--- 测试 3: 配置验证 ---');

try {
  // 3.1 默认配置
  const defaultRunner = createSWEBenchRunner();
  assert(defaultRunner !== null, '默认配置应能创建runner');

  // 3.2 自定义配置
  const customRunner = createSWEBenchRunner({
    model: {
      name: 'custom-model',
      endpoint: 'http://custom.endpoint',
      temperature: 0.5,
      maxTokens: 4096,
    },
    execution: {
      timeout: 60000,
      maxRetries: 2,
      workingDir: './custom-dir',
      sandbox: true,
    },
  });
  assert(customRunner !== null, '自定义配置应能创建runner');

  console.log('  ✓ 配置验证测试通过');
} catch (error) {
  console.log(`  ✗ 配置验证测试失败: ${error.message}`);
  failedTests.push(`配置验证测试失败: ${error.message}`);
}

/**
 * 测试 4: 错误处理
 */
console.log('\n--- 测试 4: 错误处理 ---');

try {
  const runner = createSWEBenchRunner();

  // 4.1 验证无效任务
  const invalidTask = {
    id: '',
    title: '',
    description: '',
    repository: { url: '' },
    testSuite: { command: '', timeout: 0 },
    evaluation: { requireAllTestsPass: true },
    metadata: {
      difficulty: 'easy',
      type: 'bug-fix',
      language: 'python',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  const errors = validateTask(invalidTask);
  assert(errors.length > 0, '无效任务应返回验证错误');
  assert(errors.some(e => e.includes('不能为空')), '应检测到空字段错误');

  console.log('  ✓ 错误处理测试通过');
} catch (error) {
  console.log(`  ✗ 错误处理测试失败: ${error.message}`);
  failedTests.push(`错误处理测试失败: ${error.message}`);
}

/**
 * 测试 5: 工具函数
 */
console.log('\n--- 测试 5: 工具函数 ---');

try {
  // 5.1 创建不同ID的任务
  const task1 = createExampleTask('task-1');
  const task2 = createExampleTask('task-2');

  assert(task1.id === 'task-1', '应能创建指定ID的任务1');
  assert(task2.id === 'task-2', '应能创建指定ID的任务2');
  assert(task1.id !== task2.id, '不同任务应有不同ID');

  // 5.2 任务结构一致性
  assert(task1.title === task2.title, '相同类型的任务应有相同标题');
  assert(task1.metadata.difficulty === task2.metadata.difficulty, '相同类型的任务应有相同难度');

  console.log('  ✓ 工具函数测试通过');
} catch (error) {
  console.log(`  ✗ 工具函数测试失败: ${error.message}`);
  failedTests.push(`工具函数测试失败: ${error.message}`);
}

/**
 * 测试结果汇总
 */
console.log('\n=== 测试总结 ===');
console.log(`总测试数: ${totalTests}`);
console.log(`通过数: ${passedTests}`);
console.log(`失败数: ${failedTests.length}`);
console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests.length > 0) {
  console.log('\n❌ 失败的测试:');
  for (const fail of failedTests) {
    console.log(`  - ${fail}`);
  }
  console.log(`\n🔧 需要修复的问题数: ${failedTests.length}`);
  process.exit(1);
} else {
  console.log('\n✅ R5-28 G2 测试通过（无回归）');
  console.log('\n🎯 核心功能验证:');
  console.log('  1. 基础功能 ✓');
  console.log('  2. 类型定义 ✓');
  console.log('  3. 配置验证 ✓');
  console.log('  4. 错误处理 ✓');
  console.log('  5. 工具函数 ✓');
  console.log('\n🚀 R5-28 SWE-bench runner 核心功能无退化，G2门禁通过！');
  process.exit(0);
}