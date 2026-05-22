import {
  getMainlineCoreToolAdapters,
  getMainlineMcpToolAdaptersForClients,
} from './engine-tool-adapter';
import { createDefaultBriefGenerator } from './brief/brief-generator';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  evaluateToolGate,
  evaluateToolPermissionContext,
  type ToolGateEvaluation,
  type ToolPermissionEvaluation,
} from './tool-gate-v1';
import { buildDsxuToolEvidencePack, type DsxuToolEvidencePack } from './tool-evidence-pack-v1';
import { ToolRegistry } from './tool-registry';
import { convertRuntimeToolToV1, createToolRegistryV1 } from './tool-registry-v1';
import type { ToolDefinition, ToolPermissionContext, ToolRuntimeExecutionResult } from './tool-types-v1';
import type { Message, ToolContext } from './types';
import type { MCPServerConnection } from '../../services/mcp/types';

export interface MainlineToolExecutionInput {
  toolId: string;
  input: Record<string, any>;
  context: ToolPermissionContext;
  concurrentToolIds?: string[];
  mainlineMcpClients?: MCPServerConnection[];
}

export interface MainlineToolExecutionOutput {
  allowed: boolean;
  gate: ReturnType<typeof evaluateToolGate>;
  permission: ReturnType<typeof evaluateToolPermissionContext>;
  evidencePack: DsxuToolEvidencePack;
  result?: ToolRuntimeExecutionResult;
}

interface PersistedCronJob {
  cronId: string;
  schedule: string;
  prompt: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: number;
  updatedAt: number;
}

const CRON_STORE_RELATIVE = path.join('.dsxu', 'cron-jobs.json');

export function createToolMainlineExecutor() {
  const runtimeRegistry = new ToolRegistry();
  const v1Registry = createToolRegistryV1();
  let mainlineToolsReady: Promise<void> | null = null;
  const engineToolContexts = new Map<string, ToolContext>();
  const briefGenerator = createDefaultBriefGenerator();
  const remoteTriggers = new Map<string, { triggerId: string; payload: Record<string, any>; at: number }>();
  let registeredMcpClientKey: string | null = null;

  async function ensureMcpToolsRegistered(clients: MCPServerConnection[] | undefined): Promise<void> {
    const connectedClients = (clients ?? []).filter(client => client.type === 'connected');
    const key = connectedClients.map(client => client.name).sort().join('\n');
    if (registeredMcpClientKey === key) return;
    const mcpTools = await getMainlineMcpToolAdaptersForClients(connectedClients);
    if (mcpTools.length > 0) {
      runtimeRegistry.registerAll(mcpTools);
      v1Registry.registerRuntimeTools(mcpTools);
    }
    registeredMcpClientKey = key;
  }

  function ensureMainlineCoreTools(): Promise<void> {
    if (mainlineToolsReady) return mainlineToolsReady;
    mainlineToolsReady = (async () => {
      const runtimeTools = await getMainlineCoreToolAdapters();
      runtimeRegistry.registerAll(runtimeTools);
      v1Registry.registerRuntimeTools(runtimeTools);
    })();
    return mainlineToolsReady;
  }

  async function execute(input: MainlineToolExecutionInput): Promise<MainlineToolExecutionOutput> {
    await ensureMainlineCoreTools();
    await ensureMcpToolsRegistered(input.mainlineMcpClients);
    const originalToolId = input.toolId.trim();
    const resolvedToolId = resolveToolAlias(originalToolId);
    const managedServiceResult = await tryExecuteMainlineManagedServiceTool(originalToolId, input, {
      briefGenerator,
      remoteTriggers,
    });
    if (managedServiceResult) {
      const managedServiceTool = convertRuntimeToolToV1({
        name: originalToolId,
        description: 'mainline-managed service tool',
        inputSchema: { type: 'object', properties: {}, additionalProperties: true },
        execute: async () => ({ content: 'ok', isError: false }),
      });
      const permission: ToolPermissionEvaluation = { allowed: true, reason: 'mainline-managed service tool path' };
      const gate = evaluateToolGate(managedServiceTool, {
        allowedPermissionLevel: input.context.allowedPermissionLevel,
        requireConfirmationForWrite: input.context.requireConfirmationForWrite,
      });
      return {
        allowed: true,
        permission,
        gate,
        evidencePack: buildMainlineEvidencePack(input, originalToolId, resolvedToolId, managedServiceTool, permission, gate, managedServiceResult),
        result: managedServiceResult,
      };
    }
    const v1Tool = v1Registry.getByToolId(resolvedToolId);
    if (!v1Tool) {
      const missingTool = convertRuntimeToolToV1({
        name: resolvedToolId,
        description: 'missing tool placeholder',
        inputSchema: { type: 'object', properties: {}, additionalProperties: true },
        execute: async () => ({ content: '', isError: true }),
      });
      const permission: ToolPermissionEvaluation = { allowed: false, reason: `tool not found: ${resolvedToolId}` };
      const gate = evaluateToolGate(missingTool, {
        allowedPermissionLevel: input.context.allowedPermissionLevel,
        requireConfirmationForWrite: input.context.requireConfirmationForWrite,
        concurrentToolIds: input.concurrentToolIds,
      });
      return {
        allowed: false,
        permission,
        gate,
        evidencePack: buildMainlineEvidencePack(input, originalToolId, resolvedToolId, missingTool, permission, gate),
      };
    }

    const permission = evaluateToolPermissionContext(v1Tool, input.context);
    const gate = evaluateToolGate(v1Tool, {
      allowedPermissionLevel: input.context.allowedPermissionLevel,
      requireConfirmationForWrite: input.context.requireConfirmationForWrite,
      concurrentToolIds: input.concurrentToolIds,
    });

    const blockedByGate = gate.gateDecision === 'block' || gate.executionDecision === 'deny';
    if (!permission.allowed || blockedByGate) {
      return {
        allowed: false,
        permission,
        gate,
        evidencePack: buildMainlineEvidencePack(input, originalToolId, resolvedToolId, v1Tool, permission, gate),
      };
    }

    const toolUseId = `tool-${Date.now()}`;
    const runtimeResult = await runtimeRegistry.execute(
      resolvedToolId,
      input.input,
      toolUseId,
      getEngineToolContext(input.context, engineToolContexts, input.mainlineMcpClients),
    );

    const result = {
      toolUseId: runtimeResult.toolUseId,
      content: runtimeResult.content,
      isError: runtimeResult.isError,
      meta: runtimeResult.meta,
    };

    return {
      allowed: true,
      permission,
      gate,
      evidencePack: buildMainlineEvidencePack(input, originalToolId, resolvedToolId, v1Tool, permission, gate, result),
      result,
    };
  }

  return {
    execute,
    listCoreTools: () => v1Registry.getAllBaseTools(),
  };
}

