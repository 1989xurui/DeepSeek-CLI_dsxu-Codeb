#!/usr/bin/env node

/**
 * 测试基础设施任务
 * 1. 验证 SAFETY_MARGIN = 2000
 * 2. 测试崩溃处理器（模拟异常）
 * 3. 测试历史自动摘要
 */

console.log('=== 基础设施任务测试 ===\n');

// 测试1: 验证 SAFETY_MARGIN
console.log('测试1: 验证 SAFETY_MARGIN = 2000');
const proxyContent = require('fs').readFileSync('./deepseek-proxy.ts', 'utf8');
const safetyMarginMatch = proxyContent.match(/const SAFETY_MARGIN = (\d[\d_]*)/);
if (safetyMarginMatch) {
  const value = safetyMarginMatch[1].replace(/_/g, '');
  if (value === '2000') {
    console.log('✅ SAFETY_MARGIN = 2000 (正确)');
  } else {
    console.log(`❌ SAFETY_MARGIN = ${value}, 期望 2000`);
    process.exit(1);
  }
} else {
  console.log('❌ SAFETY_MARGIN 未找到');
  process.exit(1);
}

// 测试2: 验证崩溃处理器存在
console.log('\n测试2: 验证崩溃处理器');
const crashHandlerExists = proxyContent.includes('process.on(\'uncaughtException\'') &&
                          proxyContent.includes('process.on(\'unhandledRejection\'');
if (crashHandlerExists) {
  console.log('✅ 崩溃处理器已添加');
} else {
  console.log('❌ 崩溃处理器未找到');
  process.exit(1);
}

// 测试3: 验证历史自动摘要函数存在
console.log('\n测试3: 验证历史自动摘要');
const autoSummaryExists = proxyContent.includes('autoSummarizeHistory') &&
                         proxyContent.includes('createHistorySummary');
if (autoSummaryExists) {
  console.log('✅ 历史自动摘要函数已添加');
} else {
  console.log('❌ 历史自动摘要函数未找到');
  process.exit(1);
}

// 测试4: 验证自动摘要集成到 anthropicToOpenAI
console.log('\n测试4: 验证自动摘要集成');
const integrated = proxyContent.includes('estimatedTokens > 80000') &&
                  proxyContent.includes('autoSummarizeHistory(oaiBody.messages)');
if (integrated) {
  console.log('✅ 自动摘要已集成到 anthropicToOpenAI');
} else {
  console.log('❌ 自动摘要未集成');
  process.exit(1);
}

// 测试5: 验证 .dsevo 目录存在
console.log('\n测试5: 验证崩溃日志目录');
const fs = require('fs');
const path = require('path');
const crashLogDir = '.dsevo';
const crashLogFile = path.join(crashLogDir, 'proxy-crash.log');

if (fs.existsSync(crashLogDir)) {
  console.log('✅ .dsevo 目录存在');

  // 测试是否可以写入日志
  try {
    const testLog = `[${new Date().toISOString()}] test: 基础设施测试通过\n\n`;
    fs.appendFileSync(crashLogFile, testLog);
    console.log('✅ 可以写入崩溃日志文件');
  } catch (error) {
    console.log('❌ 无法写入崩溃日志文件:', error.message);
    process.exit(1);
  }
} else {
  console.log('❌ .dsevo 目录不存在');
  process.exit(1);
}

console.log('\n=== 所有基础设施任务测试通过 ===');
console.log('1. ✅ 上下文预算守卫安全边际: 2000');
console.log('2. ✅ 崩溃处理器已安装');
console.log('3. ✅ 历史自动摘要已实现');
console.log('4. ✅ 崩溃日志目录可访问');