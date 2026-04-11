#!/usr/bin/env node

/**
 * R5-20 G2 差分基线测试
 * 根据新规则：无回归即通过
 * 验证 sampling policy 功能没有退化
 */

import { SamplingPolicy } from '../src/services/sampling-policy.js';

console.log('=== R5-20 G2 差分基线测试开始 ===');
console.log('测试标准：无回归即通过\n');

// 测试用例
const testCases = [
  {
    name: '代码生成任务应返回正确配置',
    messages: [
      { role: 'user', content: 'Write a function to calculate factorial' }
    ],
    expectedModel: 'deepseek-chat',
    expectedTemp: 0.7,
    expectedTopP: 0.95
  },
  {
    name: '复杂推理任务应返回 reasoner',
    messages: [
      { role: 'user', content: 'Think step by step about this problem' }
    ],
    expectedModel: 'deepseek-reasoner',
    expectedTemp: 0.3,
    expectedTopP: 0.9
  },
  {
    name: '工具密集型任务应返回 chat',
    messages: [
      { role: 'user', content: 'Use tools to search' }
    ],
    tools: [{ name: 'search' }],
    expectedModel: 'deepseek-chat',
    expectedTemp: 0.5,
    expectedTopP: 0.95
  },
  {
    name: '创意写作任务应返回高 temperature',
    messages: [
      { role: 'user', content: 'Write a creative story' }
    ],
    expectedModel: 'deepseek-chat',
    expectedTemp: 0.9,
    expectedTopP: 0.99
  },
  {
    name: '事实问答任务应返回低 temperature',
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],
    expectedModel: 'deepseek-chat',
    expectedTemp: 0.2,
    expectedTopP: 0.85
  },
  {
    name: '调试任务应返回 reasoner',
    messages: [
      { role: 'user', content: 'Debug this error in my code' }
    ],
    expectedModel: 'deepseek-reasoner',
    expectedTemp: 0.4,
    expectedTopP: 0.9
  }
];

// 运行测试
const policy = new SamplingPolicy();
let passed = 0;
let failed = 0;

console.log('--- 采样策略测试 ---');
for (const testCase of testCases) {
  console.log(`测试: ${testCase.name}`);

  try {
    const config = policy.getSamplingConfig(testCase.messages, testCase.tools);

    const errors = [];
    if (config.model !== testCase.expectedModel) {
      errors.push(`模型: 预期 ${testCase.expectedModel}, 实际 ${config.model}`);
    }
    if (Math.abs(config.temperature - testCase.expectedTemp) > 0.01) {
      errors.push(`temperature: 预期 ${testCase.expectedTemp}, 实际 ${config.temperature}`);
    }
    if (Math.abs(config.top_p - testCase.expectedTopP) > 0.01) {
      errors.push(`top_p: 预期 ${testCase.expectedTopP}, 实际 ${config.top_p}`);
    }

    if (errors.length === 0) {
      console.log(`  ✓ 通过`);
      passed++;
    } else {
      console.log(`  ✗ 失败:`);
      for (const error of errors) {
        console.log(`       ${error}`);
      }
      // 输出实际配置以便调试
      console.log(`       实际配置: model=${config.model}, temperature=${config.temperature}, top_p=${config.top_p}`);
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ 异常: ${error.message}`);
    failed++;
  }
}

console.log('\n--- 直接类型配置测试 ---');
try {
  const config = policy.getConfigForTaskType('code-generation');
  if (config.temperature === 0.7 && config.top_p === 0.95 && config.model === 'deepseek-chat') {
    console.log('  ✓ 直接类型配置正常');
    passed++;
  } else {
    console.log('  ✗ 直接类型配置错误');
    failed++;
  }
} catch (error) {
  console.log(`  ✗ 异常: ${error.message}`);
  failed++;
}

console.log('\n--- 所有策略测试 ---');
try {
  const strategies = policy.getAllStrategies();
  const expectedTypes = ['code-generation', 'complex-reasoning', 'tool-intensive',
                         'creative-writing', 'factual-qa', 'debugging', 'default'];

  let allPresent = true;
  for (const type of expectedTypes) {
    if (!strategies[type]) {
      console.log(`  ✗ 缺少策略: ${type}`);
      allPresent = false;
    }
  }

  if (allPresent) {
    console.log('  ✓ 所有策略存在');
    passed++;
  } else {
    failed++;
  }
} catch (error) {
  console.log(`  ✗ 异常: ${error.message}`);
  failed++;
}

console.log(`\n=== 测试总结 ===`);
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${testCases.length + 2}`); // +2 是额外测试

if (failed === 0) {
  console.log('\n✅ R5-20 G2 测试通过（无回归）');
  process.exit(0);
} else {
  console.log('\n❌ R5-20 G2 测试失败');
  process.exit(1);
}