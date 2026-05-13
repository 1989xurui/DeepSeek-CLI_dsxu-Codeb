import type {
  Tool as MainlineTool,
  ToolResult as MainlineToolResult,
  Tools,
  ToolUseContext,
} from '../../Tool.js'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import type { AppState } from '../../state/AppStateStore.js'
import { getDefaultAppState } from '../../state/AppStateStore.js'
import { AgentTool as MainlineAgentTool } from '../../tools/AgentTool/AgentTool.js'
import { AskUserQuestionTool as MainlineAskUserQuestionTool } from '../../tools/AskUserQuestionTool/AskUserQuestionTool.js'
import { BashTool as MainlineBashTool } from '../../tools/BashTool/BashTool.js'
import { ConfigTool as MainlineConfigTool } from '../../tools/ConfigTool/ConfigTool.js'
import { EnterPlanModeTool as MainlineEnterPlanModeTool } from '../../tools/EnterPlanModeTool/EnterPlanModeTool.js'
import { ExitPlanModeV2Tool as MainlineExitPlanModeTool } from '../../tools/ExitPlanModeTool/ExitPlanModeV2Tool.js'
import { FileEditTool as MainlineEditTool } from '../../tools/FileEditTool/FileEditTool.js'
import { FileReadTool as MainlineReadTool } from '../../tools/FileReadTool/FileReadTool.js'
import { FileWriteTool as MainlineWriteTool } from '../../tools/FileWriteTool/FileWriteTool.js'
import { GlobTool as MainlineGlobTool } from '../../tools/GlobTool/GlobTool.js'
import { GrepTool as MainlineGrepTool } from '../../tools/GrepTool/GrepTool.js'
import { LSPTool as MainlineLSPTool } from '../../tools/LSPTool/LSPTool.js'
import { ListMcpResourcesTool as MainlineListMcpResourcesTool } from '../../tools/ListMcpResourcesTool/ListMcpResourcesTool.js'
import { NotebookEditTool as MainlineNotebookEditTool } from '../../tools/NotebookEditTool/NotebookEditTool.js'
import { PowerShellTool as MainlinePowerShellTool } from '../../tools/PowerShellTool/PowerShellTool.js'
import { ReadMcpResourceTool as MainlineReadMcpResourceTool } from '../../tools/ReadMcpResourceTool/ReadMcpResourceTool.js'
import { SendMessageTool as MainlineSendMessageTool } from '../../tools/SendMessageTool/SendMessageTool.js'
import { SkillTool as MainlineSkillTool } from '../../tools/SkillTool/SkillTool.js'
import { TaskCreateTool as MainlineTaskCreateTool } from '../../tools/TaskCreateTool/TaskCreateTool.js'
import { TaskGetTool as MainlineTaskGetTool } from '../../tools/TaskGetTool/TaskGetTool.js'
import { TaskListTool as MainlineTaskListTool } from '../../tools/TaskListTool/TaskListTool.js'
import { TaskUpdateTool as MainlineTaskUpdateTool } from '../../tools/TaskUpdateTool/TaskUpdateTool.js'
import { TodoWriteTool as MainlineTodoWriteTool } from '../../tools/TodoWriteTool/TodoWriteTool.js'
import { WorkflowTool as MainlineWorkflowTool } from '../../tools/WorkflowTool/WorkflowTool.js'
import { createAbortController } from '../../utils/abortController.js'
import { enableConfigs } from '../../utils/config.js'
import { createFileStateCacheWithSizeLimit } from '../../utils/fileStateCache.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { setCwd } from '../../utils/Shell.js'
import { runWithCwdOverride } from '../../utils/cwd.js'
import { setShellIfWindows } from '../../utils/windowsPaths.js'
import { zodToJsonSchema } from '../../utils/zodToJsonSchema.js'
import { fetchToolsForClient } from '../../services/mcp/client.js'
import type { MCPServerConnection } from '../../services/mcp/types.js'
import {
  BashTool as BuiltinBashTool,
  EditTool as BuiltinEditTool,
  GlobTool as BuiltinGlobTool,
  GrepTool as BuiltinGrepTool,
  ReadTool as BuiltinReadTool,
  WriteTool as BuiltinWriteTool,
} from './builtin-tools'
import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import type { ToolRegistry } from './tool-registry'
import { redactCredentialLikeValues } from './provider-contract'

