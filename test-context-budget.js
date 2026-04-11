#!/usr/bin/env node

/**
 * 测试上下文预算守卫
 * 验证 95K tokens 请求不会触发 400 错误
 */

// 模拟一个大的消息列表
function createLargeMessages(tokenCount) {
  const messages = [];
  let currentTokens = 0;

  // 添加 system 消息
  messages.push({
    role: 'system',
    content: 'You are a helpful assistant.'
  });

  // 添加用户和助手消息对，直到达到目标 token 数
  while (currentTokens < tokenCount) {
    // 每对消息大约 1000 tokens
    const userMessage = {
      role: 'user',
      content: 'x'.repeat(2500) // 大约 1000 tokens
    };

    const assistantMessage = {
      role: 'assistant',
      content: 'y'.repeat(2500) // 大约 1000 tokens
    };

    messages.push(userMessage);
    messages.push(assistantMessage);
    currentTokens += 2000; // 每对大约 2000 tokens
  }

  return messages;
}

// 直接复制 deepseek-proxy.ts 中的相关函数
const CTX_MAX = 128_000;
const SAFETY_MARGIN = 2_000;

function estimateTokens(s) {
  if (!s) return 0;
  let zh = 0, other = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fff) zh++;
    else other++;
  }
  return Math.ceil(zh * 0.6 + other * 0.28);
}

function estimateMessagesTokens(messages, tools) {
  let t = 0;
  for (const m of messages) {
    t += 4; // role overhead
    if (typeof m.content === 'string') t += estimateTokens(m.content);
    else if (Array.isArray(m.content)) {
      for (const b of m.content) t += estimateTokens(JSON.stringify(b));
    }
  }
  if (tools) {
    for (const tool of tools) t += estimateTokens(JSON.stringify(tool));
  }
  return t;
}

function dropOldToolResults(messages, keepLastRounds) {
  const out = [];
  let dropped = 0;
  let rounds = 0;
  // 从后往前数轮次
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' || m.role === 'assistant') rounds++;
    if (rounds > keepLastRounds && m.role === 'tool') {
      dropped++;
      out.unshift({ ...m, content: '[Old tool result cleared by budget guard]' });
    } else {
      out.unshift(m);
    }
  }
  return { messages: out, dropped };
}

function hardTruncate(messages, keepLastRounds = 3) {
  const systems = messages.filter(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');
  const tail = rest.slice(-keepLastRounds * 2); // user+assistant 算一轮
  return [...systems, ...tail];
}

function applyBudget(oaiBody) {
  const modelMax = 8192; // deepseek-chat
  let maxTok = Math.min(oaiBody.max_tokens ?? modelMax, modelMax);
  let promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools);
  let action = 'passthrough';

  // L1/L2 · 压缩旧 tool result
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    const r = dropOldToolResults(oaiBody.messages, 6);
    oaiBody.messages = r.messages;
    promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools);
    if (r.dropped > 0) action = 'compacted';
  }

  // L3 · 缩小 output 配额
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    const newMax = Math.max(1024, CTX_MAX - promptTok - SAFETY_MARGIN);
    if (newMax < maxTok) {
      maxTok = newMax;
      action = action === 'compacted' ? 'compacted+shrunk' : 'output_shrunk';
    }
  }

  // L4 · 硬截断
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    oaiBody.messages = hardTruncate(oaiBody.messages, 3);
    promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools);
    action = 'truncated';
  }

  oaiBody.max_tokens = maxTok;
  return { action, promptTok, maxTok, ctxMax: CTX_MAX };
}

async function testContextBudget() {
  console.log('=== 测试上下文预算守卫 ===\n');

  // 创建 95K tokens 的请求
  const testRequest = {
    model: 'deepseek-chat',
    max_tokens: 8192,
    messages: createLargeMessages(95000),
    tools: []
  };

  console.log(`原始请求 tokens: ${95000} (目标) + ${8192} (max_tokens) = ${95000 + 8192}`);
  console.log(`上下文限制: 128000, 安全边际: ${SAFETY_MARGIN}`);

  try {
    const result = applyBudget(testRequest);

    console.log('\n预算守卫结果:');
    console.log(`- 动作: ${result.action}`);
    console.log(`- 处理后 prompt tokens: ${result.promptTok}`);
    console.log(`- 处理后 max_tokens: ${result.maxTok}`);
    console.log(`- 总 tokens: ${result.promptTok + result.maxTok}`);
    console.log(`- 上下文限制: ${result.ctxMax}`);

    // 验证不会超过限制
    const totalTokens = result.promptTok + result.maxTok;
    const maxAllowed = result.ctxMax - SAFETY_MARGIN;

    if (totalTokens <= maxAllowed) {
      console.log('\n✅ 测试通过: 处理后 tokens 在安全范围内');
      console.log(`   总 tokens (${totalTokens}) <= 允许最大值 (${maxAllowed})`);
    } else {
      console.log('\n❌ 测试失败: 处理后 tokens 超出安全范围');
      console.log(`   总 tokens (${totalTokens}) > 允许最大值 (${maxAllowed})`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 测试异常:', error.message);
    process.exit(1);
  }
}

testContextBudget();