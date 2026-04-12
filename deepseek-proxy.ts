/**
 * DeepSeek ↔ Anthropic Proxy for Claude Code
 * Full support: text, tool use, streaming, tool results
 *
 * Usage:
 *   bun run deepseek-proxy.ts
 *   ANTHROPIC_BASE_URL=http://localhost:8082  ANTHROPIC_API_KEY=placeholder
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-6bcf4f90150144c38ebfb16127d06294'
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const PORT = parseInt(process.env.PROXY_PORT || '8082', 10)

// P0-A: json-repair补丁
import { parseToolCallArguments } from './dsevo/jsonRepair.js'

// TASK-INFRA-1/2: 文件系统操作
import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// DeepSeek model limits (官方: https://api-docs.deepseek.com/zh-cn/quick_start/pricing)
// deepseek-chat     (V3) : context 128K, max_output 8K
// deepseek-reasoner (R1) : context 128K, max_output 64K (另有 32K CoT 不占 output)
const MAX_OUTPUT_TOKENS: Record<string, number> = {
  'deepseek-chat':     8192,
  'deepseek-reasoner': 65536,
}

// ── Context Budget Guard (规划书 第十四部分) ─────────────────────────────
// 防止 prompt_tokens + max_tokens > 128K 触发 HTTP 400
const CTX_MAX = 128_000
const SAFETY_MARGIN = 2_000

// TASK-INFRA-1: Trim 日志记录
const TRIM_LOG_DIR = '.dsevo';
const TRIM_LOG_FILE = join(TRIM_LOG_DIR, 'proxy-trim.log');

// 确保日志目录存在
if (!existsSync(TRIM_LOG_DIR)) {
  mkdirSync(TRIM_LOG_DIR, { recursive: true });
}

function logTrim(action: string, originalTokens: number, finalTokens: number, droppedRounds: number, details?: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${action}: original=${originalTokens}, final=${finalTokens}, droppedRounds=${droppedRounds}, details=${details || ''}\n`;

  try {
    writeFileSync(TRIM_LOG_FILE, logEntry, { flag: 'a' });
    console.log(`[proxy-trim] ${action}: ${originalTokens} → ${finalTokens} tokens (dropped ${droppedRounds} rounds)`);
  } catch (logError) {
    console.error(`[proxy-trim] 无法写入trim日志: ${logError.message}`);
  }
}

/** 近似 tokenizer:中文 ≈ 0.4 tok/char, 英文/JSON ≈ 0.25 tok/char。
 *  不依赖 tiktoken(避免新增依赖),精度 ±10% 足够做预算守卫。*/
function estimateTokens(s: string): number {
  if (!s) return 0
  let zh = 0, other = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0x4e00 && c <= 0x9fff) zh++
    else other++
  }
  return Math.ceil(zh * 0.6 + other * 0.28)
}

function estimateMessagesTokens(messages: any[], tools?: any[]): number {
  let t = 0
  for (const m of messages) {
    t += 4 // role overhead
    if (typeof m.content === 'string') t += estimateTokens(m.content)
    else if (Array.isArray(m.content)) {
      for (const b of m.content) t += estimateTokens(JSON.stringify(b))
    }
    if (m.tool_calls) t += estimateTokens(JSON.stringify(m.tool_calls))
    if (m.tool_call_id) t += estimateTokens(m.tool_call_id)
  }
  if (tools?.length) t += estimateTokens(JSON.stringify(tools))
  return t
}

/** 舍弃旧的大 tool result,保留最近 N 轮。保留 system/最后一条 user。*/
function dropOldToolResults(messages: any[], keepLastN = 6): { messages: any[], dropped: number } {
  let dropped = 0
  // 找到最后 N 条非 system 消息的起点
  const nonSystem = messages.filter(m => m.role !== 'system')
  const cutIdx = Math.max(0, nonSystem.length - keepLastN)
  const cutMsg = nonSystem[cutIdx]
  let reachedCut = false
  const out = messages.map(m => {
    if (m === cutMsg) reachedCut = true
    if (!reachedCut && m.role === 'tool' && typeof m.content === 'string' && m.content.length > 200) {
      dropped += m.content.length
      return { ...m, content: '[Old tool result cleared by budget guard]' }
    }
    return m
  })
  return { messages: out, dropped }
}

/** 硬截断:只保留 system + tools 定义 + 最后 8 轮。兜底,数据可能丢。*/
function hardTruncate(messages: any[], keepLastRounds = 8): any[] {
  const systems = messages.filter(m => m.role === 'system')
  const rest = messages.filter(m => m.role !== 'system')
  const tail = rest.slice(-keepLastRounds * 2) // user+assistant 算一轮
  return [...systems, ...tail]
}

type BudgetResult = { action: string; promptTok: number; maxTok: number; ctxMax: number }