export type MainlineCoreToolName =
  | 'Read'
  | 'Edit'
  | 'Write'
  | 'Bash'
  | 'Grep'
  | 'Glob'
  | 'PowerShell'
  | 'LSP'
  | 'ListMcpResourcesTool'
  | 'ReadMcpResourceTool'
  | 'Agent'
  | 'SendMessage'
  | 'Skill'
  | 'TodoWrite'
  | 'AskUserQuestion'
  | 'NotebookEdit'
  | 'Config'
  | 'EnterPlanMode'
  | 'ExitPlanMode'
  | 'TaskCreate'
  | 'TaskGet'
  | 'TaskList'
  | 'TaskUpdate'
  | 'workflow'

type MainlineToolRegistration = {
  mainline: MainlineTool
  fallback?: ToolDefinition
}

const MAINLINE_CORE_TOOLS: MainlineToolRegistration[] = [
  { mainline: MainlineReadTool as MainlineTool, fallback: BuiltinReadTool },
  { mainline: MainlineEditTool as MainlineTool, fallback: BuiltinEditTool },
  { mainline: MainlineWriteTool as MainlineTool, fallback: BuiltinWriteTool },
  { mainline: MainlineBashTool as MainlineTool, fallback: BuiltinBashTool },
  { mainline: MainlineGrepTool as MainlineTool, fallback: BuiltinGrepTool },
  { mainline: MainlineGlobTool as MainlineTool, fallback: BuiltinGlobTool },
  { mainline: MainlinePowerShellTool as MainlineTool },
  { mainline: MainlineLSPTool as MainlineTool },
  { mainline: MainlineListMcpResourcesTool as MainlineTool },
  { mainline: MainlineReadMcpResourceTool as MainlineTool },
  { mainline: MainlineAgentTool as MainlineTool },
  { mainline: MainlineSendMessageTool as MainlineTool },
  { mainline: MainlineSkillTool as MainlineTool },
  { mainline: MainlineTodoWriteTool as MainlineTool },
  { mainline: MainlineAskUserQuestionTool as MainlineTool },
  { mainline: MainlineNotebookEditTool as MainlineTool },
  { mainline: MainlineConfigTool as MainlineTool },
  { mainline: MainlineEnterPlanModeTool as MainlineTool },
  { mainline: MainlineExitPlanModeTool as MainlineTool },
  { mainline: MainlineTaskCreateTool as MainlineTool },
  { mainline: MainlineTaskGetTool as MainlineTool },
  { mainline: MainlineTaskListTool as MainlineTool },
  { mainline: MainlineTaskUpdateTool as MainlineTool },
  { mainline: MainlineWorkflowTool as MainlineTool },
]

type MainlineRuntime = {
  appState: AppState
  context: ToolUseContext
}

const runtimeByEngineContext = new WeakMap<ToolContext, MainlineRuntime>()
const MAINLINE_RUNTIME_CONTEXT = Symbol.for('dsxu.engine.mainlineRuntimeContext')

async function mainlineDescription(tool: MainlineTool, tools: Tools): Promise<string> {
  return tool.description({}, {
    isNonInteractiveSession: true,
    toolPermissionContext: getEmptyToolPermissionContext(),
    tools,
  })
}

