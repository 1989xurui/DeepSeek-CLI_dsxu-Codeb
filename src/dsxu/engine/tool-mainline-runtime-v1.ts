import { getMainlineCoreToolAdapters } from './engine-tool-adapter';
import { createDefaultBriefGenerator } from './brief/brief-generator';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  appendAgentTaskMessage,
  createAgentTaskLifecycleState,
  projectAgentTaskLifecycleSummary,
  registerAgentTask,
  transitionAgentTask,
  type AgentTaskLifecycleState,
} from './coordinator-v1';
import {
  evaluateToolGate,
  evaluateToolPermissionContext,
  type ToolGateEvaluation,
  type ToolPermissionEvaluation,
} from './tool-gate-v1';
import { buildDsxuToolEvidencePack, type DsxuToolEvidencePack } from './tool-evidence-pack-v1';
import { MCPManager } from './mcp-client';
import { ToolRegistry } from './tool-registry';
import { convertRuntimeToolToV1, createToolRegistryV1 } from './tool-registry-v1';
import type { ToolDefinition, ToolPermissionContext, ToolRuntimeExecutionResult } from './tool-types-v1';
import type { Message, ToolContext } from './types';

export interface MainlineToolExecutionInput {
  toolId: string;
  input: Record<string, any>;
  context: ToolPermissionContext;
  concurrentToolIds?: string[];
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
  const agentLifecycles = new Map<string, AgentTaskLifecycleState>();
  const briefGenerator = createDefaultBriefGenerator();
  const remoteTriggers = new Map<string, { triggerId: string; payload: Record<string, any>; at: number }>();
  const mcpManager = new MCPManager();
  let mcpRegisteredForCwd: string | null = null;