function applyBudget(oaiBody: any): BudgetResult {
  const modelMax = MAX_OUTPUT_TOKENS[oaiBody.model] ?? 8192
  let maxTok = Math.min(oaiBody.max_tokens ?? modelMax, modelMax)
  const originalPromptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools)
  let promptTok = originalPromptTok
  let action = 'passthrough'
  let droppedRounds = 0

  // L1/L2 · 压缩旧 tool result
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    const r = dropOldToolResults(oaiBody.messages, 6)
    oaiBody.messages = r.messages
    promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools)
    if (r.dropped > 0) {
      action = 'compacted'
      logTrim('compacted', originalPromptTok, promptTok, 0, `dropped ${r.dropped} chars from tool results`)
    }
  }

  // L3 · 缩小 output 配额
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    const newMax = Math.max(1024, CTX_MAX - promptTok - SAFETY_MARGIN)
    if (newMax < maxTok) {
      const oldMax = maxTok
      maxTok = newMax
      action = action === 'compacted' ? 'compacted+shrunk' : 'output_shrunk'
      logTrim('output_shrunk', originalPromptTok, promptTok, 0, `max_tokens ${oldMax} → ${maxTok}`)
    }
  }

  // L4 · 硬截断 (保留最后8轮对话)
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    const originalMessages = [...oaiBody.messages]
    const originalCount = originalMessages.length
    oaiBody.messages = hardTruncate(oaiBody.messages, 8)
    const finalCount = oaiBody.messages.length
    promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools)
    action = 'truncated'
    droppedRounds = Math.floor((originalCount - finalCount) / 2) // 估算丢弃的轮数
    logTrim('truncated', originalPromptTok, promptTok, droppedRounds, `messages ${originalCount} → ${finalCount}, keep last 8 rounds`)
  }

  oaiBody.max_tokens = maxTok

  // 记录任何trim操作
  if (action !== 'passthrough') {
    console.log(`[proxy-budget] ${action}: ${originalPromptTok} → ${promptTok} tokens, max_tokens=${maxTok}`);
  }

  return { action, promptTok, maxTok, ctxMax: CTX_MAX }
}

const MODEL_MAP: Record<string, string> = {
  'claude-opus-4-6':            'deepseek-reasoner',
  'claude-sonnet-4-6':          'deepseek-chat',
  'claude-haiku-4-5-20251001':  'deepseek-chat',
  'claude-3-5-sonnet-20241022': 'deepseek-chat',
  'claude-3-5-haiku-20241022':  'deepseek-chat',
  'claude-3-opus-20240229':     'deepseek-reasoner',
}

function mapModel(model: string): string {
  return MODEL_MAP[model] ?? 'deepseek-chat'
}

// ── TASK-INFRA-3: History Auto-Summary ──────────────────────────────────

/**
 * 自动摘要历史消息
 * 当消息超过 80K tokens 时，将最早的 N 轮对话摘要为单条 system message
 */
function autoSummarizeHistory(messages: any[]): any[] {
  if (messages.length <= 10) {
    // 消息太少，不需要摘要
    return messages;
  }

  // 保留最后的 5 轮对话（10条消息，user+assistant 各一条算一轮）
  const keepRounds = 5;
  const keepCount = keepRounds * 2; // 每轮2条消息

  if (messages.length <= keepCount) {
    return messages;
  }

  // 分离 system 消息和其他消息
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  // 保留最后的 keepCount 条非 system 消息
  // [INFRA-5-v3] 截断点不能切在 assistant(tool_calls) 和 tool 之间
  // 向前扩展 recentMessages 直到第一条不是孤儿 tool
  let cutIdx = Math.max(0, otherMessages.length - keepCount);
  // 如果截断点后的第一条是 tool，往前找到它的 assistant
  while (cutIdx > 0 && otherMessages[cutIdx]?.role === 'tool') {
    cutIdx--;
  }
  const recentMessages = otherMessages.slice(cutIdx);

  // 需要摘要的早期消息
  const earlyMessages = otherMessages.slice(0, cutIdx);

  if (earlyMessages.length === 0) {
    return [...systemMessages, ...recentMessages];
  }

  // 创建摘要消息
  const summaryMessage = {
    role: 'system',
    content: createHistorySummary(earlyMessages)
  };

  // [INFRA-5-v3] 摘要后再跑一遍孤儿清理，兜底
  const merged = [...systemMessages, summaryMessage, ...recentMessages];
  const cleaned: any[] = [];
  for (const msg of merged) {
    if (msg.role === 'tool') {
      const prev = cleaned[cleaned.length - 1];
      const ok = (prev?.role === 'assistant' && Array.isArray(prev.tool_calls) && prev.tool_calls.length > 0)
                 || prev?.role === 'tool';
      if (!ok) continue; // 丢弃孤儿 tool
    }
    cleaned.push(msg);
  }
  return cleaned;
}

/**
 * 创建历史对话摘要
 */
function createHistorySummary(messages: any[]): string {
  // 统计对话轮次
  let rounds = 0;
  let lastRole = '';

  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      if (msg.role !== lastRole) {
        if (msg.role === 'user') {
          rounds++;
        }
        lastRole = msg.role;
      }
    }
  }

  // 提取关键信息：工具调用次数
  const toolCalls = messages.filter(m =>
    m.role === 'assistant' &&
    Array.isArray(m.tool_calls) &&
    m.tool_calls.length > 0
  ).length;

  // 创建摘要
  const summary = [
    '=== 历史对话摘要 ===',
    `总对话轮次: ${rounds}`,
    `工具调用次数: ${toolCalls}`,
    `消息总数: ${messages.length}`,
    '',
    '（早期对话已自动摘要以节省上下文空间，',
    '如需查看完整历史，请告知助手。）'
  ].join('\n');

  return summary;
}