export async function adaptMainlineToolToEngine(
  mainlineTool: MainlineTool,
  fallbackTool: ToolDefinition | undefined,
  tools: Tools,
): Promise<ToolDefinition> {
  const description = await mainlineDescription(mainlineTool, tools)
  const inputSchema = mainlineTool.inputJSONSchema ?? zodToJsonSchema(mainlineTool.inputSchema)

  return {
    name: mainlineTool.name,
    description,
    inputSchema,
    concurrencySafe: safeBoolean(() => mainlineTool.isConcurrencySafe({})),
    readOnly: safeBoolean(() => mainlineTool.isReadOnly({})),
    isEnabled: () => mainlineTool.isEnabled(),
    execute: async (input, context) => {
      const parsed = mainlineTool.inputSchema.safeParse(input)
      if (!parsed.success) {
        return {
          content: parsed.error.issues
            .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('\n'),
          isError: true,
          meta: { source: 'mainline-tool-schema-validation' },
        }
      }

      try {
        const output = await executeMainlineTool(mainlineTool, parsed.data, context, tools)
        if (
          fallbackTool &&
          output.isError &&
          output.meta?.source === 'mainline-tool-call-error' &&
          (context.allowMainlineToolFallback === true ||
            isRecoverableRuntimeDependencyError(output.content))
        ) {
          const fallbackOutput = await fallbackTool.execute(parsed.data, context)
          return {
            ...fallbackOutput,
            meta: {
              ...(fallbackOutput.meta ?? {}),
              mainlineToolAdapter: true,
              mainlineToolName: mainlineTool.name,
              mainlineToolClassCall: true,
              executionFallback: fallbackTool.name,
              fallbackReason: output.content,
            },
          }
        }
        return output
      } catch (error) {
        if (fallbackTool && context.allowMainlineToolFallback === true) {
          const output = await fallbackTool.execute(parsed.data, context)
          return {
            ...output,
            meta: {
              ...(output.meta ?? {}),
              mainlineToolAdapter: true,
              mainlineToolName: mainlineTool.name,
              executionFallback: fallbackTool.name,
              fallbackReason: error instanceof Error ? error.message : String(error),
            },
          }
        }

        return {
          content: error instanceof Error ? error.message : String(error),
          isError: true,
          meta: {
            mainlineToolAdapter: true,
            mainlineToolName: mainlineTool.name,
            mainlineToolClassCall: false,
            source: 'mainline-tool-class-error',
          },
        }
      }
    },
  }
}

function isRecoverableRuntimeDependencyError(content: string): boolean {
  return /uv_spawn|ENOENT|EPERM|EACCES|spawn .* not found|command not found/i.test(content)
}

export async function getMainlineCoreToolAdapters(): Promise<ToolDefinition[]> {
  ensureSourceRuntimeGlobals()
  const tools = MAINLINE_CORE_TOOLS.map(item => item.mainline) as Tools
  return Promise.all(
    MAINLINE_CORE_TOOLS.map(item =>
      adaptMainlineToolToEngine(item.mainline, item.fallback, tools),
    ),
  )
}

export async function registerMainlineCoreToolAdapters(
  registry: ToolRegistry,
): Promise<ToolDefinition[]> {
  const tools = await getMainlineCoreToolAdapters()
  registry.registerAll(tools)
  return tools
}

export async function getMainlineMcpToolAdaptersForClients(
  clients: MCPServerConnection[],
): Promise<ToolDefinition[]> {
  ensureSourceRuntimeGlobals()
  const dynamicMcpTools = (await Promise.all(
    clients.map(client => fetchToolsForClient(client)),
  )).flat()
  const tools = [
    ...MAINLINE_CORE_TOOLS.map(item => item.mainline),
    ...dynamicMcpTools,
  ] as Tools

  return Promise.all(
    dynamicMcpTools.map(tool =>
      adaptMainlineToolToEngine(tool as MainlineTool, undefined, tools),
    ),
  )
}

export async function registerMainlineMcpToolAdapters(
  registry: ToolRegistry,
  clients: MCPServerConnection[],
): Promise<ToolDefinition[]> {
  const tools = await getMainlineMcpToolAdaptersForClients(clients)
  registry.registerAll(tools)
  return tools
}

async function executeMainlineTool(
  tool: MainlineTool,
  input: Record<string, unknown>,
  engineContext: ToolContext,
  tools: Tools,
): Promise<ToolOutput> {
  if (engineContext.cwd) {
    return runWithCwdOverride(engineContext.cwd, () =>
      executeMainlineToolWithCwd(tool, input, engineContext, tools),
    )
  }
  return executeMainlineToolWithCwd(tool, input, engineContext, tools)
}

