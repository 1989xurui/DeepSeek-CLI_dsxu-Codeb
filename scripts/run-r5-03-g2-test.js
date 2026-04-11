#!/usr/bin/env node

/**
 * R5-03 G2 差分基线测试
 * 根据新规则：无回归即通过
 * 验证 schema lint 功能没有退化
 */

import { lintSchema, lintAllTools } from '../src/tools/schema-lint.js';

console.log('=== R5-03 G2 差分基线测试开始 ===');
console.log('测试标准：无回归即通过\n');

// 测试用例
const testCases = [
  {
    name: '完美 schema 应通过',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number', default: 0 }
      },
      required: ['name'],
      additionalProperties: false
    },
    toolName: 'perfect-tool',
    expectedViolations: 0
  },
  {
    name: '缺失 required 应检测',
    schema: {
      type: 'object',
      properties: {
        field1: { type: 'string' },
        field2: { type: 'number' }
      },
      additionalProperties: false
    },
    toolName: 'missing-required-tool',
    expectedViolations: 2 // field1 和 field2 都缺失
  },
  {
    name: '禁止关键字应检测',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        length: { type: 'string', minLength: 1 }
      },
      required: ['email', 'length'],
      additionalProperties: false
    },
    toolName: 'forbidden-keywords-tool',
    expectedViolations: 2 // format:email 和 minLength
  }
];

// 运行测试
let passed = 0;
let failed = 0;

console.log('--- 单个 schema 检查测试 ---');
for (const testCase of testCases) {
  console.log(`测试: ${testCase.name}`);

  try {
    const violations = lintSchema(testCase.schema, testCase.toolName);

    if (violations.length === testCase.expectedViolations) {
      console.log(`  ✓ 通过: 预期 ${testCase.expectedViolations} 个违规，实际 ${violations.length} 个`);
      passed++;
    } else {
      console.log(`  ✗ 失败: 预期 ${testCase.expectedViolations} 个违规，实际 ${violations.length} 个`);
      console.log(`     违规详情:`);
      for (const v of violations) {
        console.log(`       - ${v.rule}: ${v.message}`);
      }
      failed++;
    }
  } catch (error) {
    console.log(`  ✗ 异常: ${error.message}`);
    failed++;
  }
}

console.log('\n--- 批量工具检查测试 ---');
try {
  const result = lintAllTools();
  console.log(`检查了 ${result.toolCount} 个工具`);
  console.log(`发现 ${result.violationCount} 个违规项`);

  // 检查是否至少发现了一些违规（示例工具中有违规）
  if (result.violationCount > 0) {
    console.log('  ✓ 批量检查功能正常');
    passed++;
  } else {
    console.log('  ✗ 批量检查未发现任何违规（但示例工具应有违规）');
    failed++;
  }
} catch (error) {
  console.log(`  ✗ 批量检查异常: ${error.message}`);
  failed++;
}

console.log(`\n=== 测试总结 ===`);
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${testCases.length + 1}`); // +1 是批量检查测试

if (failed === 0) {
  console.log('\n✅ R5-03 G2 测试通过（无回归）');
  process.exit(0);
} else {
  console.log('\n❌ R5-03 G2 测试失败');
  process.exit(1);
}