// ── Anthropic → OpenAI conversion ─────────────────────────────────────────

// M1-P0 #6: 确定性键排序 —— 保护 DeepSeek prompt cache
// 同一个 tool schema 每次序列化出的字节序列必须完全一致,否则缓存 miss
function sortKeysDeep(v: any): any {
  if (v === null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(sortKeysDeep)
  const out: any = {}
  for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k])
  return out
}

function convertTools(anthropicTools: any[]): any[] {
  // 先按 name 排序,确保数组顺序跨请求稳定(Claude Code 偶尔会乱序)
  const sortedTools = [...anthropicTools].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  )
  return sortedTools.map(tool => {
    const fn = {
      name: tool.name,
      description: tool.description ?? '',
      parameters: sortKeysDeep(tool.input_schema ?? { type: 'object', properties: {} }),
      // DeepSeek Strict Mode: 服务器端校验 JSON Schema,防止工具调用崩
      strict: true,
    }
    return { type: 'function', function: fn }
  })
}

// M1-P0 #6: system prompt whitespace 标准化(保留语义,稳定字节序)
function normalizeSystemPrompt(s: string): string {
  return s
    .replace(/\r\n/g, '\n')       // CRLF → LF
    .replace(/[ \t]+\n/g, '\n')   // 行尾空白
    .replace(/\n{3,}/g, '\n\n')   // 三空行压缩为两
    .trimEnd()
}

function convertToolChoice(tc: any): any {
  if (!tc) return undefined
  if (tc.type === 'auto') return 'auto'
  if (tc.type === 'any') return 'required'
  if (tc.type === 'tool') return { type: 'function', function: { name: tc.name } }
  return 'auto'
}

function extractTextContent(content: any): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text ?? '')
      .join('\n')
  }
  return ''
}

/**
 * M1-P0 #4: 检测最后一条消息是否为"新用户问题"。
 * 如果是,按 DeepSeek R1 官方规则,应清除历史 assistant 的 reasoning_content。
 * 如果最后是 tool_result(延续性 tool-use 循环),则必须保留 reasoning_content。
 */
function isNewUserQuestion(messages: any[]): boolean {
  if (messages.length === 0) return false
  const last = messages[messages.length - 1]
  if (last.role !== 'user') return false
  if (typeof last.content === 'string') return last.content.trim().length > 0
  if (Array.isArray(last.content)) {
    // 只含 tool_result 说明是 tool 循环的延续,不是新问题
    const hasText = last.content.some((b: any) => b.type === 'text')
    const onlyToolResults = last.content.every((b: any) => b.type === 'tool_result')
    return hasText && !onlyToolResults
  }
  return false
}

/**
 * Converts an Anthropic messages array to OpenAI messages array.
 * Handles: text, tool_use, tool_result, thinking, multi-content blocks.
 * tool_result blocks (inside user messages) become standalone role=tool messages.
 */
