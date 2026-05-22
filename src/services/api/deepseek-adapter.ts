import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../../constants/prompts.js';
import { recordCacheUsage } from '../cache-stats.js';
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
import { DeepSeekTrajectoryStore } from './deepseek-trajectory-store.js';

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

export interface DeepSeekToolExtractionOptions {
  allowedNames?: readonly string[]
  maxCalls?: number
  maxInputChars?: number
}

export type DeepSeekToolCallSchemaPath = 'strict_schema' | 'xml_fallback' | 'json_scavenge'

export type DeepSeekExtractedToolUse = {
  id: string
  name: string
  input: Record<string, unknown>
  schemaPath: Exclude<DeepSeekToolCallSchemaPath, 'strict_schema'>
  fallbackReason: string
}

export type DeepSeekSchemaFlattenMapping = {
  flatKey: string
  path: readonly string[]
  required: boolean
}

export type DeepSeekSchemaFlattenPlan = {
  shouldFlatten: boolean
  leafCount: number
  maxDepth: number
  flattenedSchema: Record<string, unknown>
  mappings: readonly DeepSeekSchemaFlattenMapping[]
}

export type DeepSeekMessageConversionOptions = {
  thinkingEnabled?: boolean
}

export type DeepSeekChatCompletionBodyInput = {
  plan: DeepSeekRequestPlan
  messages: readonly any[]
  tools?: readonly any[]
  toolSchemaPlans?: ReadonlyMap<string, DeepSeekSchemaFlattenPlan>
  stream?: boolean
  temperature?: number
  tool_choice?: any
  response_format?: any
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
  static extractToolUsesFromText(text: string, options: DeepSeekToolExtractionOptions = {}): Array<{
    id: string
    name: string
    input: Record<string, unknown>
  }> {
    return DeepSeekAdapter.extractToolUsesFromTextWithEvidence(text, options).map(({
      schemaPath: _schemaPath,
      fallbackReason: _fallbackReason,
      ...toolUse
    }) => toolUse)
  }

  static extractToolUsesFromTextWithEvidence(
    text: string,
    options: DeepSeekToolExtractionOptions = {},
  ): DeepSeekExtractedToolUse[] {
    const sourceText = typeof options.maxInputChars === 'number' && options.maxInputChars >= 0
      ? text.slice(0, options.maxInputChars)
      : text
    const allowedNames = options.allowedNames
      ? new Set(
          options.allowedNames
            .map(name => DeepSeekAdapter.normalizeToolName(name))
            .filter((name): name is string => typeof name === 'string'),
        )
      : null
    const maxCalls = typeof options.maxCalls === 'number' && options.maxCalls > 0
      ? Math.floor(options.maxCalls)
      : Number.POSITIVE_INFINITY
    const calls: Array<{
      id: string
      name: string
      input: Record<string, unknown>
      schemaPath: Exclude<DeepSeekToolCallSchemaPath, 'strict_schema'>
      fallbackReason: string
      position: number
      sequence: number
    }> = [];
    const seen = new Set<string>();
    let sequence = 0;
    const push = (
      name: string,
      input: Record<string, unknown>,
      position: number,
      schemaPath: Exclude<DeepSeekToolCallSchemaPath, 'strict_schema'>,
    ) => {
      if (calls.length >= maxCalls) return;
      const normalizedName = DeepSeekAdapter.normalizeToolName(name);
      if (!normalizedName) return;
      if (allowedNames && !allowedNames.has(normalizedName)) return;
      const key = `${position}:${normalizedName}:${JSON.stringify(input)}`;
      if (seen.has(key)) return;
      seen.add(key);
      calls.push({
        id: `dsxu_tool_${calls.length + 1}_${Date.now()}`,
        name: normalizedName,
        input,
        schemaPath,
        fallbackReason: schemaPath === 'xml_fallback'
          ? 'DeepSeek response used XML/simple-tag fallback instead of strict function call'
          : 'DeepSeek response used bounded JSON scavenge fallback instead of strict function call',
        position,
        sequence: sequence++,
      });
    };

    const toolCallPattern =
      /<tool_call\s+name=["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/tool_call>/gi;
    for (const match of sourceText.matchAll(toolCallPattern)) {
      const name = match[1] || '';
      const body = (match[2] || '').trim();
      const parsed = DeepSeekAdapter.parseToolPayload(body, name);
      if (parsed) push(name, parsed, match.index ?? 0, 'xml_fallback');
    }

    const simpleTagPattern =
      /<(Read|FileRead|Bash|Shell|PowerShell|PowerShellTool|Write|FileWrite|Edit|FileEdit|Glob|Grep|TodoWrite|Todo|TaskCreate|TaskCreateTool|TaskGet|TaskGetTool|TaskList|TaskListTool|TaskUpdate|TaskUpdateTool|Agent|Task|ForkAgent|SendMessage|SendMessageTool|Skill|SkillTool|MCP|MCPTool|ListMcpResourcesTool|ReadMcpResourceTool|LSP|LSPTool|Workflow|WorkflowTool|AskUser|AskUserQuestion|AskUserQuestionTool|NotebookEdit|NotebookEditTool|Config|ConfigTool|EnterPlanMode|EnterPlanModeTool|ExitPlanMode|ExitPlanModeTool|ReadEditTool|BashTool)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    for (const match of sourceText.matchAll(simpleTagPattern)) {
      const name = match[1] || '';
      const body = match[2] || '';
      const parsed = DeepSeekAdapter.parseXmlToolBody(name, body);
      if (parsed) push(name, parsed, match.index ?? 0, 'xml_fallback');
    }

    const readOperationPattern =
      /<ReadOperation\b[^>]*>([\s\S]*?)<\/ReadOperation>/gi;
    for (const match of sourceText.matchAll(readOperationPattern)) {
      const body = match[1] || '';
      for (const filePath of DeepSeekAdapter.extractTagValues(body, 'path')) {
        push('Read', { file_path: filePath }, match.index ?? 0, 'xml_fallback');
      }
    }

    for (const candidate of DeepSeekAdapter.scavengeJsonToolCalls(sourceText)) {
      push(candidate.name, candidate.input, candidate.position, 'json_scavenge')
    }

    return calls
      .sort((left, right) => left.position - right.position || left.sequence - right.sequence)
      .map(({ position: _position, sequence: _sequence, ...call }) => call);
  }

  static planDeepSeekToolSchemaFlattening(schema: Record<string, unknown>): DeepSeekSchemaFlattenPlan {
    const leaves: Array<{ path: string[]; schema: Record<string, unknown>; required: boolean }> = []
    DeepSeekAdapter.collectSchemaLeaves(schema, [], leaves, true)
    const maxDepth = leaves.reduce((max, leaf) => Math.max(max, leaf.path.length), 0)
    const shouldFlatten = leaves.length > 10 || maxDepth > 2
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    const mappings: DeepSeekSchemaFlattenMapping[] = []

    for (const leaf of leaves) {
      const flatKey = leaf.path.join('__')
      properties[flatKey] = leaf.schema
      if (leaf.required) required.push(flatKey)
      mappings.push({ flatKey, path: leaf.path, required: leaf.required })
    }

    return {
      shouldFlatten,
      leafCount: leaves.length,
      maxDepth,
      flattenedSchema: shouldFlatten
        ? {
            type: 'object',
            properties,
            required,
            additionalProperties: false,
          }
        : schema,
      mappings,
    }
  }

  static nestDeepSeekFlattenedArguments(
    args: Record<string, unknown>,
    plan: DeepSeekSchemaFlattenPlan,
  ): Record<string, unknown> {
    if (!plan.shouldFlatten) return { ...args }
    const nested: Record<string, unknown> = {}
    const mappedKeys = new Set(plan.mappings.map(mapping => mapping.flatKey))
    for (const mapping of plan.mappings) {
      if (!(mapping.flatKey in args)) continue
      let cursor: Record<string, unknown> = nested
      mapping.path.forEach((segment, index) => {
        if (index === mapping.path.length - 1) {
          cursor[segment] = args[mapping.flatKey]
          return
        }
        const existing = cursor[segment]
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
          cursor[segment] = {}
        }
        cursor = cursor[segment] as Record<string, unknown>
      })
    }
    for (const [key, value] of Object.entries(args)) {
      if (!mappedKeys.has(key)) nested[key] = value
    }
    return nested
  }

  private static collectSchemaLeaves(
    schema: Record<string, unknown>,
    path: string[],
    leaves: Array<{ path: string[]; schema: Record<string, unknown>; required: boolean }>,
    requiredPath: boolean,
  ): void {
    const properties = schema.properties
    if (
      schema.type === 'object' &&
      properties &&
      typeof properties === 'object' &&
      !Array.isArray(properties)
    ) {
      const requiredFields = new Set(
        Array.isArray(schema.required)
          ? schema.required.filter((item): item is string => typeof item === 'string')
          : [],
      )
      for (const [key, child] of Object.entries(properties as Record<string, unknown>)) {
        if (child && typeof child === 'object' && !Array.isArray(child)) {
          DeepSeekAdapter.collectSchemaLeaves(
            child as Record<string, unknown>,
            [...path, key],
            leaves,
            requiredPath && requiredFields.has(key),
          )
        }
      }
      return
    }
    if (path.length > 0) {
      leaves.push({ path, schema, required: requiredPath })
    }
  }

  static buildDeepSeekToolSchemaPlans(tools?: readonly any[]): Map<string, DeepSeekSchemaFlattenPlan> {
    const plans = new Map<string, DeepSeekSchemaFlattenPlan>()
    for (const tool of tools ?? []) {
      if (!tool?.name || !tool?.input_schema || typeof tool.input_schema !== 'object') continue
      const plan = DeepSeekAdapter.planDeepSeekToolSchemaFlattening(tool.input_schema as Record<string, unknown>)
      if (plan.shouldFlatten) plans.set(tool.name, plan)
    }
    return plans
  }

  static getDeepSeekToolParameters(
    tool: any,
    schemaPlans?: ReadonlyMap<string, DeepSeekSchemaFlattenPlan>,
  ): Record<string, unknown> {
    const plan = schemaPlans?.get(tool?.name)
    if (plan?.shouldFlatten) return plan.flattenedSchema
    return tool?.input_schema ?? { type: 'object', properties: {} }
  }

  static nestDeepSeekToolArguments(
    toolName: string,
    args: Record<string, unknown>,
    schemaPlans?: ReadonlyMap<string, DeepSeekSchemaFlattenPlan>,
  ): Record<string, unknown> {
    const plan = schemaPlans?.get(toolName)
    return plan ? DeepSeekAdapter.nestDeepSeekFlattenedArguments(args, plan) : args
  }

  static normalizeDeepSeekToolChoice(toolChoice: any): unknown {
    if (!toolChoice) return undefined
    if (toolChoice.type === 'auto') return 'auto'
    if (toolChoice.type === 'any') return 'required'
    if (typeof toolChoice.name === 'string') {
      return { type: 'function', function: { name: toolChoice.name } }
    }
    if (toolChoice.type === 'function' && typeof toolChoice.function?.name === 'string') {
      return { type: 'function', function: { name: toolChoice.function.name } }
    }
    return toolChoice
  }

  static normalizeDeepSeekProviderTool(
    tool: any,
    schemaPlans?: ReadonlyMap<string, DeepSeekSchemaFlattenPlan>,
  ): Record<string, unknown> | null {
    if (tool?.type === 'function' && tool.function && typeof tool.function === 'object') {
      const fn = tool.function as Record<string, unknown>
      const name = typeof fn.name === 'string' ? fn.name : undefined
      if (!name) return null
      return {
        type: 'function',
        function: {
          name,
          description: typeof fn.description === 'string' ? fn.description : '',
          parameters:
            fn.parameters && typeof fn.parameters === 'object'
              ? fn.parameters
              : { type: 'object', properties: {} },
        },
      }
    }

    if (!tool?.name) return null
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: DeepSeekAdapter.getDeepSeekToolParameters(tool, schemaPlans),
      },
    }
  }

  static buildDeepSeekChatCompletionBody(input: DeepSeekChatCompletionBodyInput): Record<string, unknown> {
    const normalizedTools = (input.tools ?? [])
      .map(tool => DeepSeekAdapter.normalizeDeepSeekProviderTool(tool, input.toolSchemaPlans))
      .filter((tool): tool is Record<string, unknown> => tool !== null)
    const toolChoice = DeepSeekAdapter.normalizeDeepSeekToolChoice(input.tool_choice)

    return {
      model: input.plan.modelName,
      messages: [...input.messages],
      stream: input.stream ?? false,
      ...(input.stream ? { stream_options: { include_usage: true } } : {}),
      max_tokens: input.plan.maxTokens,
      thinking: { type: input.plan.thinkingEnabled ? 'enabled' : 'disabled' },
      ...(input.plan.thinkingEnabled && input.plan.reasoningEffort ? { reasoning_effort: input.plan.reasoningEffort } : {}),
      ...(!input.plan.thinkingEnabled ? { temperature: input.temperature ?? 1.0 } : {}),
      ...(input.response_format ? { response_format: input.response_format } : {}),
      ...(normalizedTools.length > 0
        ? {
            tools: normalizedTools,
            ...(toolChoice ? { tool_choice: toolChoice } : {}),
          }
        : {}),
    }
  }

  private static scavengeJsonToolCalls(text: string): Array<{
    name: string
    input: Record<string, unknown>
    position: number
  }> {
    const candidates: Array<{ raw: string; position: number }> = []
    const trimmed = text.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      candidates.push({ raw: trimmed, position: 0 })
    }

    let offset = 0
    for (const line of text.split(/\r?\n/)) {
      const raw = line.trim()
      if (raw !== trimmed && (raw.startsWith('{') || raw.startsWith('['))) {
        candidates.push({ raw, position: offset + line.indexOf(raw) })
      }
      offset += line.length + 1
    }

    const fencedJsonPattern = /```(?:json)?\s*([\s\S]*?)```/gi
    for (const match of text.matchAll(fencedJsonPattern)) {
      const raw = (match[1] || '').trim()
      if (raw.startsWith('{') || raw.startsWith('[')) {
        candidates.push({ raw, position: match.index ?? 0 })
      }
    }

    return candidates.flatMap(candidate => DeepSeekAdapter.toolCallsFromJsonCandidate(candidate.raw, candidate.position))
  }

  private static toolCallsFromJsonCandidate(raw: string, position: number): Array<{
    name: string
    input: Record<string, unknown>
    position: number
  }> {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      const repaired = DeepSeekAdapter.repairTruncatedJson(raw)
      if (repaired === null) return []
      parsed = repaired
    }

    const items = Array.isArray(parsed) ? parsed : [parsed]
    return items.flatMap(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const record = item as Record<string, unknown>
      const openAiFunction =
        record.type === 'function' &&
        record.function &&
        typeof record.function === 'object' &&
        !Array.isArray(record.function)
          ? record.function as Record<string, unknown>
          : null
      const name =
        typeof record.name === 'string'
          ? record.name
          : typeof record.tool_name === 'string'
            ? record.tool_name
            : typeof openAiFunction?.name === 'string'
              ? openAiFunction.name
              : ''
      if (!name) return []

      const rawArgs =
        record.arguments ??
        record.tool_args ??
        openAiFunction?.arguments ??
        {}
      const input = DeepSeekAdapter.parseJsonToolArguments(rawArgs, name)
      return input ? [{ name, input, position }] : []
    })
  }

  private static parseJsonToolArguments(
    rawArgs: unknown,
    toolName: string,
  ): Record<string, unknown> | null {
    if (typeof rawArgs === 'string') {
      return DeepSeekAdapter.parseToolPayload(rawArgs, toolName)
    }
    if (rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
      return DeepSeekAdapter.normalizeToolInput(rawArgs, toolName)
    }
    return DeepSeekAdapter.normalizeToolInput({}, toolName)
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
      if (/^[\[{]/.test(trimmed)) {
        const repaired = DeepSeekAdapter.repairTruncatedJson(trimmed)
        if (repaired && typeof repaired === 'object' && !Array.isArray(repaired)) {
          return DeepSeekAdapter.normalizeToolInput(repaired, toolName)
        }
        return DeepSeekAdapter.normalizeToolInput({
          __dsxu_invalid_tool_payload: trimmed,
          __dsxu_repair_error: 'unrecoverable_json_payload',
        }, toolName)
      }
      return DeepSeekAdapter.normalizeToolInput({ command: trimmed }, toolName);
    }
  }

  private static repairTruncatedJson(text: string): unknown | null {
    let repaired = text.trim()
    if (!/^[\[{]/.test(repaired)) return null

    const closers: string[] = []
    let inString = false
    let escaped = false
    for (const char of repaired) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\' && inString) {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (char === '{') closers.push('}')
      if (char === '[') closers.push(']')
      if ((char === '}' || char === ']') && closers[closers.length - 1] === char) {
        closers.pop()
      }
    }

    if (inString) repaired += '"'
    while (closers.length > 0) {
      repaired += closers.pop()
    }
    repaired = repaired.replace(/,\s*([}\]])/g, '$1')

    try {
      return JSON.parse(repaired)
    } catch {
      return null
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
      const apiKey = options?.apiKey ?? process.env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

      const baseUrl = typeof options?.baseUrl === 'string' && options.baseUrl.trim().length > 0
        ? options.baseUrl.trim().replace(/\/+$/, '')
        : DeepSeekAdapter.getBaseUrl();
      const plan = DeepSeekAdapter.resolveRequestPlanForBaseUrl(params, baseUrl, options);
      const trajectoryRequestTag = DeepSeekTrajectoryStore.createRequestTag();
      const routeInput = DeepSeekAdapter.getRouteInput(params, options);
      const systemPromptSummary =
        DeepSeekAdapter.summarizeSystemContentForDeepSeek(params.system);
      appendDeepSeekRouteTrace('request_plan', {
        paramsModel: params?.model,
        paramsThinking: params?.thinking?.type,
        paramsReasoningEffort: params?.reasoning_effort,
        routeInput,
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
      DeepSeekTrajectoryStore.append({
        event: 'request_plan',
        requestTag: trajectoryRequestTag,
        paramsModel: params?.model,
        paramsThinking: params?.thinking?.type,
        paramsReasoningEffort: params?.reasoning_effort,
        routeInput: routeInput
          ? {
              workflowKind: routeInput.workflowKind,
              role: routeInput.role,
              riskLevel: routeInput.riskLevel,
              failedVerification: routeInput.failedVerification,
              retryAfterFailure: routeInput.retryAfterFailure,
            }
          : undefined,
        requestedModel: plan.requestedModel,
        modelName: plan.modelName,
        apiMode: plan.apiMode,
        thinkingEnabled: plan.thinkingEnabled,
        reasoningEffort: plan.reasoningEffort,
        endpointKind: plan.endpointKind,
        maxTokens: plan.maxTokens,
        routeReason: plan.routeReason,
        systemPromptSummary,
      });
      const messages = DeepSeekAdapter.convertMessages(params.messages, params.system, {
        thinkingEnabled: plan.thinkingEnabled,
      });
      const toolSchemaPlans = DeepSeekAdapter.buildDeepSeekToolSchemaPlans(params.tools);
      DeepSeekTrajectoryStore.append({
        event: 'request_messages',
        requestTag: trajectoryRequestTag,
        ...DeepSeekTrajectoryStore.summarizeMessages(messages),
      });

      const body = DeepSeekAdapter.buildDeepSeekChatCompletionBody({
        plan,
        messages,
        tools: params.tools,
        toolSchemaPlans,
        stream: params.stream ?? false,
        temperature: params.temperature,
        tool_choice: params.tool_choice,
        response_format: params.response_format,
      });

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
      const data = params.stream
        ? DeepSeekAdapter.handleStream(response, plan, trajectoryRequestTag, requestId, toolSchemaPlans)
        : await DeepSeekAdapter.handleJSON(response, plan, trajectoryRequestTag, requestId, toolSchemaPlans);

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

  private static convertMessages(
    providerMessages: any[],
    system?: unknown,
    conversionOptions: DeepSeekMessageConversionOptions = {},
  ): any[] {
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

        const assistantMessage: Record<string, unknown> = {
          role: 'assistant',
          content: textParts || null,
          ...(conversionOptions.thinkingEnabled && reasoningContent ? { reasoning_content: reasoningContent } : {}),
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        };
        if (conversionOptions.thinkingEnabled && assistantMessage.reasoning_content === undefined) {
          assistantMessage.reasoning_content = '';
        }
        result.push(assistantMessage);
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
    return DeepSeekAdapter.fixMessageSequence(result, conversionOptions);
  }

  private static fixMessageSequence(
    msgs: any[],
    conversionOptions: DeepSeekMessageConversionOptions = {},
  ): any[] {
    const fixed: any[] = [];
    for (const m of msgs) {
      if (fixed.length > 0 && fixed[fixed.length - 1].role === m.role && m.role === 'assistant') {
        const prev = fixed[fixed.length - 1];
        const prevContent = typeof prev.content === 'string' ? prev.content : '';
        const currentContent = typeof m.content === 'string' ? m.content : '';
        prev.content = [prevContent, currentContent].filter(Boolean).join('\n\n') || null;
        prev.reasoning_content = [prev.reasoning_content, m.reasoning_content].filter(Boolean).join('\n\n') ||
          (conversionOptions.thinkingEnabled ? '' : undefined);
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

  private static async *handleStream(
    response: Response,
    plan?: DeepSeekRequestPlan,
    trajectoryRequestTag = DeepSeekTrajectoryStore.createRequestTag(),
    requestId?: string,
    toolSchemaPlans?: ReadonlyMap<string, DeepSeekSchemaFlattenPlan>,
  ) {
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
    let responseModel: unknown;
    let reasoningContent = '';
    const startedToolBlocks = new Set<number>();
    const streamToolCalls = new Map<number, {
      id?: string;
      function?: { name?: string; arguments?: string };
    }>();
    const bufferToolInputForFlattening = Boolean(toolSchemaPlans?.size);

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
            responseModel = data.model ?? responseModel;
            if (data.usage) {
              finalUsage = DeepSeekAdapter.normalizeUsage({
                ...data,
                dsxu_model_evidence: plan?.modelEvidence,
                dsxu_route_reason: plan?.routeReason,
              });
              recordCacheUsage(finalUsage);
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
              DeepSeekTrajectoryStore.append({
                event: 'response_usage',
                requestTag: trajectoryRequestTag,
                requestId,
                responseModel: data.model,
                requestedModel: plan?.requestedModel,
                modelName: plan?.modelName,
                routeReason: plan?.routeReason,
                usage: finalUsage,
              });
            }
            const delta = data.choices[0]?.delta;
            if (!delta) continue;

            // R1 Thinking
            if (delta.reasoning_content) {
              reasoningContent += delta.reasoning_content;
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
                const currentToolCall = streamToolCalls.get(toolIndex) ?? {};
                if (tc.id && !currentToolCall.id) currentToolCall.id = tc.id;
                if (!currentToolCall.function) currentToolCall.function = {};
                if (tc.function?.name) currentToolCall.function.name = tc.function.name;
                if (tc.function?.arguments) {
                  currentToolCall.function.arguments =
                    (currentToolCall.function.arguments ?? '') + tc.function.arguments;
                }
                streamToolCalls.set(toolIndex, currentToolCall);
                if (tc.function?.name && !startedToolBlocks.has(toolIndex)) {
                  yield { type: 'content_block_start', index: toolIndex, content_block: { type: 'tool_use', id: tc.id, name: tc.function.name, input: {} } };
                  startedToolBlocks.add(toolIndex);
                }
                if (tc.function?.arguments && !bufferToolInputForFlattening) {
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
      if (bufferToolInputForFlattening) {
        const call = streamToolCalls.get(index);
        const name = call?.function?.name;
        const rawArguments = call?.function?.arguments;
        if (name && rawArguments) {
          let partialJson = rawArguments;
          const planForTool = toolSchemaPlans?.get(name);
          if (planForTool?.shouldFlatten) {
            try {
              const nested = DeepSeekAdapter.nestDeepSeekFlattenedArguments(JSON.parse(rawArguments), planForTool);
              partialJson = JSON.stringify(nested);
            } catch {
              partialJson = rawArguments;
            }
          }
          yield { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: partialJson } };
        }
      }
      yield { type: 'content_block_stop', index };
    }
    yield {
      type: 'message_delta',
      delta: {
        stop_reason: startedToolBlocks.size > 0 ? 'tool_use' : 'end_turn',
      },
      usage: finalUsage ?? { output_tokens: 0 },
    };
    DeepSeekTrajectoryStore.append({
      event: 'stream_response',
      requestTag: trajectoryRequestTag,
      requestId,
      ...DeepSeekTrajectoryStore.streamSnapshot({
        responseModel,
        reasoningContent,
        toolCalls: [...streamToolCalls.values()].map(call =>
          DeepSeekTrajectoryStore.toolSnapshot(call),
        ),
        finalUsage,
      }),
    });
    yield { type: 'message_stop' };
  }

  private static async handleJSON(
    response: Response,
    plan?: DeepSeekRequestPlan,
    trajectoryRequestTag = DeepSeekTrajectoryStore.createRequestTag(),
    requestId?: string,
    toolSchemaPlans?: ReadonlyMap<string, DeepSeekSchemaFlattenPlan>,
  ) {
    const data = await response.json();
    const normalizedUsage = DeepSeekAdapter.normalizeUsage({
      ...data,
      dsxu_model_evidence: plan?.modelEvidence,
      dsxu_route_reason: plan?.routeReason,
    });
    recordCacheUsage(normalizedUsage);
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
    DeepSeekTrajectoryStore.append({
      event: 'json_response',
      requestTag: trajectoryRequestTag,
      requestId,
      ...DeepSeekTrajectoryStore.responseSnapshot(data),
    });
    DeepSeekTrajectoryStore.append({
      event: 'response_usage',
      requestTag: trajectoryRequestTag,
      requestId,
      responseModel: data.model,
      requestedModel: plan?.requestedModel,
      modelName: plan?.modelName,
      routeReason: plan?.routeReason,
      usage: normalizedUsage,
    });
    const choice = data.choices[0];
    const msg = choice.message;
    const content: any[] = [];
    const textToolUses = msg.content
      ? DeepSeekAdapter.extractToolUsesFromTextWithEvidence(msg.content)
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
        const rawArgs = JSON.parse(tc.function.arguments);
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: DeepSeekAdapter.nestDeepSeekToolArguments(tc.function.name, rawArgs, toolSchemaPlans),
          schemaPath: 'strict_schema',
        });
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