function buildMainlineEvidencePack(
  input: MainlineToolExecutionInput,
  originalToolId: string,
  resolvedToolId: string,
  tool: Pick<ToolDefinition, 'capabilityTags' | 'readWriteClass'>,
  permission: ToolPermissionEvaluation,
  gate: ToolGateEvaluation,
  result?: ToolRuntimeExecutionResult,
): DsxuToolEvidencePack {
  return buildDsxuToolEvidencePack({
    queryTurnId: input.context.sessionId || 'unknown-session',
    toolUseId: result?.toolUseId,
    originalToolId,
    resolvedToolId,
    capabilityTags: tool.capabilityTags,
    readWriteClass: tool.readWriteClass,
    permission,
    gate,
    result,
  });
}

function getEngineToolContext(
  context: ToolPermissionContext,
  contexts: Map<string, ToolContext>,
  mainlineMcpClients?: MCPServerConnection[],
): ToolContext {
  const key = context.sessionId || 'default'
  const existing = contexts.get(key)
  if (existing) {
    existing.cwd = context.cwd
    existing.mainlineMcpClients = mainlineMcpClients
    return existing
  }

  const created: ToolContext = {
    cwd: context.cwd,
    sessionId: context.sessionId,
    gear: 1,
    mainlineMcpClients,
    mainlinePermissionCallback: async request => ({
      behavior: 'allow',
      updatedInput: request.input,
      message: 'allowed by DSXU tool mainline gate',
    }),
  }
  contexts.set(key, created)
  return created
}