function convertMessages(
  anthropicMessages: any[],
  system?: any,
): any[] {
  const result: any[] = []
  // M1-P0 #4: 新用户问题到来 → 清除历史 reasoning_content(DeepSeek 官方规则)
  const clearOldReasoning = isNewUserQuestion(anthropicMessages)

  // System prompt(#6: 字节序标准化,保护 cache hit)
  if (system) {
    const text = Array.isArray(system)
      ? system.map((s: any) => s.text ?? '').join('\n')
      : String(system)
    const normalized = normalizeSystemPrompt(text)
    if (normalized) result.push({ role: 'system', content: normalized })
  }

  for (const msg of anthropicMessages) {
    const content = msg.content

    if (msg.role === 'user') {
      // User message may contain tool_result blocks mixed with text
      if (Array.isArray(content)) {
        const toolResults = content.filter((b: any) => b.type === 'tool_result')
        const textBlocks = content.filter((b: any) => b.type !== 'tool_result')

        // [INFRA-5-EMERGENCY 2026-04-12] 重排序修复 DeepSeek 400 孤儿 tool_calls
        // DeepSeek 严格要求 assistant.tool_calls 后必须紧跟所有 tool 消息,中间不能插入 user
        // 因此先 emit tool 消息(配对前一条 assistant.tool_calls),再 emit user 文本
        for (const tr of toolResults) {
          const toolContent = Array.isArray(tr.content)
            ? tr.content.map((c: any) => c.text ?? '').join('\n')
            : typeof tr.content === 'string'
              ? tr.content
              : JSON.stringify(tr.content ?? '')
          // [R-SHELL-SANITIZE] 把 exit 127 / command not found 降级为标准错误,避免污染上下文
          const sanitizedContent =
            /^(?:exit 127|.*command not found|bash: .* not found)/i.test(toolContent.trim())
              ? '[R-SHELL-VIOLATION] GNU tool not available in bun shell; use Read/Grep/Glob tools instead'
              : toolContent
          result.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id,
            content: sanitizedContent,
          })
        }

        // Text parts become a normal user message (pushed AFTER tool messages)
        if (textBlocks.length > 0) {
          const text = textBlocks
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text ?? '')
            .join('\n')
          if (text.trim()) result.push({ role: 'user', content: text })
        }
      } else {
        result.push({ role: 'user', content: extractTextContent(content) })
      }
    } else if (msg.role === 'assistant') {
      // Assistant message may contain text/tool_use/thinking blocks
      if (Array.isArray(content)) {
        const textBlocks = content.filter((b: any) => b.type === 'text')
        const toolUseBlocks = content.filter((b: any) => b.type === 'tool_use')
        // M1-P0 #4: R1 thinking block 回传 —— 维持 R1 多轮思维链,否则每步失忆
        const thinkingBlocks = content.filter((b: any) => b.type === 'thinking')

        const text = textBlocks.map((b: any) => b.text ?? '').join('\n')
        const toolCalls = toolUseBlocks.map((b: any) => ({
          id: b.id,
          type: 'function',
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input ?? {}),
          },
        }))
        const reasoning = thinkingBlocks.map((b: any) => b.thinking ?? '').join('\n')

        const oaiMsg: any = { role: 'assistant' }
        if (text) oaiMsg.content = text
        if (toolCalls.length > 0) oaiMsg.tool_calls = toolCalls
        // #4: 仅在同一问题的 tool 循环中保留,新用户问题进来清空
        if (reasoning && !clearOldReasoning) oaiMsg.reasoning_content = reasoning
        result.push(oaiMsg)
      } else {
        result.push({ role: 'assistant', content: extractTextContent(content) })
      }
    }
  }

  // M1-P0 #7: 孤儿 tool_call 消毒
  // DeepSeek 严格校验:assistant.tool_calls 后面必须紧跟每个 tool_call_id 对应的 role=tool 消息
  // 中断恢复 / 历史截断 / 会话压缩会留下没有配对的 tool_call,直接 400
  // 规则:从后往前扫,遇到 assistant.tool_calls,检查紧接后续的 role=tool 是否覆盖全部 id
  //       缺失任何一个 → 删除该 assistant 消息的 tool_calls 字段(保留 content),或整条删掉
  return sanitizeOrphanToolCalls(result)
}

function sanitizeOrphanToolCalls(msgs: any[]): any[] {
  // [INFRA-5-EMERGENCY 2026-04-12] 两遍扫描加固版
  // 遍 1:对每个 assistant.tool_calls,在整个剩余序列里搜索匹配的 tool 消息,
  //       允许它们被 user/assistant 文本消息间隔,然后在输出里强制重排成
  //       assistant → tool → tool ... → 其它,满足 DeepSeek 严格顺序要求。
  // 遍 2:丢弃任何没有前驱配对的顶层 tool 消息。
  const out: any[] = []
  const consumedToolIdx = new Set<number>()

  for (let i = 0; i < msgs.length; i++) {
    if (consumedToolIdx.has(i)) continue
    const m = msgs[i]

    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      // 在 [i+1, 下一个 assistant 之前] 范围里搜集所有 tool 消息
      const needed = new Set<string>(m.tool_calls.map((tc: any) => tc.id))
      const matchedToolMsgs: any[] = []
      const matchedIdx: number[] = []

      for (let j = i + 1; j < msgs.length; j++) {
        if (msgs[j].role === 'assistant') break
        if (msgs[j].role === 'tool' && msgs[j].tool_call_id && needed.has(msgs[j].tool_call_id)) {
          matchedToolMsgs.push(msgs[j])
          matchedIdx.push(j)
          needed.delete(msgs[j].tool_call_id)
          if (needed.size === 0) break
        }
      }

      if (needed.size === 0) {
        // 全部配对:push assistant + 重排后的 tool 消息
        out.push(m)
        for (const tm of matchedToolMsgs) out.push(tm)
        for (const idx of matchedIdx) consumedToolIdx.add(idx)
        continue
      }

      // 部分或全部孤儿:剥 tool_calls,保留文本
      try {
        const log =
          `[${new Date().toISOString()}] orphan tool_calls stripped: ` +
          `missing=${[...needed].join(',')} at msg index ${i}\n`
        require('fs').appendFileSync('.dsevo/tool-orphan.log', log)
      } catch {
        /* noop */
      }
      if (m.content && String(m.content).trim()) {
        const clone = { ...m }
        delete clone.tool_calls
        out.push(clone)
      }
      // 已配上的 tool 消息也算数(下一轮 assistant 不会再用),丢弃
      for (const idx of matchedIdx) consumedToolIdx.add(idx)
      continue
    }

    // 顶层 role=tool 必须有前驱 assistant.tool_calls 配对,否则丢
    if (m.role === 'tool') {
      const prev = out[out.length - 1]
      const hasMatchingCall =
        prev &&
        prev.role === 'assistant' &&
        Array.isArray(prev.tool_calls) &&
        prev.tool_calls.some((tc: any) => tc.id === m.tool_call_id)
      if (!hasMatchingCall) continue
    }
    out.push(m)
  }

  // [INFRA-5-v2] 最终兜底:暴力验证每条 tool 消息的前驱合法性
  // 不管 sanitizer 内部逻辑如何,最终输出必须满足 DeepSeek 严格规则:
  //   - role='tool' 只能出现在 role='assistant'(有 tool_calls)之后
  //   - 或紧跟另一条 role='tool'（同一组连续 tool）
  const validated: any[] = []
  for (let k = 0; k < out.length; k++) {
    const msg = out[k]
    if (msg.role === 'tool') {
      const prev = validated[validated.length - 1]
      const prevIsAssistantWithCalls = prev?.role === 'assistant' && Array.isArray(prev.tool_calls) && prev.tool_calls.length > 0
      const prevIsTool = prev?.role === 'tool'
      if (!prevIsAssistantWithCalls && !prevIsTool) {
        // 非法位置的 tool 消息,丢弃
        try {
          require('fs').appendFileSync('.dsevo/tool-orphan.log',
            `[${new Date().toISOString()}] FINAL-GATE dropped tool msg at pos ${k}, ` +
            `tool_call_id=${msg.tool_call_id}, prev_role=${prev?.role}\n`)
        } catch { /* noop */ }
        continue
      }
    }
    validated.push(msg)
  }
  return validated
}