  async function ensureMcpToolsConnected(cwd: string): Promise<void> {
    if (mcpRegisteredForCwd === cwd) return;
    await mcpManager.connectFromConfig(cwd);
    const mcpTools = mcpManager.getToolDefinitions();
    if (mcpTools.length > 0) {
      runtimeRegistry.registerAll(mcpTools);
      v1Registry.registerRuntimeTools(mcpTools);
    }
    mcpRegisteredForCwd = cwd;
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
    const originalToolId = input.toolId.trim();
    const resolvedToolId = resolveToolAlias(originalToolId);
    const managedServiceResult = await tryExecuteMainlineManagedServiceTool(originalToolId, input, {
      briefGenerator,
      remoteTriggers,
      mcpManager,
      ensureMcpToolsConnected,
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
    if (resolvedToolId === 'AgentTool') {
      const agentNormalizedInput = normalizeAgentToolInput(originalToolId, input.input);
      const result = executeAgentTool(
        { ...input, toolId: resolvedToolId, input: agentNormalizedInput },
        agentLifecycles,
      );
      const agentTool = convertRuntimeToolToV1({
        name: 'AgentTool',
        description: 'agent lifecycle tool',
        inputSchema: { type: 'object', properties: { action: { type: 'string' } }, required: ['action'] },
        execute: async () => ({ content: 'ok', isError: false }),
      });
      const permission: ToolPermissionEvaluation = {
        allowed: true,
        reason: 'agent tool uses coordinator lifecycle in mainline runtime',
      };
      const gate = evaluateToolGate(agentTool, {
        allowedPermissionLevel: input.context.allowedPermissionLevel,
        requireConfirmationForWrite: input.context.requireConfirmationForWrite,
      });
      return {
        allowed: true,
        permission,
        gate,
        evidencePack: buildMainlineEvidencePack(input, originalToolId, resolvedToolId, agentTool, permission, gate, result),
        result,
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
      getEngineToolContext(input.context, engineToolContexts),
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
): ToolContext {
  const key = context.sessionId || 'default'
  const existing = contexts.get(key)
  if (existing) {
    existing.cwd = context.cwd
    return existing
  }

  const created: ToolContext = {
    cwd: context.cwd,
    sessionId: context.sessionId,
    gear: 1,
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

    // Agent/task/team lifecycle aliases
    AgentTool: 'AgentTool',
    SendMessageTool: 'AgentTool',
    AskUserQuestionTool: 'AgentTool',
    ConfigTool: 'AgentTool',
    SkillTool: 'AgentTool',
    TodoWriteTool: 'AgentTool',
    EnterPlanModeTool: 'AgentTool',
    ExitPlanModeV2Tool: 'AgentTool',
    EnterWorktreeTool: 'AgentTool',
    ExitWorktreeTool: 'AgentTool',
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
    TaskCreateTool: 'AgentTool',
    TaskGetTool: 'AgentTool',
    TaskListTool: 'AgentTool',
    TaskOutputTool: 'AgentTool',
    TaskUpdateTool: 'AgentTool',
    TaskStopTool: 'AgentTool',
    TeamCreateTool: 'AgentTool',
    TeamDeleteTool: 'AgentTool',
  };
  return aliases[normalized] || normalized;
}

async function tryExecuteMainlineManagedServiceTool(
  originalToolId: string,
  input: MainlineToolExecutionInput,
  deps: {
    briefGenerator: ReturnType<typeof createDefaultBriefGenerator>;
    remoteTriggers: Map<string, { triggerId: string; payload: Record<string, any>; at: number }>;
    mcpManager: MCPManager;
    ensureMcpToolsConnected: (cwd: string) => Promise<void>;
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

  if (originalToolId === 'ListMcpResourcesTool') {
    await deps.ensureMcpToolsConnected(input.context.cwd);
    const targetServer = String(input.input.server || '');
    if (targetServer) {
      const resources = await deps.mcpManager.listResourcesByServer(targetServer);
      return {
        toolUseId: `mcp-resources-${Date.now()}`,
        content: JSON.stringify({ server: targetServer, resources }, null, 2),
        isError: false,
      };
    }
    const servers = deps.mcpManager.getConnectedServerNames();
    const byServer: Record<string, any[]> = {};
    for (const server of servers) {
      byServer[server] = await deps.mcpManager.listResourcesByServer(server);
    }
    return {
      toolUseId: `mcp-resources-${Date.now()}`,
      content: JSON.stringify({ servers, resourcesByServer: byServer }, null, 2),
      isError: false,
    };
  }

  if (originalToolId === 'ReadMcpResourceTool' || originalToolId === 'WriteMcpResourceTool') {
    await deps.ensureMcpToolsConnected(input.context.cwd);
    const server = String(input.input.server || '').trim();
    const uri = String(input.input.uri || '');
    if (!server) {
      return {
        toolUseId: `mcp-read-resource-${Date.now()}`,
        content: 'missing required field: server',
        isError: true,
      };
    }

    const mode = String(input.input.mode || (originalToolId === 'WriteMcpResourceTool' ? 'write' : 'read')).toLowerCase();
    if (mode === 'write') {
      const toolName = String(input.input.writeToolName || 'write_resource');
      const args = {
        uri: String(input.input.uri || ''),
        content: String(input.input.content || ''),
        mimeType: input.input.mimeType,
      };
      const result = await deps.mcpManager.callToolByServer(server, toolName, args);
      return {
        toolUseId: `mcp-write-resource-${Date.now()}`,
        content: normalizeMcpResult(result),
        isError: false,
        meta: { server, toolName },
      };
    }

    if (input.input.uriTemplate) {
      const templateResult = await deps.mcpManager.readResourceTemplateByServer(
        server,
        String(input.input.uriTemplate),
        typeof input.input.arguments === 'object' && input.input.arguments !== null ? input.input.arguments : {},
      );
      return {
        toolUseId: `mcp-read-resource-template-${Date.now()}`,
        content: normalizeMcpResult(templateResult),
        isError: false,
        meta: { server, uriTemplate: input.input.uriTemplate },
      };
    }

    const result = await deps.mcpManager.readResourceByServer(server, uri);
    return {
      toolUseId: `mcp-read-resource-${Date.now()}`,
      content: normalizeMcpResult(result),
      isError: false,
      meta: { server, uri },
    };
  }

  if (originalToolId === 'McpAuthTool') {
    return {
      toolUseId: `mcp-auth-${Date.now()}`,
      content: 'mcp auth is delegated to server-level auth config in .mcp.json and server runtime',
      isError: false,
    };
  }

  if (originalToolId.startsWith('mcp__')) {
    await deps.ensureMcpToolsConnected(input.context.cwd);
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

function normalizeMcpResult(result: any): string {
  if (!result) return '';
  if (Array.isArray(result?.contents)) {
    return result.contents.map((c: any) => c?.text || c?.data || JSON.stringify(c)).join('\n').slice(0, 30_000);
  }
  if (Array.isArray(result?.content)) {
    return result.content.map((c: any) => c?.text || c?.data || JSON.stringify(c)).join('\n').slice(0, 30_000);
  }
  if (typeof result === 'string') return result.slice(0, 30_000);
  return JSON.stringify(result, null, 2).slice(0, 30_000);
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

function normalizeAgentToolInput(originalToolId: string, input: Record<string, any>): Record<string, any> {
  const normalized = originalToolId.trim();
  if (normalized === 'AgentTool') return input;

  const inheritedAgentTaskId = String(input.agentTaskId || input.taskId || input.teamId || `agent-task-${Date.now()}`);
  const inheritedAgentId = String(input.agentId || input.ownerId || 'agent-default');
  const inheritedObjective = String(input.objective || input.title || input.goal || 'no-objective');
  const inheritedMessage = String(input.message || input.content || input.update || input.note || '');

  if (normalized === 'TaskCreateTool' || normalized === 'TeamCreateTool') {
    return {
      ...input,
      action: 'create',
      agentTaskId: inheritedAgentTaskId,
      agentId: inheritedAgentId,
      objective: inheritedObjective,
    };
  }

  if (normalized === 'TaskStopTool' || normalized === 'TeamDeleteTool') {
    return {
      ...input,
      action: 'stop',
      agentTaskId: inheritedAgentTaskId,
      agentId: inheritedAgentId,
      message: inheritedMessage,
    };
  }

  if (
    normalized === 'SendMessageTool' ||
    normalized === 'AskUserQuestionTool' ||
    normalized === 'ConfigTool' ||
    normalized === 'SkillTool' ||
    normalized === 'TodoWriteTool' ||
    normalized === 'EnterPlanModeTool' ||
    normalized === 'ExitPlanModeV2Tool' ||
    normalized === 'EnterWorktreeTool' ||
    normalized === 'ExitWorktreeTool' ||
    normalized === 'TaskUpdateTool' ||
    normalized === 'TaskGetTool' ||
    normalized === 'TaskListTool' ||
    normalized === 'TaskOutputTool'
  ) {
    return {
      ...input,
      action: 'message',
      agentTaskId: inheritedAgentTaskId,
      agentId: inheritedAgentId,
      message: inheritedMessage || `message-from-${normalized}`,
    };
  }

  return input;
}

function executeAgentTool(
  input: MainlineToolExecutionInput,
  lifecycles: Map<string, AgentTaskLifecycleState>,
): ToolRuntimeExecutionResult {
  const sessionId = input.context.sessionId;
  const action = String(input.input.action || '');
  const agentTaskId = String(input.input.agentTaskId || `agent-task-${Date.now()}`);
  const agentId = String(input.input.agentId || 'agent-default');
  const objective = String(input.input.objective || 'no-objective');
  const message = String(input.input.message || '');

  let state = lifecycles.get(sessionId) || createAgentTaskLifecycleState(input.context.sessionId);

  if (action === 'create') {
    state = registerAgentTask(state, { agentTaskId, agentId, objective });
  } else if (action === 'start') {
    state = transitionAgentTask(state, { agentTaskId, to: 'running', reason: 'started-by-mainline' });
  } else if (action === 'pause') {
    state = transitionAgentTask(state, { agentTaskId, to: 'paused', reason: 'paused-by-mainline' });
  } else if (action === 'resume') {
    state = transitionAgentTask(state, { agentTaskId, to: 'running', reason: 'resumed-by-mainline' });
  } else if (action === 'stop') {
    state = transitionAgentTask(state, { agentTaskId, to: 'stopped', reason: 'stopped-by-mainline' });
  } else if (action === 'complete') {
    state = transitionAgentTask(state, { agentTaskId, to: 'completed', reason: 'completed-by-mainline' });
  } else if (action === 'fail') {
    state = transitionAgentTask(state, { agentTaskId, to: 'failed', reason: 'failed-by-mainline' });
  } else if (action === 'message') {
    state = appendAgentTaskMessage(state, { agentTaskId, message });
  }

  lifecycles.set(sessionId, state);
  const summary = projectAgentTaskLifecycleSummary(state);
  return {
    toolUseId: `agent-tool-${Date.now()}`,
    content: `agent-action=${action}; task=${agentTaskId}; summary=${JSON.stringify(summary)}`,
    isError: false,
    meta: { action, agentTaskId, summary },
  };
}