function resolveToolAlias(toolId: string): string {
  const normalized = toolId.trim();
  const aliases: Record<string, string> = {
    // Core shell/file/search aliases
    Bash: 'Bash',
    BashTool: 'Bash',
    PowerShell: 'PowerShell',
    PowerShellTool: 'PowerShell',
    Read: 'Read',
    FileReadTool: 'Read',
    ReadTool: 'Read',
    Write: 'Write',
    FileWriteTool: 'Write',
    WriteTool: 'Write',
    Edit: 'Edit',
    FileEditTool: 'Edit',
    EditTool: 'Edit',
    NotebookEditTool: 'Edit',
    Grep: 'Grep',
    GlobTool: 'Glob',
    Glob: 'Glob',
    GrepTool: 'Grep',
    LSP: 'LSP',
    LSPTool: 'LSP',
    ToolSearchTool: 'Glob',

    // Agent/task/team lifecycle aliases must land on the real mainline tools,
    // never on a local lifecycle simulator inside this executor.
    AgentTool: 'Agent',
    SendMessageTool: 'SendMessage',
    AskUserQuestionTool: 'AskUserQuestion',
    ConfigTool: 'Config',
    SkillTool: 'Skill',
    TodoWriteTool: 'TodoWrite',
    EnterPlanModeTool: 'EnterPlanMode',
    ExitPlanModeTool: 'ExitPlanMode',
    ExitPlanModeV2Tool: 'ExitPlanMode',
    EnterWorktreeTool: 'EnterWorktree',
    ExitWorktreeTool: 'ExitWorktree',
    BriefTool: 'BriefTool',
    RemoteTriggerTool: 'RemoteTriggerTool',
    CronCreateTool: 'CronCreateTool',
    CronListTool: 'CronListTool',
    CronDeleteTool: 'CronDeleteTool',
    WorkflowTool: 'WorkflowTool',
    WriteMcpResourceTool: 'WriteMcpResourceTool',
    ListMcpResourcesTool: 'ListMcpResourcesTool',
    ReadMcpResourceTool: 'ReadMcpResourceTool',
    McpAuthTool: 'McpAuthTool',
    TaskCreateTool: 'TaskCreate',
    TaskGetTool: 'TaskGet',
    TaskListTool: 'TaskList',
    TaskOutputTool: 'TaskOutput',
    TaskUpdateTool: 'TaskUpdate',
    TaskStopTool: 'TaskStop',
    TeamCreateTool: 'TeamCreate',
    TeamDeleteTool: 'TeamDelete',
  };
  return aliases[normalized] || normalized;
}