// M1-P0 #5: R1 指令 hint(官方最佳实践:指令放 user role + 鼓励并行工具)
// 安全版:不动 system prompt(保护 cache),只在最后一条 user 消息前追加一小段 hint
const R1_HINT =
  '[DeepSeek-R1 hints: (1) Think step by step internally; (2) Be explicit about ' +
  'the output format; (3) When reading or searching multiple files, prefer parallel ' +
  'tool calls (up to 8 per turn) instead of sequential ones; (4) If a previous ' +
  'attempt failed, try a completely different approach.]\n\n'

function injectR1Hint(messages: any[]): void {
  // 仅对 reasoner 路由生效,由调用方判断
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    if (typeof m.content === 'string') {
      // 避免重复注入
      if (m.content.startsWith('[DeepSeek-R1 hints:')) return
      m.content = R1_HINT + m.content
      return
    }
    // tool_result-only 的 user 消息跳过,往前找真正的文本型 user 消息
  }
}

function anthropicToOpenAI(body: any): { oaiBody: any; budget: BudgetResult } {
  const dsModel = mapModel(body.model)
  const maxLimit = MAX_OUTPUT_TOKENS[dsModel] ?? 8192
  const oaiBody: any = {
    model: dsModel,
    messages: convertMessages(body.messages, body.system),
    max_tokens: Math.min(body.max_tokens ?? maxLimit, maxLimit),
    stream: body.stream ?? false,
  }
  if (body.temperature !== undefined) oaiBody.temperature = body.temperature
  if (body.tools?.length) {
    oaiBody.tools = convertTools(body.tools)
    if (body.tool_choice) oaiBody.tool_choice = convertToolChoice(body.tool_choice)
  }
  if (body.stop_sequences?.length) oaiBody.stop = body.stop_sequences

  // #5: R1 路由时注入指令 hint
  if (dsModel === 'deepseek-reasoner') injectR1Hint(oaiBody.messages)

  // ── TASK-INFRA-3: History Auto-Summary ──
  // 当 messages 累计 > 80K tokens，自动把最早的 N 轮摘要替换为单条 system message
  const estimatedTokens = estimateMessagesTokens(oaiBody.messages, oaiBody.tools);
  if (estimatedTokens > 80000) {
    oaiBody.messages = autoSummarizeHistory(oaiBody.messages);
  }

  // ── Token Budget Guard ──
  const budget = applyBudget(oaiBody)
  return { oaiBody, budget }
}

// ── OpenAI → Anthropic conversion ─────────────────────────────────────────

