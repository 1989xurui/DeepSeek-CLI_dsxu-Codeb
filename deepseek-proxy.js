// @bun
// deepseek-proxy.ts
var DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "sk-6bcf4f90150144c38ebfb16127d06294";
var DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
var PORT = parseInt(process.env.PROXY_PORT || "8082", 10);
var MAX_OUTPUT_TOKENS = {
  "deepseek-chat": 8192,
  "deepseek-reasoner": 65536
};
var CTX_MAX = 128000;
var SAFETY_MARGIN = 2000;
function estimateTokens(s) {
  if (!s)
    return 0;
  let zh = 0, other = 0;
  for (let i = 0;i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 19968 && c <= 40959)
      zh++;
    else
      other++;
  }
  return Math.ceil(zh * 0.6 + other * 0.28);
}
function estimateMessagesTokens(messages, tools) {
  let t = 0;
  for (const m of messages) {
    t += 4;
    if (typeof m.content === "string")
      t += estimateTokens(m.content);
    else if (Array.isArray(m.content)) {
      for (const b of m.content)
        t += estimateTokens(JSON.stringify(b));
    }
    if (m.tool_calls)
      t += estimateTokens(JSON.stringify(m.tool_calls));
    if (m.tool_call_id)
      t += estimateTokens(m.tool_call_id);
  }
  if (tools?.length)
    t += estimateTokens(JSON.stringify(tools));
  return t;
}
function dropOldToolResults(messages, keepLastN = 6) {
  let dropped = 0;
  const nonSystem = messages.filter((m) => m.role !== "system");
  const cutIdx = Math.max(0, nonSystem.length - keepLastN);
  const cutMsg = nonSystem[cutIdx];
  let reachedCut = false;
  const out = messages.map((m) => {
    if (m === cutMsg)
      reachedCut = true;
    if (!reachedCut && m.role === "tool" && typeof m.content === "string" && m.content.length > 200) {
      dropped += m.content.length;
      return { ...m, content: "[Old tool result cleared by budget guard]" };
    }
    return m;
  });
  return { messages: out, dropped };
}
function hardTruncate(messages, keepLastRounds = 3) {
  const systems = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const tail = rest.slice(-keepLastRounds * 2);
  return [...systems, ...tail];
}
function applyBudget(oaiBody) {
  const modelMax = MAX_OUTPUT_TOKENS[oaiBody.model] ?? 8192;
  let maxTok = Math.min(oaiBody.max_tokens ?? modelMax, modelMax);
  let promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools);
  let action = "passthrough";
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    const r = dropOldToolResults(oaiBody.messages, 6);
    oaiBody.messages = r.messages;
    promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools);
    if (r.dropped > 0)
      action = "compacted";
  }
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    const newMax = Math.max(1024, CTX_MAX - promptTok - SAFETY_MARGIN);
    if (newMax < maxTok) {
      maxTok = newMax;
      action = action === "compacted" ? "compacted+shrunk" : "output_shrunk";
    }
  }
  if (promptTok + maxTok + SAFETY_MARGIN > CTX_MAX) {
    oaiBody.messages = hardTruncate(oaiBody.messages, 3);
    promptTok = estimateMessagesTokens(oaiBody.messages, oaiBody.tools);
    action = "truncated";
  }
  oaiBody.max_tokens = maxTok;
  return { action, promptTok, maxTok, ctxMax: CTX_MAX };
}
var MODEL_MAP = {
  "claude-opus-4-6": "deepseek-reasoner",
  "claude-sonnet-4-6": "deepseek-chat",
  "claude-haiku-4-5-20251001": "deepseek-chat",
  "claude-3-5-sonnet-20241022": "deepseek-chat",
  "claude-3-5-haiku-20241022": "deepseek-chat",
  "claude-3-opus-20240229": "deepseek-reasoner"
};
function mapModel(model) {
  return MODEL_MAP[model] ?? "deepseek-chat";
}
function sortKeysDeep(v) {
  if (v === null || typeof v !== "object")
    return v;
  if (Array.isArray(v))
    return v.map(sortKeysDeep);
  const out = {};
  for (const k of Object.keys(v).sort())
    out[k] = sortKeysDeep(v[k]);
  return out;
}
function convertTools(anthropicTools) {
  const sortedTools = [...anthropicTools].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  return sortedTools.map((tool) => {
    const fn = {
      name: tool.name,
      description: tool.description ?? "",
      parameters: sortKeysDeep(tool.input_schema ?? { type: "object", properties: {} }),
      strict: true
    };
    return { type: "function", function: fn };
  });
}
function normalizeSystemPrompt(s) {
  return s.replace(/\r\n/g, `
`).replace(/[ \t]+\n/g, `
`).replace(/\n{3,}/g, `

`).trimEnd();
}
function convertToolChoice(tc) {
  if (!tc)
    return;
  if (tc.type === "auto")
    return "auto";
  if (tc.type === "any")
    return "required";
  if (tc.type === "tool")
    return { type: "function", function: { name: tc.name } };
  return "auto";
}
function extractTextContent(content) {
  if (typeof content === "string")
    return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b.type === "text").map((b) => b.text ?? "").join(`
`);
  }
  return "";
}
function isNewUserQuestion(messages) {
  if (messages.length === 0)
    return false;
  const last = messages[messages.length - 1];
  if (last.role !== "user")
    return false;
  if (typeof last.content === "string")
    return last.content.trim().length > 0;
  if (Array.isArray(last.content)) {
    const hasText = last.content.some((b) => b.type === "text");
    const onlyToolResults = last.content.every((b) => b.type === "tool_result");
    return hasText && !onlyToolResults;
  }
  return false;
}
function convertMessages(anthropicMessages, system) {
  const result = [];
  const clearOldReasoning = isNewUserQuestion(anthropicMessages);
  if (system) {
    const text = Array.isArray(system) ? system.map((s) => s.text ?? "").join(`
`) : String(system);
    const normalized = normalizeSystemPrompt(text);
    if (normalized)
      result.push({ role: "system", content: normalized });
  }
  for (const msg of anthropicMessages) {
    const content = msg.content;
    if (msg.role === "user") {
      if (Array.isArray(content)) {
        const toolResults = content.filter((b) => b.type === "tool_result");
        const textBlocks = content.filter((b) => b.type !== "tool_result");
        if (textBlocks.length > 0) {
          const text = textBlocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join(`
`);
          if (text.trim())
            result.push({ role: "user", content: text });
        }
        for (const tr of toolResults) {
          const toolContent = Array.isArray(tr.content) ? tr.content.map((c) => c.text ?? "").join(`
`) : typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content ?? "");
          result.push({
            role: "tool",
            tool_call_id: tr.tool_use_id,
            content: toolContent
          });
        }
      } else {
        result.push({ role: "user", content: extractTextContent(content) });
      }
    } else if (msg.role === "assistant") {
      if (Array.isArray(content)) {
        const textBlocks = content.filter((b) => b.type === "text");
        const toolUseBlocks = content.filter((b) => b.type === "tool_use");
        const thinkingBlocks = content.filter((b) => b.type === "thinking");
        const text = textBlocks.map((b) => b.text ?? "").join(`
`);
        const toolCalls = toolUseBlocks.map((b) => ({
          id: b.id,
          type: "function",
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input ?? {})
          }
        }));
        const reasoning = thinkingBlocks.map((b) => b.thinking ?? "").join(`
`);
        const oaiMsg = { role: "assistant" };
        if (text)
          oaiMsg.content = text;
        if (toolCalls.length > 0)
          oaiMsg.tool_calls = toolCalls;
        if (reasoning && !clearOldReasoning)
          oaiMsg.reasoning_content = reasoning;
        result.push(oaiMsg);
      } else {
        result.push({ role: "assistant", content: extractTextContent(content) });
      }
    }
  }
  return sanitizeOrphanToolCalls(result);
}
function sanitizeOrphanToolCalls(msgs) {
  const out = [];
  for (let i = 0;i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const covered = new Set;
      let j = i + 1;
      while (j < msgs.length && msgs[j].role === "tool") {
        if (msgs[j].tool_call_id)
          covered.add(msgs[j].tool_call_id);
        j++;
      }
      const allCovered = m.tool_calls.every((tc) => covered.has(tc.id));
      if (!allCovered) {
        if (m.content && String(m.content).trim()) {
          const clone = { ...m };
          delete clone.tool_calls;
          out.push(clone);
        }
        i = j - 1;
        continue;
      }
    }
    if (m.role === "tool") {
      const prev = out[out.length - 1];
      const hasMatchingCall = prev && prev.role === "assistant" && Array.isArray(prev.tool_calls) && prev.tool_calls.some((tc) => tc.id === m.tool_call_id);
      if (!hasMatchingCall)
        continue;
    }
    out.push(m);
  }
  return out;
}
var R1_HINT = "[DeepSeek-R1 hints: (1) Think step by step internally; (2) Be explicit about " + "the output format; (3) When reading or searching multiple files, prefer parallel " + "tool calls (up to 8 per turn) instead of sequential ones; (4) If a previous " + `attempt failed, try a completely different approach.]

`;
function injectR1Hint(messages) {
  for (let i = messages.length - 1;i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user")
      continue;
    if (typeof m.content === "string") {
      if (m.content.startsWith("[DeepSeek-R1 hints:"))
        return;
      m.content = R1_HINT + m.content;
      return;
    }
  }
}
function anthropicToOpenAI(body) {
  const dsModel = mapModel(body.model);
  const maxLimit = MAX_OUTPUT_TOKENS[dsModel] ?? 8192;
  const oaiBody = {
    model: dsModel,
    messages: convertMessages(body.messages, body.system),
    max_tokens: Math.min(body.max_tokens ?? maxLimit, maxLimit),
    stream: body.stream ?? false
  };
  if (body.temperature !== undefined)
    oaiBody.temperature = body.temperature;
  if (body.tools?.length) {
    oaiBody.tools = convertTools(body.tools);
    if (body.tool_choice)
      oaiBody.tool_choice = convertToolChoice(body.tool_choice);
  }
  if (body.stop_sequences?.length)
    oaiBody.stop = body.stop_sequences;
  if (dsModel === "deepseek-reasoner")
    injectR1Hint(oaiBody.messages);
  const budget = applyBudget(oaiBody);
  return { oaiBody, budget };
}
function openAIToAnthropic(oaiResp, originalModel) {
  const choice = oaiResp.choices?.[0];
  const content = [];
  const reasoning = choice?.message?.reasoning_content;
  if (reasoning)
    content.push({ type: "thinking", thinking: reasoning, signature: "" });
  const text = choice?.message?.content;
  if (text)
    content.push({ type: "text", text });
  const toolCalls = choice?.message?.tool_calls;
  if (toolCalls?.length) {
    for (const tc of toolCalls) {
      let input = {};
      try {
        input = JSON.parse(tc.function?.arguments ?? "{}");
      } catch {}
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function?.name,
        input
      });
    }
  }
  const finishReason = choice?.finish_reason;
  const stopReason = finishReason === "tool_calls" ? "tool_use" : finishReason === "stop" ? "end_turn" : finishReason ?? "end_turn";
  return {
    id: oaiResp.id ?? `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    model: originalModel,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: oaiResp.usage?.prompt_tokens ?? 0,
      output_tokens: oaiResp.usage?.completion_tokens ?? 0
    }
  };
}
function sseEvent(type, data) {
  return `event: ${type}
data: ${JSON.stringify(data)}

`;
}
async function streamDeepSeekToAnthropic(oaiBody, originalModel, writer) {
  const enc = new TextEncoder;
  const write = (s) => writer.write(enc.encode(s));
  const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({ ...oaiBody, stream: true })
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("[proxy] DeepSeek stream error:", resp.status, err);
    write(sseEvent("error", { type: "error", error: { type: "api_error", message: err } }));
    await writer.close();
    return;
  }
  const msgId = `msg_${Date.now()}`;
  let inputTokens = 0;
  let outputTokens = 0;
  let blockIndex = 0;
  let openBlocks = new Set;
  const toolCallBufs = new Map;
  write(sseEvent("message_start", {
    type: "message_start",
    message: {
      id: msgId,
      type: "message",
      role: "assistant",
      content: [],
      model: originalModel,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 }
    }
  }));
  write(sseEvent("ping", { type: "ping" }));
  let textBlockOpen = false;
  const textBlockIdx = blockIndex++;
  let thinkingBlockOpen = false;
  let thinkingBlockIdx = -1;
  const reader = resp.body.getReader();
  const dec = new TextDecoder;
  let buf = "";
  let finishReason = "end_turn";
  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split(`
`);
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:"))
        continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]")
        continue;
      let chunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta)
        continue;
      if (delta.reasoning_content) {
        if (!thinkingBlockOpen) {
          thinkingBlockIdx = blockIndex++;
          write(sseEvent("content_block_start", {
            type: "content_block_start",
            index: thinkingBlockIdx,
            content_block: { type: "thinking", thinking: "" }
          }));
          openBlocks.add(thinkingBlockIdx);
          thinkingBlockOpen = true;
        }
        write(sseEvent("content_block_delta", {
          type: "content_block_delta",
          index: thinkingBlockIdx,
          delta: { type: "thinking_delta", thinking: delta.reasoning_content }
        }));
      }
      if (delta.content) {
        if (!textBlockOpen) {
          write(sseEvent("content_block_start", {
            type: "content_block_start",
            index: textBlockIdx,
            content_block: { type: "text", text: "" }
          }));
          openBlocks.add(textBlockIdx);
          textBlockOpen = true;
        }
        write(sseEvent("content_block_delta", {
          type: "content_block_delta",
          index: textBlockIdx,
          delta: { type: "text_delta", text: delta.content }
        }));
        outputTokens++;
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const tcIdx = tc.index ?? 0;
          if (!toolCallBufs.has(tcIdx)) {
            const toolBlockIdx = blockIndex++;
            toolCallBufs.set(tcIdx, { id: tc.id ?? `call_${tcIdx}`, name: tc.function?.name ?? "", args: "" });
            toolCallBufs.get(tcIdx)._blockIdx = toolBlockIdx;
            write(sseEvent("content_block_start", {
              type: "content_block_start",
              index: toolBlockIdx,
              content_block: { type: "tool_use", id: tc.id ?? `call_${tcIdx}`, name: tc.function?.name ?? "", input: {} }
            }));
            openBlocks.add(toolBlockIdx);
          }
          const tcBuf = toolCallBufs.get(tcIdx);
          if (tc.function?.name && !tcBuf.name)
            tcBuf.name = tc.function.name;
          if (tc.id && !tcBuf.id)
            tcBuf.id = tc.id;
          if (tc.function?.arguments) {
            tcBuf.args += tc.function.arguments;
            write(sseEvent("content_block_delta", {
              type: "content_block_delta",
              index: tcBuf._blockIdx,
              delta: { type: "input_json_delta", partial_json: tc.function.arguments }
            }));
          }
        }
      }
      const fr = chunk.choices?.[0]?.finish_reason;
      if (fr)
        finishReason = fr === "tool_calls" ? "tool_use" : fr === "stop" ? "end_turn" : fr;
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
        outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      }
    }
  }
  for (const idx of [...openBlocks].sort((a, b) => a - b)) {
    write(sseEvent("content_block_stop", { type: "content_block_stop", index: idx }));
  }
  write(sseEvent("message_delta", {
    type: "message_delta",
    delta: { stop_reason: finishReason, stop_sequence: null },
    usage: { output_tokens: outputTokens }
  }));
  write(sseEvent("message_stop", { type: "message_stop" }));
  await writer.close();
}
async function handleMessages(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const { oaiBody, budget } = anthropicToOpenAI(body);
  const originalModel = body.model;
  console.log(`[proxy] ${originalModel} \u2192 ${oaiBody.model}  ` + `stream=${body.stream}  max_tokens=${oaiBody.max_tokens}  ` + `tools=${body.tools?.length ?? 0}  msgs=${oaiBody.messages.length}  ` + `budget=${budget.action}(in\u2248${budget.promptTok} out\u2264${budget.maxTok})`);
  if (body.stream) {
    const { readable, writable } = new TransformStream;
    const writer = writable.getWriter();
    streamDeepSeekToAnthropic(oaiBody, originalModel, writer).catch((e) => {
      console.error("[proxy] stream error:", e);
      writer.close().catch(() => {});
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  const resp = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(oaiBody)
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("[proxy] DeepSeek error:", resp.status, err);
    return new Response(err, { status: resp.status });
  }
  const oaiResp = await resp.json();
  return Response.json(openAIToAnthropic(oaiResp, originalModel));
}
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
    }
    if (req.method === "POST" && url.pathname === "/v1/messages")
      return handleMessages(req);
    if (req.method === "GET" && url.pathname === "/health")
      return Response.json({ status: "ok", port: PORT });
    return new Response("Not found", { status: 404 });
  }
});
console.log(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551   DeepSeek \u2194 Anthropic Proxy  :${PORT}        \u2551
\u2551   Full tool use + streaming support          \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
Model map:
  claude-sonnet-*  \u2192 deepseek-chat     (8192 out)
  claude-opus-*    \u2192 deepseek-reasoner (65536 out)
  claude-haiku-*   \u2192 deepseek-chat     (8192 out)

Set env:
  ANTHROPIC_BASE_URL=http://localhost:${PORT}
  ANTHROPIC_API_KEY=placeholder
`);