async function tryExecuteMainlineManagedServiceTool(
  originalToolId: string,
  input: MainlineToolExecutionInput,
  deps: {
    briefGenerator: ReturnType<typeof createDefaultBriefGenerator>;
    remoteTriggers: Map<string, { triggerId: string; payload: Record<string, any>; at: number }>;
  },
): Promise<ToolRuntimeExecutionResult | null> {
  if (originalToolId === 'BriefTool') {
    const rawMessages = Array.isArray(input.input.messages) ? input.input.messages : [];
    const messages: Message[] = rawMessages
      .filter((m: any) => m && typeof m === 'object')
      .map((m: any) => ({
        role: m.role || 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
      }));
    const fallbackMessages: Message[] = messages.length > 0 ? messages : [
      { role: 'user', content: String(input.input.query || 'brief-request') },
      { role: 'assistant', content: String(input.input.summarySeed || 'no-summary-seed') },
      { role: 'tool', content: 'Tool: BriefTool' },
    ];
    const brief = await deps.briefGenerator.generate(fallbackMessages, {
      sessionId: input.context.sessionId,
      taskId: String(input.input.taskId || ''),
      cwd: input.context.cwd,
      query: String(input.input.query || ''),
    });
    return {
      toolUseId: `brief-tool-${Date.now()}`,
      content: brief.content,
      isError: false,
      meta: { briefId: brief.id, format: brief.format },
    };
  }

  if (originalToolId === 'RemoteTriggerTool') {
    const triggerId = String(input.input.triggerId || `trigger-${Date.now()}`);
    deps.remoteTriggers.set(triggerId, { triggerId, payload: input.input, at: Date.now() });
    return {
      toolUseId: `remote-trigger-${Date.now()}`,
      content: `remote-trigger accepted: ${triggerId}`,
      isError: false,
      meta: { triggerId, queueSize: deps.remoteTriggers.size },
    };
  }

  if (originalToolId === 'CronCreateTool') {
    const cronId = String(input.input.cronId || `cron-${Date.now()}`);
    const schedule = String(input.input.schedule || input.input.rrule || 'FREQ=HOURLY;INTERVAL=1');
    const prompt = String(input.input.prompt || '');
    const status = String(input.input.status || 'ACTIVE') === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
    const jobs = readCronJobsFromDisk(input.context.cwd);
    const now = Date.now();
    jobs.set(cronId, {
      cronId,
      schedule,
      prompt,
      status,
      createdAt: jobs.get(cronId)?.createdAt ?? now,
      updatedAt: now,
    });
    writeCronJobsToDisk(input.context.cwd, jobs);
    return {
      toolUseId: `cron-create-${Date.now()}`,
      content: `cron created: ${cronId}`,
      isError: false,
      meta: { cronId, schedule, status },
    };
  }

  if (originalToolId === 'CronListTool') {
    const jobs = [...readCronJobsFromDisk(input.context.cwd).values()].sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      toolUseId: `cron-list-${Date.now()}`,
      content: JSON.stringify({ jobs }, null, 2),
      isError: false,
      meta: { count: jobs.length },
    };
  }

  if (originalToolId === 'CronDeleteTool') {
    const cronId = String(input.input.cronId || input.input.id || '');
    const jobs = readCronJobsFromDisk(input.context.cwd);
    const existed = cronId ? jobs.delete(cronId) : false;
    writeCronJobsToDisk(input.context.cwd, jobs);
    return {
      toolUseId: `cron-delete-${Date.now()}`,
      content: existed ? `cron deleted: ${cronId}` : `cron not found: ${cronId || '<empty>'}`,
      isError: !existed,
      meta: { cronId, existed },
    };
  }

  if (originalToolId === 'WriteMcpResourceTool') {
    return {
      toolUseId: `mcp-write-resource-${Date.now()}`,
      content: 'WriteMcpResourceTool must be exposed as a named MCP server tool through DSXU mainline MCP clients; tool-mainline-runtime no longer owns a standalone MCP manager.',
      isError: true,
      meta: { owner: 'services/mcp', replaceDeleteCandidate: 'engine-mcp-client' },
    };
  }

  if (originalToolId === 'McpAuthTool') {
    return {
      toolUseId: `mcp-auth-${Date.now()}`,
      content: 'mcp auth is delegated to server-level auth config in .mcp.json and server runtime',
      isError: false,
    };
  }

  if (originalToolId === 'WorkflowTool') {
    const workflowId = String(input.input.workflowId || input.input.id || `workflow-${Date.now()}`);
    const action = String(input.input.action || 'plan');
    const status = action === 'complete' ? 'completed' : action === 'fail' ? 'failed' : 'planned';
    return {
      toolUseId: `workflow-${Date.now()}`,
      content: JSON.stringify({ workflowId, action, status, mainline: 'dsxu-tool-mainline' }),
      isError: false,
      meta: { workflowId, action, status, mainline: 'dsxu-tool-mainline' },
    };
  }

  return null;
}

function resolveCronStorePath(cwd: string): string {
  return path.join(cwd, CRON_STORE_RELATIVE);
}

function readCronJobsFromDisk(cwd: string): Map<string, PersistedCronJob> {
  const storePath = resolveCronStorePath(cwd);
  if (!existsSync(storePath)) return new Map();
  try {
    const raw = readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    return new Map(
      jobs
        .filter((j: any) => j && typeof j.cronId === 'string')
        .map((j: any) => [
          j.cronId,
          {
            cronId: String(j.cronId),
            schedule: String(j.schedule || 'FREQ=HOURLY;INTERVAL=1'),
            prompt: String(j.prompt || ''),
            status: String(j.status || 'ACTIVE') === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
            createdAt: Number(j.createdAt || Date.now()),
            updatedAt: Number(j.updatedAt || Date.now()),
          } as PersistedCronJob,
        ]),
    );
  } catch {
    return new Map();
  }
}

function writeCronJobsToDisk(cwd: string, jobs: Map<string, PersistedCronJob>): void {
  const storePath = resolveCronStorePath(cwd);
  const dir = path.dirname(storePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const payload = {
    version: 1,
    updatedAt: Date.now(),
    jobs: [...jobs.values()],
  };
  writeFileSync(storePath, JSON.stringify(payload, null, 2), 'utf8');
}