function openAIToAnthropic(oaiResp: any, originalModel: string) {
  const choice = oaiResp.choices?.[0]
  const content: any[] = []

  // R1 思维链 → Anthropic thinking block(M1-P0-1)
  const reasoning = choice?.message?.reasoning_content
  if (reasoning) content.push({ type: 'thinking', thinking: reasoning, signature: '' })

  const text = choice?.message?.content
  if (text) content.push({ type: 'text', text })

  const toolCalls = choice?.message?.tool_calls
  if (toolCalls?.length) {
    for (const tc of toolCalls) {
      // P0-A: 使用json-repair补丁解析tool call参数
      const input = parseToolCallArguments(tc.function?.arguments ?? '{}')
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function?.name,
        input,
      })
    }
  }

  const finishReason = choice?.finish_reason
  const stopReason =
    finishReason === 'tool_calls' ? 'tool_use'
    : finishReason === 'stop' ? 'end_turn'
    : finishReason ?? 'end_turn'

  return {
    id: oaiResp.id ?? `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model: originalModel,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: oaiResp.usage?.prompt_tokens ?? 0,
      output_tokens: oaiResp.usage?.completion_tokens ?? 0,
    },
  }
}

// ── Streaming ──────────────────────────────────────────────────────────────

function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
}

async function streamDeepSeekToAnthropic(
  oaiBody: any,
  originalModel: string,
  writer: WritableStreamDefaultWriter<Uint8Array>,
) {
  const enc = new TextEncoder()
  const write = (s: string) => writer.write(enc.encode(s))

  const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({ ...oaiBody, stream: true }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    console.error('[proxy] DeepSeek stream error:', resp.status, err)
    // [INFRA-5-v2] 400 诊断 dump:保存触发 400 的完整请求
    if (resp.status === 400) {
      try {
        const dump = JSON.stringify({ ts: new Date().toISOString(), status: 400, error: err, messageCount: oaiBody.messages?.length, messages: oaiBody.messages?.map((m: any) => ({ role: m.role, hasToolCalls: !!m.tool_calls, toolCallIds: m.tool_calls?.map((tc: any) => tc.id), tool_call_id: m.tool_call_id, contentLen: typeof m.content === 'string' ? m.content.length : 0 })) }, null, 2)
        require('fs').appendFileSync('.dsevo/deepseek-400.log', dump + '\n---\n')
      } catch { /* noop */ }
    }
    write(sseEvent('error', { type: 'error', error: { type: 'api_error', message: err } }))
    await writer.close()
    return
  }

  const msgId = `msg_${Date.now()}`
  let inputTokens = 0
  let outputTokens = 0
  let blockIndex = 0
  let openBlocks: Set<number> = new Set()

  // Track streaming tool calls: index → {id, name, argsBuf}
  const toolCallBufs: Map<number, { id: string; name: string; args: string }> = new Map()

  write(sseEvent('message_start', {
    type: 'message_start',
    message: {
      id: msgId, type: 'message', role: 'assistant', content: [],
      model: originalModel, stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  }))
  write(sseEvent('ping', { type: 'ping' }))

  // We'll open a text block lazily on first text delta
  let textBlockOpen = false
  const textBlockIdx = blockIndex++

  // R1 thinking block opens lazily on first reasoning_content delta (M1-P0-1)
  let thinkingBlockOpen = false
  let thinkingBlockIdx = -1

  const reader = resp.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let finishReason = 'end_turn'

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue

      let chunk: any
      try { chunk = JSON.parse(payload) } catch { continue }

      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue

      // R1 reasoning delta → Anthropic thinking block (M1-P0-1)
      if (delta.reasoning_content) {
        if (!thinkingBlockOpen) {
          thinkingBlockIdx = blockIndex++
          // 思维链块必须在文本块之前 — 如果文本块还没开,我们提前占位
          write(sseEvent('content_block_start', {
            type: 'content_block_start', index: thinkingBlockIdx,
            content_block: { type: 'thinking', thinking: '' },
          }))
          openBlocks.add(thinkingBlockIdx)
          thinkingBlockOpen = true
        }
        write(sseEvent('content_block_delta', {
          type: 'content_block_delta', index: thinkingBlockIdx,
          delta: { type: 'thinking_delta', thinking: delta.reasoning_content },
        }))
      }

      // Text delta
      if (delta.content) {
        if (!textBlockOpen) {
          write(sseEvent('content_block_start', {
            type: 'content_block_start', index: textBlockIdx,
            content_block: { type: 'text', text: '' },
          }))
          openBlocks.add(textBlockIdx)
          textBlockOpen = true
        }
        write(sseEvent('content_block_delta', {
          type: 'content_block_delta', index: textBlockIdx,
          delta: { type: 'text_delta', text: delta.content },
        }))
        outputTokens++
      }

      // Tool call deltas
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const tcIdx = tc.index ?? 0
          if (!toolCallBufs.has(tcIdx)) {
            // New tool call block
            const toolBlockIdx = blockIndex++
            toolCallBufs.set(tcIdx, { id: tc.id ?? `call_${tcIdx}`, name: tc.function?.name ?? '', args: '' })
            // Store block index mapping
            ;(toolCallBufs.get(tcIdx) as any)._blockIdx = toolBlockIdx
            write(sseEvent('content_block_start', {
              type: 'content_block_start', index: toolBlockIdx,
              content_block: { type: 'tool_use', id: tc.id ?? `call_${tcIdx}`, name: tc.function?.name ?? '', input: {} },
            }))
            openBlocks.add(toolBlockIdx)
          }
          const tcBuf = toolCallBufs.get(tcIdx)!
          if (tc.function?.name && !tcBuf.name) tcBuf.name = tc.function.name
          if (tc.id && !tcBuf.id) tcBuf.id = tc.id
          if (tc.function?.arguments) {
            tcBuf.args += tc.function.arguments
            write(sseEvent('content_block_delta', {
              type: 'content_block_delta', index: (tcBuf as any)._blockIdx,
              delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
            }))
          }
        }
      }

      const fr = chunk.choices?.[0]?.finish_reason
      if (fr) finishReason = fr === 'tool_calls' ? 'tool_use' : fr === 'stop' ? 'end_turn' : fr

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens
        outputTokens = chunk.usage.completion_tokens ?? outputTokens
      }
    }
  }

  // Close all open blocks
  for (const idx of [...openBlocks].sort((a, b) => a - b)) {
    write(sseEvent('content_block_stop', { type: 'content_block_stop', index: idx }))
  }

  write(sseEvent('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: finishReason, stop_sequence: null },
    usage: { output_tokens: outputTokens },
  }))
  write(sseEvent('message_stop', { type: 'message_stop' }))
  await writer.close()

  // TASK-INFRA-6: 记录流式请求成本
  const cacheHit = false; // 流式响应通常没有缓存信息
  logCostToLedger(oaiBody.model, inputTokens, outputTokens, cacheHit);
}

// ── Request handler ────────────────────────────────────────────────────────

async function handleMessages(req: Request): Promise<Response> {
  let body: any
  try { body = await req.json() } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const { oaiBody, budget } = anthropicToOpenAI(body)
  const originalModel: string = body.model

  // TASK-INFRA-6: 检查日预算
  const budgetCheck = checkDailyBudget();
  if (budgetCheck.exceeded) {
    console.error(`[proxy] 日预算超限: ¥${budgetCheck.dailyTotal.toFixed(2)} > ¥50`);
    return Response.json(
      { error: { type: 'daily_budget_exceeded', message: 'DAILY_BUDGET_EXCEEDED' } },
      { status: 402 }
    );
  }

  console.log(
    `[proxy] ${originalModel} → ${oaiBody.model}  ` +
    `stream=${body.stream}  max_tokens=${oaiBody.max_tokens}  ` +
    `tools=${body.tools?.length ?? 0}  msgs=${oaiBody.messages.length}  ` +
    `budget=${budget.action}(in≈${budget.promptTok} out≤${budget.maxTok})`,
  )

  if (body.stream) {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    streamDeepSeekToAnthropic(oaiBody, originalModel, writer).catch(e => {
      console.error('[proxy] stream error:', e)
      writer.close().catch(() => {})
    })
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // Non-streaming
  const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(oaiBody),
  })

  if (!resp.ok) {
    const err = await resp.text()
    console.error('[proxy] DeepSeek error:', resp.status, err)
    // [INFRA-5-v2] 400 诊断 dump
    if (resp.status === 400) {
      try {
        const dump = JSON.stringify({ ts: new Date().toISOString(), status: 400, error: err, messageCount: oaiBody.messages?.length, messages: oaiBody.messages?.map((m: any) => ({ role: m.role, hasToolCalls: !!m.tool_calls, toolCallIds: m.tool_calls?.map((tc: any) => tc.id), tool_call_id: m.tool_call_id, contentLen: typeof m.content === 'string' ? m.content.length : 0 })) }, null, 2)
        require('fs').appendFileSync('.dsevo/deepseek-400.log', dump + '\n---\n')
      } catch { /* noop */ }
    }
    return new Response(err, { status: resp.status })
  }

  const oaiResp = await resp.json()
  const anthropicResp = openAIToAnthropic(oaiResp, originalModel)

  // TASK-INFRA-6: 记录成本到账本
  const inputTokens = oaiResp.usage?.prompt_tokens || 0;
  const outputTokens = oaiResp.usage?.completion_tokens || 0;
  const cacheHit = (oaiResp.usage?.prompt_cache_hit_tokens ?? 0) > 0; // DeepSeek V3 返回 prompt_cache_hit_tokens
  logCostToLedger(oaiBody.model, inputTokens, outputTokens, cacheHit);

  return Response.json(anthropicResp)
}

// ── Server ─────────────────────────────────────────────────────────────────

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
    }
    if (req.method === 'POST' && url.pathname === '/v1/messages') return handleMessages(req)
    if (req.method === 'GET' && url.pathname === '/health') return Response.json({ status: 'ok', port: PORT })
    return new Response('Not found', { status: 404 })
  },
})

console.log(`
╔══════════════════════════════════════════════╗
║   DeepSeek ↔ Anthropic Proxy  :${PORT}        ║
║   Full tool use + streaming support          ║
╚══════════════════════════════════════════════╝
Model map:
  claude-sonnet-*  → deepseek-chat     (8192 out)
  claude-opus-*    → deepseek-reasoner (65536 out)
  claude-haiku-*   → deepseek-chat     (8192 out)

Set env:
  ANTHROPIC_BASE_URL=http://localhost:${PORT}
  ANTHROPIC_API_KEY=placeholder
`)

// ── Crash Handler (TASK-INFRA-2) ────────────────────────────────────────

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CRASH_LOG_DIR = '.dsevo';
const CRASH_LOG_FILE = join(CRASH_LOG_DIR, 'proxy-crash.log');

// 确保日志目录存在
if (!existsSync(CRASH_LOG_DIR)) {
  mkdirSync(CRASH_LOG_DIR, { recursive: true });
}

function logCrash(type: string, error: any) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${type}: ${error?.stack || error?.message || String(error)}\n\n`;

  try {
    writeFileSync(CRASH_LOG_FILE, logEntry, { flag: 'a' });
    console.error(`[proxy-crash] 崩溃已记录到 ${CRASH_LOG_FILE}`);
  } catch (logError) {
    console.error(`[proxy-crash] 无法写入崩溃日志: ${logError.message}`);
  }
}