async function executeMainlineToolWithCwd(
  tool: MainlineTool,
  input: Record<string, unknown>,
  engineContext: ToolContext,
  tools: Tools,
): Promise<ToolOutput> {
  setShellIfWindows()
  if (engineContext.cwd) {
    setCwd(engineContext.cwd)
  }

  const runtime = getOrCreateRuntime(engineContext, tools)
  runtime.context.toolUseId = engineContext.toolUseId
  runtime.context.agentId = engineContext.agentId as any
  if (engineContext.messages) {
    runtime.context.messages = engineContext.messages as any
  }
  if (engineContext.mainlineMcpClients) {
    runtime.context.options.mcpClients = engineContext.mainlineMcpClients
  }

  const validation = tool.validateInput
    ? await tool.validateInput(input, runtime.context)
    : { result: true }
  if (validation && !validation.result) {
    return {
      content: validation.message ?? `${tool.name} input validation failed`,
      isError: true,
      meta: {
        mainlineToolAdapter: true,
        mainlineToolName: tool.name,
        mainlineToolClassCall: false,
        validation: 'failed',
        errorCode: validation.errorCode,
      },
    }
  }

  const permission = await tool.checkPermissions(input, runtime.context)
  const permissionDecision = await resolvePermission(tool.name, input, permission, engineContext)
  if (permissionDecision.behavior === 'deny') {
    return {
      content: permissionDecision.message,
      isError: true,
      meta: {
        mainlineToolAdapter: true,
        mainlineToolName: tool.name,
        mainlineToolClassCall: false,
        validation: 'passed',
        permission: permission.behavior,
        permissionResolution: 'deny',
        permissionSource: 'mainline-tool-checkPermissions',
      },
    }
  }

  const allowedInput = (permissionDecision.updatedInput ?? input) as Record<string, unknown>
  const parentMessage = createAssistantMessage({ content: [] })
  let result: MainlineToolResult<unknown>
  try {
    result = await tool.call(
      allowedInput,
      runtime.context,
      async () => ({
        behavior: 'allow',
        updatedInput: allowedInput,
      }),
      parentMessage,
    )
  } catch (error) {
    const errorContent = error instanceof Error ? error.message : String(error)
    return {
      content: isMcpResultTool(tool.name)
        ? appendMcpRecoveryHint(
            toolResultContentToString(redactCredentialLikeValues(errorContent)),
            true,
          )
        : errorContent,
      isError: true,
      meta: {
        mainlineToolAdapter: true,
        mainlineToolName: tool.name,
        mainlineToolClassCall: true,
        validation: 'passed',
        permission: permission.behavior,
        permissionResolution: permissionDecision.behavior,
        permissionSource: 'mainline-tool-checkPermissions',
        source: 'mainline-tool-call-error',
      },
    }
  }

  applyContextModifier(result, runtime)

  const mapped = tool.mapToolResultToToolResultBlockParam(
    result.data,
    engineContext.toolUseId ?? `${tool.name}-tool-use`,
  )

  const rawContent = toolResultContentToString(mapped.content)
  const isMcpResult = isMcpResultTool(tool.name)
  const content = isMcpResult
    ? appendMcpRecoveryHint(
        toolResultContentToString(redactCredentialLikeValues(rawContent)),
        Boolean(mapped.is_error),
      )
    : rawContent
  return {
    content,
    isError: Boolean(mapped.is_error),
    meta: {
      mainlineToolAdapter: true,
      mainlineToolName: tool.name,
      mainlineToolClassCall: true,
      validation: 'passed',
      permission: permission.behavior,
      permissionResolution: permissionDecision.behavior,
      permissionSource: 'mainline-tool-checkPermissions',
      toolResultMapped: true,
      fileHistorySnapshotCount: runtime.appState.fileHistory.snapshots.length,
      fileHistoryTrackedFileCount: runtime.appState.fileHistory.trackedFiles.size,
    },
  }
}

function isMcpResultTool(toolName: string): boolean {
  return toolName.startsWith('mcp__') ||
    toolName === 'MCPTool' ||
    toolName === 'ListMcpResourcesTool' ||
    toolName === 'ReadMcpResourceTool'
}

