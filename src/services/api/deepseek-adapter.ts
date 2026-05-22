import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../../constants/prompts.js';
import {
  estimateDeepSeekV4Cost,
  normalizeDeepSeekV4Model,
  type DeepSeekV4ApiMode,
  type DeepSeekV4EndpointKind,
  type DeepSeekV4Model,
  type DeepSeekV4ReasoningEffort,
  type DeepSeekV4RouteDecision,
  type DeepSeekV4RouteInput,
} from '../../utils/model/deepseekV4Control.js';
import { resolveDeepSeekV4CostRoute } from '../../utils/model/deepseekV4CostRouter.js';

export interface DeepSeekRequestPlan {
  baseUrl: string
  isOpenRouter: boolean
  requestedModel: DeepSeekV4Model
  modelName: string
  apiMode: DeepSeekV4ApiMode
  thinkingEnabled: boolean
  reasoningEffort?: DeepSeekV4ReasoningEffort
  endpointKind: DeepSeekV4EndpointKind
  maxTokens: number
  routeDecision?: DeepSeekV4RouteDecision
  routeReason: string
  modelEvidence: string
}

function appendDeepSeekRouteTrace(event: string, payload: Record<string, unknown>): void {
  const tracePath = process.env.DSXU_ROUTE_TRACE_FILE;
  if (!tracePath) return;
  try {
    mkdirSync(dirname(tracePath), { recursive: true });
    appendFileSync(
      tracePath,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        event,
        ...payload,
      })}\n`,
      'utf8',
    );
  } catch {
    // Route tracing is diagnostic-only and must never affect model calls.
  }
}

/**
 * DeepSeek transport adapter for DSXU Code.
 *
 * Responsibilities:
 * - Normalize DeepSeek chat-completions-style responses into DSXU message blocks.
 * - Recover tool-use blocks from XML and free-form fallback text.
 * - Normalize usage and cost accounting fields for the mainline runtime.
 */
export class DeepSeekAdapter {
  static extractToolUsesFromText(text: string): Array<{
    id: string
    name: string
    input: Record<string, unknown>
  }> {
    const calls: Array<{
      id: string
      name: string
      input: Record<string, unknown>
      position: number
      sequence: number
    }> = [];
    const seen = new Set<string>();
    let sequence = 0;
    const push = (name: string, input: Record<string, unknown>, position: number) => {
      const normalizedName = DeepSeekAdapter.normalizeToolName(name);
      if (!normalizedName) return;
      const key = `${position}:${normalizedName}:${JSON.stringify(input)}`;
      if (seen.has(key)) return;
      seen.add(key);
      calls.push({
        id: `dsxu_tool_${calls.length + 1}_${Date.now()}`,
        name: normalizedName,
        input,
        position,
        sequence: sequence++,
      });
    };

    const toolCallPattern =
      /<tool_call\s+name=["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/tool_call>/gi;
    for (const match of text.matchAll(toolCallPattern)) {
      const name = match[1] || '';
      const body = (match[2] || '').trim();
      const parsed = DeepSeekAdapter.parseToolPayload(body, name);
      if (parsed) push(name, parsed, match.index ?? 0);
    }

    const simpleTagPattern =
      /<(Read|FileRead|Bash|Shell|PowerShell|PowerShellTool|Write|FileWrite|Edit|FileEdit|Glob|Grep|TodoWrite|Todo|TaskCreate|TaskCreateTool|TaskGet|TaskGetTool|TaskList|TaskListTool|TaskUpdate|TaskUpdateTool|Agent|Task|ForkAgent|SendMessage|SendMessageTool|Skill|SkillTool|MCP|MCPTool|ListMcpResourcesTool|ReadMcpResourceTool|LSP|LSPTool|Workflow|WorkflowTool|AskUser|AskUserQuestion|AskUserQuestionTool|NotebookEdit|NotebookEditTool|Config|ConfigTool|EnterPlanMode|EnterPlanModeTool|ExitPlanMode|ExitPlanModeTool|ReadEditTool|BashTool)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    for (const match of text.matchAll(simpleTagPattern)) {
      const name = match[1] || '';
      const body = match[2] || '';
      const parsed = DeepSeekAdapter.parseXmlToolBody(name, body);
      if (parsed) push(name, parsed, match.index ?? 0);
    }

    const readOperationPattern =
      /<ReadOperation\b[^>]*>([\s\S]*?)<\/ReadOperation>/gi;
    for (const match of text.matchAll(readOperationPattern)) {
      const body = match[1] || '';
      for (const filePath of DeepSeekAdapter.extractTagValues(body, 'path')) {
        push('Read', { file_path: filePath }, match.index ?? 0);
      }
    }

    return calls
      .sort((left, right) => left.position - right.position || left.sequence - right.sequence)
      .map(({ position: _position, sequence: _sequence, ...call }) => call);
  }

  private static normalizeToolName(name: string): string | null {
    const trimmed = name.trim();
    if (/^mcp__[A-Za-z0-9_.-]+__[A-Za-z0-9_.:-]+$/.test(trimmed)) {
      return trimmed;
    }
    const normalized = trimmed.replace(/\s+/g, '').toLowerCase();
    if (['read', 'fileread', 'readedittool'].includes(normalized)) return 'Read';
    if (['bash', 'bashtool', 'shell'].includes(normalized)) return 'Bash';
    if (['powershell', 'powershelltool', 'pwsh'].includes(normalized)) return 'PowerShell';
    if (['write', 'filewrite'].includes(normalized)) return 'Write';
    if (['edit', 'fileedit'].includes(normalized)) return 'Edit';
    if (normalized === 'glob') return 'Glob';
    if (normalized === 'grep') return 'Grep';
    if (['todowrite', 'todo'].includes(normalized)) return 'TodoWrite';
    if (['taskcreate', 'taskcreatetool'].includes(normalized)) return 'TaskCreate';
    if (['taskget', 'taskgettool'].includes(normalized)) return 'TaskGet';
    if (['tasklist', 'tasklisttool'].includes(normalized)) return 'TaskList';
    if (['taskupdate', 'taskupdatetool'].includes(normalized)) return 'TaskUpdate';
    if (['agent', 'task', 'forkagent', 'agenttool'].includes(normalized)) return 'Agent';
    if (['sendmessage', 'sendmessagetool'].includes(normalized)) return 'SendMessage';
    if (['skill', 'skilltool'].includes(normalized)) return 'Skill';
    if (['mcp', 'mcptool'].includes(normalized)) return 'mcp';
    if (normalized === 'listmcpresourcestool') return 'ListMcpResourcesTool';
    if (normalized === 'readmcpresourcetool') return 'ReadMcpResourceTool';
    if (['lsp', 'lsptool'].includes(normalized)) return 'LSP';
    if (['workflow', 'workflowtool'].includes(normalized)) return 'workflow';
    if (['askuser', 'askuserquestion', 'askuserquestiontool'].includes(normalized)) return 'AskUserQuestion';
    if (['notebookedit', 'notebookedittool'].includes(normalized)) return 'NotebookEdit';
    if (['config', 'configtool'].includes(normalized)) return 'Config';
    if (['enterplanmode', 'enterplanmodetool'].includes(normalized)) return 'EnterPlanMode';
    if (['exitplanmode', 'exitplanmodetool'].includes(normalized)) return 'ExitPlanMode';
    return null;
  }

  private static parseToolPayload(
    body: string,
    toolName?: string,
  ): Record<string, unknown> | null {
    const trimmed = body.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return DeepSeekAdapter.normalizeToolInput(parsed, toolName);
    } catch {
      return DeepSeekAdapter.normalizeToolInput({ command: trimmed }, toolName);
    }
  }

  private static parseXmlToolBody(
    name: string,
    body: string,
  ): Record<string, unknown> | null {
    const normalized = DeepSeekAdapter.normalizeToolName(name);
    if (!normalized) return null;
    if (normalized === 'Read') {
      const filePath =
        DeepSeekAdapter.extractFirstTagValue(body, 'path') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'file_path') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'Path') ||
        body.trim();
      return filePath ? { file_path: filePath } : null;
    }
    if (normalized === 'Bash') {
      const command =
        DeepSeekAdapter.extractFirstTagValue(body, 'command') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'Action') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'action') ||
        body.trim();
      return command ? { command } : null;
    }
    if (normalized === 'PowerShell') {
      const command =
        DeepSeekAdapter.extractFirstTagValue(body, 'command') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'Action') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'action') ||
        body.trim();
      return command ? { command } : null;
    }
    if (normalized === 'Write') {
      const parsed = DeepSeekAdapter.parseXmlTagPayload(body);
      if (parsed) return parsed;
      const filePath =
        DeepSeekAdapter.extractFirstTagValue(body, 'file_path') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'path') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'Path');
      const content =
        DeepSeekAdapter.extractFirstTagValue(body, 'content') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'Content');
      return filePath && content !== null ? { file_path: filePath, content } : null;
    }
    if (normalized === 'Edit') {
      const filePath =
        DeepSeekAdapter.extractFirstTagValue(body, 'file_path') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'path') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'Path');
      const oldString =
        DeepSeekAdapter.extractFirstTagValue(body, 'old_string') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'oldString');
      const newString =
        DeepSeekAdapter.extractFirstTagValue(body, 'new_string') ||
        DeepSeekAdapter.extractFirstTagValue(body, 'newString');
      return filePath && oldString !== null && newString !== null
        ? { file_path: filePath, old_string: oldString, new_string: newString }
        : null;
    }
    const xmlPayload = DeepSeekAdapter.parseXmlTagPayload(body, normalized);
    if (xmlPayload) return xmlPayload;
    return DeepSeekAdapter.normalizeToolInput(
      DeepSeekAdapter.parseToolPayload(body, normalized) ?? {},
      normalized,
    );
  }

  private static normalizeToolInput(
    input: any,
    toolName?: string,
  ): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const normalizedToolName = toolName
      ? DeepSeekAdapter.normalizeToolName(toolName)
      : null;
    const output: Record<string, unknown> = { ...input };
    if (typeof output.path === 'string' && typeof output.file_path !== 'string') {
      output.file_path = output.path;
      delete output.path;
    }
    if (
      typeof output.oldString === 'string' &&
      typeof output.old_string !== 'string'
    ) {
      output.old_string = output.oldString;
      delete output.oldString;
    }
    if (
      typeof output.newString === 'string' &&
      typeof output.new_string !== 'string'
    ) {
      output.new_string = output.newString;
      delete output.newString;
    }
    if (typeof output.Action === 'string' && typeof output.command !== 'string') {
      output.command = output.Action;
      delete output.Action;
    }
    if (
      normalizedToolName === 'Skill' &&
      typeof output.command === 'string' &&
      typeof output.skill !== 'string'
    ) {
      output.skill = output.command;
      delete output.command;
    }
    if (typeof output.Path === 'string' && typeof output.file_path !== 'string') {
      output.file_path = output.Path;
      delete output.Path;
    }
    if (typeof output.filePath === 'string' && typeof output.file_path !== 'string') {
      output.file_path = output.filePath;
      delete output.filePath;
    }
    if (normalizedToolName === 'LSP' && typeof output.file_path === 'string') {
      output.filePath = output.file_path;
      delete output.file_path;
    }
    if (output.task_id !== undefined && typeof output.taskId !== 'string') {
      output.taskId = output.task_id;
      delete output.task_id;
    }
    if (
      ['TaskGet', 'TaskUpdate', 'SendMessage'].includes(normalizedToolName ?? '') &&
      output.taskId !== undefined &&
      typeof output.taskId !== 'string'
    ) {
      output.taskId = String(output.taskId);
    }
    if (
      normalizedToolName === 'SendMessage' &&
      typeof output.message === 'string' &&
      (typeof output.summary !== 'string' || output.summary.trim().length === 0)
    ) {
      output.summary = DeepSeekAdapter.summarizeToolMessage(output.message);
    }
    return output;
  }

  private static summarizeToolMessage(message: string): string {
    const words = message.trim().split(/\s+/).filter(Boolean);
    const summary = words.slice(0, 8).join(' ');
    return summary.length > 0 ? summary : 'continue agent';
  }

  private static parseXmlTagPayload(
    body: string,
    toolName?: string,
  ): Record<string, unknown> | null {
    const output: Record<string, unknown> = {};
    const tagPattern =
      /<([A-Za-z_][A-Za-z0-9_:-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
    for (const match of body.matchAll(tagPattern)) {
      const rawKey = match[1] || '';
      const rawValue = match[2] || '';
      const key = DeepSeekAdapter.normalizeInputKey(rawKey);
      const value = DeepSeekAdapter.decodeXmlEntities(rawValue.trim());
      if (!key || value === '') continue;
      output[key] = DeepSeekAdapter.parseMaybeJson(value);
    }
    return Object.keys(output).length > 0
      ? DeepSeekAdapter.normalizeToolInput(output, toolName)
      : null;
  }

  private static normalizeInputKey(key: string): string {
    const normalized = key.replace(/-/g, '_');
    const lower = normalized.toLowerCase();
    if (lower === 'path' || lower === 'filepath' || lower === 'file_path') return 'file_path';
    if (lower === 'oldstring' || lower === 'old_string') return 'old_string';
    if (lower === 'newstring' || lower === 'new_string') return 'new_string';
    if (lower === 'notebookpath' || lower === 'notebook_path') return 'notebook_path';
    if (lower === 'cellid' || lower === 'cell_id') return 'cell_id';
    if (lower === 'newsource' || lower === 'new_source') return 'new_source';
    if (lower === 'celltype' || lower === 'cell_type') return 'cell_type';
    if (lower === 'editmode' || lower === 'edit_mode') return 'edit_mode';
    if (lower === 'taskid' || lower === 'task_id') return 'taskId';
    if (lower === 'subagenttype' || lower === 'subagent_type') return 'subagent_type';
    if (lower === 'skillname' || lower === 'skill_name' || lower === 'commandname' || lower === 'command_name') return 'skill';
    if (lower === 'workflowname' || lower === 'workflow_name') return 'workflow';
    return normalized;
  }

  private static parseMaybeJson(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (!/^[\[{"]/.test(trimmed)) return trimmed;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  private static decodeXmlEntities(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  private static extractTagValues(text: string, tagName: string): string[] {
    const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `<${escaped}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
      'gi',
    );
    return [...text.matchAll(pattern)]
      .map(match => (match[1] || '').trim())
      .filter(Boolean);
  }

  private static extractFirstTagValue(
    text: string,
    tagName: string,
  ): string | null {
    return DeepSeekAdapter.extractTagValues(text, tagName)[0] ?? null;
  }

  static normalizeUsage(data: any): any {
    const usage = data?.usage ?? {};
    const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
    const cacheReadTokens =
      usage.prompt_cache_hit_tokens ??
      usage.cache_read_input_tokens ??
      usage.cached_tokens ??
      0;
    const cacheCreationTokens =
      usage.prompt_cache_miss_tokens ??
      usage.cache_creation_input_tokens ??
      Math.max(0, inputTokens - cacheReadTokens);
    const reasoningTokens =
      usage.reasoning_tokens ??
      usage.completion_tokens_details?.reasoning_tokens ??
      usage.output_tokens_details?.reasoning_tokens ??
      0;
    const model = normalizeDeepSeekV4Model(data?.model ?? 'deepseek-v4-flash');
    const estimatedCostUsd = estimateDeepSeekV4Cost({
      model,
      cacheHitInputTokens: cacheReadTokens,
      cacheMissInputTokens: cacheCreationTokens,
      outputTokens,
    });

    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreationTokens,
      cache_read_input_tokens: cacheReadTokens,
      reasoning_tokens: reasoningTokens,
      total_tokens: usage.total_tokens ?? inputTokens + outputTokens,
      dsxu: {
        provider: 'deepseek',
        model,
        prompt_cache_hit_tokens: cacheReadTokens,
        prompt_cache_miss_tokens: cacheCreationTokens,
        estimated_cost_usd: Number.isFinite(estimatedCostUsd) ? estimatedCostUsd : 0,
        ...(data?.dsxu_model_evidence ? { model_evidence: data.dsxu_model_evidence } : {}),
        ...(data?.dsxu_route_reason ? { route_reason: data.dsxu_route_reason } : {}),
      },
    };
  }

  private static getBaseUrl(): string {
    const fromEnv = process.env.DEEPSEEK_BASE_URL?.trim();
    if (fromEnv && fromEnv.length > 0) {
      return fromEnv.replace(/\/+$/, '');
    }
    return "https://api.deepseek.com";
  }

  private static isOpenRouterBaseUrl(baseUrl: string): boolean {
    return /openrouter\.ai/i.test(baseUrl);
  }

  private static getRouteInput(params: any, options?: any): DeepSeekV4RouteInput | undefined {
    const raw =
      options?.dsxuRouteInput ??
      params?.metadata?.dsxu_route_input ??
      params?.metadata?.dsxuRouteInput;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    return raw as DeepSeekV4RouteInput;
  }

  static resolveRequestPlan(params: any, options?: any): DeepSeekRequestPlan {
    return DeepSeekAdapter.resolveRequestPlanForBaseUrl(
      params,
      DeepSeekAdapter.getBaseUrl(),
      options,
    );
  }

  static resolveRequestPlanForBaseUrl(
    params: any,
    baseUrl: string,
    options?: any,
  ): DeepSeekRequestPlan {
    const routeInput = DeepSeekAdapter.getRouteInput(params, options);
    const costRoute = resolveDeepSeekV4CostRoute({
      params: {
        model: params?.model,
        max_tokens: params?.max_tokens,
        thinking: params?.thinking,
        reasoning_effort: params?.reasoning_effort,
      },
      routeInput,
    });
    const {
      requestedModel,
      apiMode,
      thinkingEnabled,
      reasoningEffort,
      endpointKind,
      maxTokens,
      routeDecision,
      routeReason,
      modelEvidence,
    } = costRoute;

    const isOpenRouter = DeepSeekAdapter.isOpenRouterBaseUrl(baseUrl);
    const modelName = isOpenRouter
      ? (requestedModel === 'deepseek-v4-pro'
        ? (process.env.OPENROUTER_REASONER_MODEL || 'deepseek/deepseek-v4-pro')
        : (process.env.OPENROUTER_CHAT_MODEL || 'deepseek/deepseek-v4-flash'))
      : requestedModel;

    return {
      baseUrl,
      isOpenRouter,
      requestedModel,
      modelName,
      apiMode,
      thinkingEnabled,
      reasoningEffort,
      endpointKind,
      maxTokens,
      routeDecision,
      routeReason,
      modelEvidence,
    };
  }

  static transformRequest(params: any, options?: any): any {
    // console.error(`[DSXU-DEBUG] transformRequest: ${params.model}`);

    const requestPromise = DeepSeekAdapter.executeRequest(params, options);

    // 模拟 provider SDK 的 APIPromise
    const apiPromise = requestPromise.then(res => res.data);
    (apiPromise as any).withResponse = () => requestPromise;

    return apiPromise;
  }

  private static async executeRequest(params: any, options?: any): Promise<{ data: any, response: Response, request_id: string }> {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

      const plan = DeepSeekAdapter.resolveRequestPlan(params, options);
      const systemPromptSummary =
        DeepSeekAdapter.summarizeSystemContentForDeepSeek(params.system);
      appendDeepSeekRouteTrace('request_plan', {
        paramsModel: params?.model,
        paramsThinking: params?.thinking?.type,
        paramsReasoningEffort: params?.reasoning_effort,
        routeInput: DeepSeekAdapter.getRouteInput(params, options),
        requestedModel: plan.requestedModel,
        modelName: plan.modelName,
        apiMode: plan.apiMode,
        thinkingEnabled: plan.thinkingEnabled,
        reasoningEffort: plan.reasoningEffort,
        endpointKind: plan.endpointKind,
        maxTokens: plan.maxTokens,
        routeReason: plan.routeReason,
        envDeepSeekModel: process.env.DEEPSEEK_MODEL,
        systemPromptSummary,
      });
      const messages = DeepSeekAdapter.convertMessages(params.messages, params.system);

      const body = {
        model: plan.modelName,
        messages: messages,
        stream: params.stream ?? false,
        ...(params.stream ? { stream_options: { include_usage: true } } : {}),
        max_tokens: plan.maxTokens,
        thinking: { type: plan.thinkingEnabled ? 'enabled' : 'disabled' },
        ...(plan.thinkingEnabled && plan.reasoningEffort ? { reasoning_effort: plan.reasoningEffort } : {}),
        ...(!plan.thinkingEnabled ? { temperature: params.temperature ?? 1.0 } : {}),
        ...( (params.tools && params.tools.length > 0) ? {
           tools: params.tools.map((t: any) => ({
             type: 'function',
             function: { name: t.name, description: t.description, parameters: t.input_schema }
           })),
           tool_choice: params.tool_choice ? (
             params.tool_choice.type === 'auto' ? 'auto' :
             params.tool_choice.type === 'any' ? 'required' :
             { type: 'function', function: { name: params.tool_choice.name } }
           ) : undefined
        } : {})
      };

      const response = await fetch(`${plan.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(plan.isOpenRouter ? {
            'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://local.dsxu',
            'X-Title': process.env.OPENROUTER_X_TITLE || 'DSXU',
          } : {}),
          ...(options?.headers || {})
        },
        body: JSON.stringify(body),
        signal: options?.signal
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`[DSXU-API-ERR] ${response.status}: ${err}`);
        throw new Error(`API ${response.status}`);
      }

      const requestId = response.headers.get('x-request-id') || `ds-${Date.now()}`;
      const data = params.stream ? DeepSeekAdapter.handleStream(response, plan) : await DeepSeekAdapter.handleJSON(response, plan);

      return { data, response, request_id: requestId };
    } catch (e) {
      console.error("[DSXU-EXEC-ERR]", e);
      throw e;
    }
  }

  private static normalizeSystemTextBlock(text: string): string | null {
    const withoutBoundary = text
      .split(/\r?\n/)
      .filter(line => line.trim() !== SYSTEM_PROMPT_DYNAMIC_BOUNDARY)
      .join('\n');
    return withoutBoundary.trim().length > 0 ? withoutBoundary : null;
  }

  static normalizeSystemContentForDeepSeek(system?: unknown): string | undefined {
    if (!system) return undefined;
    if (typeof system === 'string') {
      return DeepSeekAdapter.normalizeSystemTextBlock(system) ?? undefined;
    }
    if (!Array.isArray(system)) {
      const text = (system as { text?: unknown })?.text;
      return typeof text === 'string'
        ? (DeepSeekAdapter.normalizeSystemTextBlock(text) ?? undefined)
        : undefined;
    }

    const blocks: string[] = [];
    for (const block of system) {
      const text =
        typeof block === 'string'
          ? block
          : typeof block?.text === 'string'
            ? block.text
            : undefined;
      if (text === undefined) continue;
      const normalized = DeepSeekAdapter.normalizeSystemTextBlock(text);
      if (normalized) blocks.push(normalized);
    }
    return blocks.length > 0 ? blocks.join('\n\n') : undefined;
  }

  static summarizeSystemContentForDeepSeek(system?: unknown): {
    rawKind: 'empty' | 'string' | 'array' | 'object'
    rawBlockCount: number
    cacheControlBlockCount: number
    boundaryBlockCount: number
    normalizedChars: number
    normalizedHash: string
  } {
    const normalized = DeepSeekAdapter.normalizeSystemContentForDeepSeek(system) ?? '';
    const rawKind =
      system === undefined || system === null
        ? 'empty'
        : Array.isArray(system)
          ? 'array'
          : typeof system === 'string'
            ? 'string'
            : 'object';
    const rawBlocks = Array.isArray(system)
      ? system
      : system === undefined || system === null
        ? []
        : [system];
    let cacheControlBlockCount = 0;
    let boundaryBlockCount = 0;
    for (const block of rawBlocks) {
      const hasCacheControl =
        !!block &&
        typeof block === 'object' &&
        'cache_control' in (block as Record<string, unknown>);
      if (hasCacheControl) cacheControlBlockCount += 1;
      const text =
        typeof block === 'string'
          ? block
          : typeof (block as { text?: unknown })?.text === 'string'
            ? (block as { text: string }).text
            : '';
      if (text.includes(SYSTEM_PROMPT_DYNAMIC_BOUNDARY)) {
        boundaryBlockCount += 1;
      }
    }
    return {
      rawKind,
      rawBlockCount: rawBlocks.length,
      cacheControlBlockCount,
      boundaryBlockCount,
      normalizedChars: normalized.length,
      normalizedHash: createHash('sha256')
        .update(normalized)
        .digest('hex')
        .slice(0, 16),
    };
  }

  private static convertMessages(providerMessages: any[], system?: unknown): any[] {
    const result: any[] = [];
    const systemContent = DeepSeekAdapter.normalizeSystemContentForDeepSeek(system);
    if (systemContent) result.push({ role: 'system', content: systemContent });

    for (const msg of (providerMessages || [])) {
      let content = msg.content;
      if (msg.role !== 'assistant' && Array.isArray(content)) {
        content = content.filter((c: any) => !['thinking', 'redacted_thinking', 'reasoning'].includes(c.type));
      }

      if (msg.role === 'assistant') {
        const toolCalls: any[] = [];
        let textParts = '';
        let reasoningContent = '';
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === 'text') textParts += c.text;
            else if (c.type === 'thinking' || c.type === 'reasoning') {
              reasoningContent += c.thinking || c.reasoning || c.text || '';
            } else if (c.type === 'redacted_thinking') {
              reasoningContent += c.data || c.text || '';
            }
            else if (c.type === 'tool_use') {
              toolCalls.push({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } });
            }
          }
        } else textParts = content;

        result.push({
          role: 'assistant',
          content: textParts || null,
          ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        });
      } else if (msg.role === 'user') {
        if (Array.isArray(content)) {
          const toolResults = content.filter(c => c.type === 'tool_result');
          const text = content.filter(c => c.type === 'text').map(c => c.text).join('\n');
          if (toolResults.length > 0) {
            for (const tr of toolResults) {
              result.push({ role: 'tool', tool_call_id: tr.tool_use_id, content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content) });
            }
            if (text) result.push({ role: 'user', content: text });
          } else result.push({ role: 'user', content: text || "" });
        } else result.push({ role: 'user', content: content });
      }
    }
    return DeepSeekAdapter.fixMessageSequence(result);
  }

  private static fixMessageSequence(msgs: any[]): any[] {
    const fixed: any[] = [];
    for (const m of msgs) {
      if (fixed.length > 0 && fixed[fixed.length - 1].role === m.role && m.role === 'assistant') {
        const prev = fixed[fixed.length - 1];
        const prevContent = typeof prev.content === 'string' ? prev.content : '';
        const currentContent = typeof m.content === 'string' ? m.content : '';
        prev.content = [prevContent, currentContent].filter(Boolean).join('\n\n') || null;
        prev.reasoning_content = [prev.reasoning_content, m.reasoning_content].filter(Boolean).join('\n\n') || undefined;
        if (m.tool_calls?.length) {
          prev.tool_calls = [...(prev.tool_calls || []), ...m.tool_calls];
        }
      } else if (fixed.length > 0 && fixed[fixed.length - 1].role === m.role && m.role === 'user') {
        const prev = fixed[fixed.length - 1];
        if (typeof prev.content === 'string' && typeof m.content === 'string') {
          prev.content += "\n\n" + m.content;
        }
      } else {
        fixed.push(m);
      }
    }
    return fixed;
  }

  private static async *handleStream(response: Response, plan?: DeepSeekRequestPlan) {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    let hasStartedText = false;
    let hasStartedThinking = false;
    let textBlockOpen = false;
    let thinkingBlockOpen = false;
    let textBlockIndex = 0;
    let finalUsage: any | undefined;
    const startedToolBlocks = new Set<number>();

    yield { type: 'message_start', message: { id: 'msg', role: 'assistant', content: [], usage: { input_tokens: 0, output_tokens: 0 } } };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') break;
          try {
            const data = JSON.parse(dataStr);
            if (data.usage) {
              finalUsage = DeepSeekAdapter.normalizeUsage({
                ...data,
                dsxu_model_evidence: plan?.modelEvidence,
                dsxu_route_reason: plan?.routeReason,
              });
              appendDeepSeekRouteTrace('response_usage', {
                responseModel: data.model,
                requestedModel: plan?.requestedModel,
                modelName: plan?.modelName,
                routeReason: plan?.routeReason,
                inputTokens: finalUsage.input_tokens,
                outputTokens: finalUsage.output_tokens,
                cacheHitInputTokens: finalUsage.cache_read_input_tokens,
                cacheMissInputTokens: finalUsage.cache_creation_input_tokens,
                cacheHitRatePct:
                  finalUsage.input_tokens > 0
                    ? Math.round((finalUsage.cache_read_input_tokens / finalUsage.input_tokens) * 1000) / 10
                    : 0,
              });
            }
            const delta = data.choices[0]?.delta;
            if (!delta) continue;

            // R1 Thinking
            if (delta.reasoning_content) {
              if (!hasStartedThinking) {
                yield { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } };
                hasStartedThinking = true;
                thinkingBlockOpen = true;
                textBlockIndex = 1;
              }
              yield { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: delta.reasoning_content } };
              if (process.env.DSXU_DEBUG_REASONING_DOTS === '1') {
                process.stderr.write(".");
              }
            }

            if (delta.content) {
              if (thinkingBlockOpen) {
                yield { type: 'content_block_stop', index: 0 };
                thinkingBlockOpen = false;
              }
              if (!hasStartedText) {
                yield { type: 'content_block_start', index: textBlockIndex, content_block: { type: 'text', text: '' } };
                hasStartedText = true;
                textBlockOpen = true;
              }
              yield { type: 'content_block_delta', index: textBlockIndex, delta: { type: 'text_delta', text: delta.content } };
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (thinkingBlockOpen) {
                  yield { type: 'content_block_stop', index: 0 };
                  thinkingBlockOpen = false;
                }
                const toolIndex = textBlockIndex + 1 + (tc.index ?? 0);
                if (tc.function?.name && !startedToolBlocks.has(toolIndex)) {
                  yield { type: 'content_block_start', index: toolIndex, content_block: { type: 'tool_use', id: tc.id, name: tc.function.name, input: {} } };
                  startedToolBlocks.add(toolIndex);
                }
                if (tc.function?.arguments) {
                  yield { type: 'content_block_delta', index: toolIndex, delta: { type: 'input_json_delta', partial_json: tc.function.arguments } };
                }
              }
            }
          } catch (e) { }
        }
      }
    } finally {
      reader.releaseLock();
    }
    if (thinkingBlockOpen) {
      yield { type: 'content_block_stop', index: 0 };
      thinkingBlockOpen = false;
    }
    if (textBlockOpen) {
      yield { type: 'content_block_stop', index: textBlockIndex };
    }
    for (const index of startedToolBlocks) {
      yield { type: 'content_block_stop', index };
    }
    yield {
      type: 'message_delta',
      delta: {
        stop_reason: startedToolBlocks.size > 0 ? 'tool_use' : 'end_turn',
      },
      usage: finalUsage ?? { output_tokens: 0 },
    };
    yield { type: 'message_stop' };
  }

  private static async handleJSON(response: Response, plan?: DeepSeekRequestPlan) {
    const data = await response.json();
    const normalizedUsage = DeepSeekAdapter.normalizeUsage({
      ...data,
      dsxu_model_evidence: plan?.modelEvidence,
      dsxu_route_reason: plan?.routeReason,
    });
    appendDeepSeekRouteTrace('response_usage', {
      responseModel: data.model,
      requestedModel: plan?.requestedModel,
      modelName: plan?.modelName,
      routeReason: plan?.routeReason,
      inputTokens: normalizedUsage.input_tokens,
      outputTokens: normalizedUsage.output_tokens,
      cacheHitInputTokens: normalizedUsage.cache_read_input_tokens,
      cacheMissInputTokens: normalizedUsage.cache_creation_input_tokens,
      cacheHitRatePct:
        normalizedUsage.input_tokens > 0
          ? Math.round((normalizedUsage.cache_read_input_tokens / normalizedUsage.input_tokens) * 1000) / 10
          : 0,
    });
    const choice = data.choices[0];
    const msg = choice.message;
    const content: any[] = [];
    const textToolUses = msg.content
      ? DeepSeekAdapter.extractToolUsesFromText(msg.content)
      : [];
    if (msg.content) {
      const hasOnlyToolMarkup =
        textToolUses.length > 0 &&
        msg.content
          .replace(/<tool_call\s+name=["']?[^"'>\s]+["']?\s*>[\s\S]*?<\/tool_call>/gi, '')
          .replace(/<(Read|FileRead|Bash|Shell|PowerShell|PowerShellTool|Write|FileWrite|Edit|FileEdit|Glob|Grep|TodoWrite|Todo|TaskCreate|TaskCreateTool|TaskGet|TaskGetTool|TaskList|TaskListTool|TaskUpdate|TaskUpdateTool|Agent|Task|ForkAgent|SendMessage|SendMessageTool|Skill|SkillTool|MCP|MCPTool|ListMcpResourcesTool|ReadMcpResourceTool|LSP|LSPTool|Workflow|WorkflowTool|AskUser|AskUserQuestion|AskUserQuestionTool|NotebookEdit|NotebookEditTool|Config|ConfigTool|EnterPlanMode|EnterPlanModeTool|ExitPlanMode|ExitPlanModeTool|ReadEditTool|BashTool)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
          .replace(/<ReadOperation\b[^>]*>[\s\S]*?<\/ReadOperation>/gi, '')
          .trim().length === 0;
      if (!hasOnlyToolMarkup) content.push({ type: 'text', text: msg.content });
    }
    else if (msg.reasoning_content) content.push({ type: 'text', text: msg.reasoning_content });
    for (const toolUse of textToolUses) {
      content.push({ type: 'tool_use', ...toolUse });
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) });
      }
    }
    return {
      id: data.id,
      role: 'assistant',
      content,
      stop_reason: choice.finish_reason === 'tool_calls' || content.some(block => block.type === 'tool_use') ? 'tool_use' : 'end_turn',
      usage: normalizedUsage,
    };
  }
}