// 未捕获异常处理器
process.on('uncaughtException', (error) => {
  console.error('[proxy-crash] 未捕获异常:', error);
  logCrash('uncaughtException', error);

  // 给一点时间让日志写入
  setTimeout(() => {
    process.exit(1);
  }, 100);
});

// 未处理的 Promise 拒绝处理器
process.on('unhandledRejection', (reason, promise) => {
  console.error('[proxy-crash] 未处理的 Promise 拒绝:', reason);
  logCrash('unhandledRejection', reason);

  // 给一点时间让日志写入
  setTimeout(() => {
    process.exit(1);
  }, 100);
});

// ── TASK-INFRA-6: Cost Ledger ──────────────────────────────────────────────

// DeepSeek 定价 (CNY per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-chat': { input: 0.14, output: 0.56 },
  'deepseek-reasoner': { input: 0.28, output: 1.12 },
};

// 成本账本文件路径
const COST_LEDGER_FILE = join(CRASH_LOG_DIR, 'cost-ledger.jsonl');
const BUDGET_OVERRIDE_FILE = join(CRASH_LOG_DIR, 'budget-override');

// 确保账本目录存在
if (!existsSync(CRASH_LOG_DIR)) {
  mkdirSync(CRASH_LOG_DIR, { recursive: true });
}