function getOrCreateRuntime(engineContext: ToolContext, tools: Tools): MainlineRuntime {
  const runtimeKey = getRuntimeKey(engineContext)
  const existing = runtimeByEngineContext.get(runtimeKey)
  if (existing) return existing

  ensureSourceRuntimeGlobals()
  enableConfigs()
  const toolPermissionContext =
    engineContext.mainlineToolPermissionContext ?? getEmptyToolPermissionContext()
  let appState: AppState = {
    ...getDefaultAppState(),
    ...(engineContext.mainlineInitialAppState ?? {}),
    toolPermissionContext,
  }
  const runtime: MainlineRuntime = {
    appState,
    context: {
      abortController: createAbortController(),
      options: {
        commands: [],
        tools,
        mainLoopModel: process.env.DSXU_MODEL || 'deepseek-v4',
        thinkingConfig: { type: 'disabled' },
        mcpClients: engineContext.mainlineMcpClients ?? [],
        mcpResources: {},
        isNonInteractiveSession: true,
        debug: false,
        verbose: false,
        agentDefinitions: { activeAgents: [], allAgents: [] },
      },
      getAppState: () => runtime.appState,
      setAppState: updater => {
        appState = updater(runtime.appState)
        runtime.appState = appState
      },
      messages: [],
      readFileState: createFileStateCacheWithSizeLimit(),
      dynamicSkillDirTriggers: new Set(),
      setInProgressToolUseIDs: () => {},
      setResponseLength: () => {},
      updateFileHistoryState: updater => {
        appState = {
          ...runtime.appState,
          fileHistory: updater(runtime.appState.fileHistory),
        }
        runtime.appState = appState
      },
      updateAttributionState: () => {},
      fileReadingLimits: {
        maxTokens: 200_000,
      },
      globLimits: {
        maxResults: 100,
      },
    },
  }

  runtimeByEngineContext.set(runtimeKey, runtime)
  return runtime
}

function getRuntimeKey(engineContext: ToolContext): ToolContext {
  return (
    (engineContext as ToolContext & { [MAINLINE_RUNTIME_CONTEXT]?: ToolContext })[
      MAINLINE_RUNTIME_CONTEXT
    ] ?? engineContext
  )
}

function ensureSourceRuntimeGlobals(): void {
  process.env.DSXU_CODE_MODE ??= '1'
  process.env.DSXU_DEFAULT_MODEL ??= 'deepseek-v4-flash'
  process.env.USE_BUILTIN_RIPGREP ??= '1'
  const globalScope = globalThis as typeof globalThis & {
    MACRO?: Record<string, unknown>
  }
  if (globalScope.MACRO) return
  globalScope.MACRO = {
    VERSION: '0.0.0-dsxu-source-runtime',
    PACKAGE_URL: 'dsxu-code',
    NATIVE_PACKAGE_URL: 'dsxu-code',
    FEEDBACK_CHANNEL: 'DSXU support',
    ISSUES_EXPLAINER: 'open a DSXU issue',
    BUILD_TIME: '',
  }
}

async function resolvePermission(
  toolName: string,
  input: Record<string, unknown>,
  permission: any,
  context: ToolContext,
): Promise<{ behavior: 'allow' | 'deny'; updatedInput?: Record<string, unknown>; message: string }> {
  if (permission.behavior === 'allow') {
    return {
      behavior: 'allow',
      updatedInput: permission.updatedInput ?? input,
      message: permission.message ?? 'allowed',
    }
  }

  if (permission.behavior === 'deny') {
    return {
      behavior: 'deny',
      message: permission.message ?? `${toolName} was denied by mainline permissions.`,
    }
  }

  const callback = context.mainlinePermissionCallback
  if (!callback) {
    return {
      behavior: 'deny',
      message:
        permission.message ??
        `${toolName} requires permission, but no DSXU permission callback is configured.`,
    }
  }

  const decision = await callback({ toolName, input, permission })
  if (decision.behavior === 'deny') {
    return {
      behavior: 'deny',
      message: decision.message ?? `${toolName} was denied by the DSXU permission callback.`,
    }
  }

  return {
    behavior: 'allow',
    updatedInput: decision.updatedInput ?? input,
    message: decision.message ?? 'allowed by DSXU permission callback',
  }
}

function applyContextModifier(
  result: MainlineToolResult<unknown>,
  runtime: MainlineRuntime,
): void {
  if (typeof result.contextModifier !== 'function') return
  runtime.context = result.contextModifier(runtime.context)
}

function toolResultContentToString(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'text' in item) {
        return String((item as { text?: unknown }).text ?? '')
      }
      return JSON.stringify(item)
    }).join('\n')
  }
  if (content === undefined || content === null) return ''
  return JSON.stringify(content)
}

function appendMcpRecoveryHint(content: string, isError: boolean): string {
  if (!isError) return content
  return [
    content,
    '',
    'DSXU MCP recovery: treat this as a failed tool result. Replan with the exact server, tool/resource, arguments, and error text; do not report PASS until a later MCP call or source-verification step succeeds.',
  ].join('\n')
}

function safeBoolean(read: () => boolean): boolean {
  try {
    return read()
  } catch {
    return false
  }
}