/**
 * 计算请求成本
 */
function calculateCost(model: string, inputTokens: number, outputTokens: number, cacheHit: boolean): number {
  const price = PRICING[model] || PRICING['deepseek-chat'];

  // 缓存命中时，输入 tokens 不计费
  const billedInputTokens = cacheHit ? 0 : inputTokens;

  const inputCost = (billedInputTokens / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;

  return parseFloat((inputCost + outputCost).toFixed(6)); // 保留6位小数精度
}

/**
 * 记录成本到账本
 */
function logCostToLedger(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheHit: boolean = false
): void {
  try {
    const cost = calculateCost(model, inputTokens, outputTokens, cacheHit);
    const timestamp = new Date().toISOString();

    const entry = {
      ts: timestamp,
      model,
      in_tokens: inputTokens,
      out_tokens: outputTokens,
      cache_hit: cacheHit,
      cost_cny: cost,
    };

    appendFileSync(COST_LEDGER_FILE, JSON.stringify(entry) + '\n');
    console.log(`[cost-ledger] 记录: ${model} ${inputTokens}+${outputTokens} tokens = ¥${cost.toFixed(4)}`);

  } catch (error) {
    console.error('[cost-ledger] 记录失败:', error.message);
  }
}

/**
 * 检查日预算是否超限
 * 返回: { exceeded: boolean, dailyTotal: number }
 */
function checkDailyBudget(): { exceeded: boolean; dailyTotal: number } {
  try {
    // 检查是否有预算覆盖文件
    if (existsSync(BUDGET_OVERRIDE_FILE)) {
      console.log('[cost-ledger] 预算覆盖文件存在，跳过预算检查');
      return { exceeded: false, dailyTotal: 0 };
    }

    if (!existsSync(COST_LEDGER_FILE)) {
      return { exceeded: false, dailyTotal: 0 };
    }

    // 读取账本文件
    const fs = require('fs');
    const data = fs.readFileSync(COST_LEDGER_FILE, 'utf8');
    const lines = data.trim().split('\n').filter(line => line.trim());

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let dailyTotal = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const entryDate = entry.ts.split('T')[0];

        if (entryDate === today) {
          dailyTotal += entry.cost_cny;
        }
      } catch (e) {
        // 跳过解析错误的行
        continue;
      }
    }

    const exceeded = dailyTotal > 50; // ¥50 日预算
    console.log(`[cost-ledger] 今日累计: ¥${dailyTotal.toFixed(2)} ${exceeded ? '(超限!)' : ''}`);

    return { exceeded, dailyTotal };

  } catch (error) {
    console.error('[cost-ledger] 预算检查失败:', error.message);
    return { exceeded: false, dailyTotal: 0 };
  }
}

/**
 * 获取账本汇总统计
 */
function getLedgerSummary(): {
  today: { cost: number; requests: number };
  thisMonth: { cost: number; requests: number };
} {
  try {
    if (!existsSync(COST_LEDGER_FILE)) {
      return { today: { cost: 0, requests: 0 }, thisMonth: { cost: 0, requests: 0 } };
    }

    const fs = require('fs');
    const data = fs.readFileSync(COST_LEDGER_FILE, 'utf8');
    const lines = data.trim().split('\n').filter(line => line.trim());

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStr = now.toISOString().substring(0, 7); // YYYY-MM

    let todayCost = 0;
    let todayRequests = 0;
    let monthCost = 0;
    let monthRequests = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const entryDate = entry.ts.substring(0, 10); // YYYY-MM-DD
        const entryMonth = entry.ts.substring(0, 7); // YYYY-MM

        if (entryDate === todayStr) {
          todayCost += entry.cost_cny;
          todayRequests++;
        }

        if (entryMonth === monthStr) {
          monthCost += entry.cost_cny;
          monthRequests++;
        }
      } catch (e) {
        continue;
      }
    }

    return {
      today: { cost: todayCost, requests: todayRequests },
      thisMonth: { cost: monthCost, requests: monthRequests },
    };

  } catch (error) {
    console.error('[cost-ledger] 汇总统计失败:', error.message);
    return { today: { cost: 0, requests: 0 }, thisMonth: { cost: 0, requests: 0 } };
  }
}
