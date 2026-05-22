import { describe, expect, test } from 'bun:test'
import { summarizeToolDefinitionOwner } from '../../../Tool'
import {
  RUN_NATIVE_TEST_TOOL_NAME,
  RunNativeTestTool,
} from '../../../tools/RunNativeTestTool/RunNativeTestTool'
import { TaskCreateTool } from '../../../tools/TaskCreateTool/TaskCreateTool'
import { TaskStopTool } from '../../../tools/TaskStopTool/TaskStopTool'
import { MCPTool } from '../../../tools/MCPTool/MCPTool'
import { FileEditTool } from '../../../tools/FileEditTool/FileEditTool'
import { FileWriteTool } from '../../../tools/FileWriteTool/FileWriteTool'
import { NotebookEditTool } from '../../../tools/NotebookEditTool/NotebookEditTool'
import { TodoWriteTool } from '../../../tools/TodoWriteTool/TodoWriteTool'
import { TaskUpdateTool } from '../../../tools/TaskUpdateTool/TaskUpdateTool'
import { AgentTool } from '../../../tools/AgentTool/AgentTool'
import { SendMessageTool } from '../../../tools/SendMessageTool/SendMessageTool'
import { TeamCreateTool } from '../../../tools/TeamCreateTool/TeamCreateTool'
import { TeamDeleteTool } from '../../../tools/TeamDeleteTool/TeamDeleteTool'
import { RemoteTriggerTool } from '../../../tools/RemoteTriggerTool/RemoteTriggerTool'
import { CronCreateTool } from '../../../tools/ScheduleCronTool/CronCreateTool'
import { CronListTool } from '../../../tools/ScheduleCronTool/CronListTool'
import { CronDeleteTool } from '../../../tools/ScheduleCronTool/CronDeleteTool'
import { WebFetchTool } from '../../../tools/WebFetchTool/WebFetchTool'
import { WebSearchTool } from '../../../tools/WebSearchTool/WebSearchTool'
import { WorkflowTool } from '../../../tools/WorkflowTool/WorkflowTool'
import { CollectEvidenceTool } from '../../../tools/CollectEvidenceTool/CollectEvidenceTool'
import { FileReadTool } from '../../../tools/FileReadTool/FileReadTool'
import { GrepTool } from '../../../tools/GrepTool/GrepTool'
import { GlobTool } from '../../../tools/GlobTool/GlobTool'
import { ListMcpResourcesTool } from '../../../tools/ListMcpResourcesTool/ListMcpResourcesTool'
import { ReadMcpResourceTool } from '../../../tools/ReadMcpResourceTool/ReadMcpResourceTool'
import { SkillTool } from '../../../tools/SkillTool/SkillTool'
import { ConfigTool } from '../../../tools/ConfigTool/ConfigTool'
import { EnterPlanModeTool } from '../../../tools/EnterPlanModeTool/EnterPlanModeTool'
import { ExitPlanModeV2Tool } from '../../../tools/ExitPlanModeTool/ExitPlanModeV2Tool'
import { ToolSearchTool } from '../../../tools/ToolSearchTool/ToolSearchTool'
import { EnterWorktreeTool } from '../../../tools/EnterWorktreeTool/EnterWorktreeTool'
import { ExitWorktreeTool } from '../../../tools/ExitWorktreeTool/ExitWorktreeTool'
import { TaskGetTool } from '../../../tools/TaskGetTool/TaskGetTool'
import { TaskListTool } from '../../../tools/TaskListTool/TaskListTool'
import { TaskOutputTool } from '../../../tools/TaskOutputTool/TaskOutputTool'
import { AskUserQuestionTool } from '../../../tools/AskUserQuestionTool/AskUserQuestionTool'
import { BriefTool } from '../../../tools/BriefTool/BriefTool'
import { LSPTool } from '../../../tools/LSPTool/LSPTool'
import { createMcpAuthTool } from '../../../tools/McpAuthTool/McpAuthTool'
import { SyntheticOutputTool } from '../../../tools/SyntheticOutputTool/SyntheticOutputTool'
import { TestingPermissionTool } from '../../../tools/testing/TestingPermissionTool'

describe('ToolDefinition owner metadata', () => {
  test('summarizes high-risk tool side effects without creating a second registry', () => {
    const native = summarizeToolDefinitionOwner(RunNativeTestTool, {
      command: 'bun test',
      cwd: process.cwd(),
      reason: 'focused verification',
    })
    expect(native.name).toBe(RUN_NATIVE_TEST_TOOL_NAME)
    expect(native.owner).toBe('DSXU Semantic Verification Tool')
    expect(native.sideEffects).toContain('native-process-execution')
    expect(native.permissionOwner).toBe('tool-specific permission hook')
    expect(native.inputValid).toBe(true)

    const taskCreate = summarizeToolDefinitionOwner(TaskCreateTool, {
      subject: 'Review tool metadata',
      description: 'Confirm ToolDefinition owner evidence',
    })
    expect(taskCreate.owner).toBe('DSXU Task Lifecycle')
    expect(taskCreate.sideEffects).toContain('task-state-write')
    expect(taskCreate.uiProjection).toBe('expanded task list visible state')

    const taskStop = summarizeToolDefinitionOwner(TaskStopTool, {
      task_id: 'task-123',
    })
    expect(taskStop.owner).toBe('DSXU Task Lifecycle')
    expect(taskStop.sideEffects).toContain('task-stop')
  })

  test('keeps MCP tools under the mainline MCP adapter owner', () => {
    const summary = summarizeToolDefinitionOwner(MCPTool, {})
    expect(summary.owner).toBe('DSXU MCP Tool Adapter')
    expect(summary.sideEffects).toContain('external-mcp-tool-call')
    expect(summary.isMcp).toBe(true)
    expect(summary.permission).toContain('MCPTool checkPermissions')
  })

  test('covers broader side-effect owners without a second tool runtime', () => {
    const summaries = [
      summarizeToolDefinitionOwner(FileEditTool, {
        file_path: 'D:\\tmp\\example.ts',
        old_string: 'before',
        new_string: 'after',
      }),
      summarizeToolDefinitionOwner(FileWriteTool, {
        file_path: 'D:\\tmp\\example.ts',
        content: 'export const value = 1\n',
      }),
      summarizeToolDefinitionOwner(NotebookEditTool, {
        notebook_path: 'D:\\tmp\\example.ipynb',
        new_source: 'print(1)',
      }),
      summarizeToolDefinitionOwner(TodoWriteTool, { todos: [] }),
      summarizeToolDefinitionOwner(TaskUpdateTool, {
        taskId: 'task-1',
        status: 'deleted',
      }),
      summarizeToolDefinitionOwner(AgentTool, {
        description: 'Review metadata',
        prompt: 'Confirm ToolDefinition owners',
      }),
      summarizeToolDefinitionOwner(SendMessageTool, {
        to: 'worker',
        message: 'continue',
      }),
      summarizeToolDefinitionOwner(TeamCreateTool, {
        team_name: 'v20-review',
      }),
      summarizeToolDefinitionOwner(TeamDeleteTool, {}),
      summarizeToolDefinitionOwner(RemoteTriggerTool, { action: 'list' }),
      summarizeToolDefinitionOwner(CronCreateTool, {
        cron: '*/5 * * * *',
        prompt: 'check status',
        recurring: false,
        durable: false,
      }),
      summarizeToolDefinitionOwner(CronListTool, {}),
      summarizeToolDefinitionOwner(CronDeleteTool, { id: 'cron-1' }),
      summarizeToolDefinitionOwner(WebFetchTool, {
        url: 'https://example.com',
        prompt: 'summarize',
      }),
      summarizeToolDefinitionOwner(WebSearchTool, {
        query: 'deepseek coding',
      }),
      summarizeToolDefinitionOwner(WorkflowTool, { action: 'list' }),
      summarizeToolDefinitionOwner(CollectEvidenceTool, { scope: 'tool-owner' }),
    ]

    for (const summary of summaries) {
      expect(summary.owner).not.toBe('DSXU Tool Lifecycle')
      expect(summary.sideEffects.length).toBeGreaterThan(0)
      expect(summary.evidence.length).toBeGreaterThan(0)
      expect(summary.inputValid).toBe(true)
    }

    expect(summaries.map(summary => summary.owner)).toContain('DSXU File Mutation Tool')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU Agent Orchestrator')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU Scheduled Task Lifecycle')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU Network Read Tool')
  })

  test('covers read, discovery, plan, worktree, MCP resource, and skill owners', () => {
    const summaries = [
      summarizeToolDefinitionOwner(FileReadTool, {
        file_path: 'D:\\tmp\\example.ts',
      }),
      summarizeToolDefinitionOwner(GrepTool, { pattern: 'runtimeMetadata' }),
      summarizeToolDefinitionOwner(GlobTool, { pattern: '**/*.ts' }),
      summarizeToolDefinitionOwner(ListMcpResourcesTool, { server: 'filesystem' }),
      summarizeToolDefinitionOwner(ReadMcpResourceTool, {
        server: 'filesystem',
        uri: 'file:///tmp/example.txt',
      }),
      summarizeToolDefinitionOwner(SkillTool, { skill: 'code-review' }),
      summarizeToolDefinitionOwner(ConfigTool, { setting: 'theme' }),
      summarizeToolDefinitionOwner(EnterPlanModeTool, {}),
      summarizeToolDefinitionOwner(ExitPlanModeV2Tool, {}),
      summarizeToolDefinitionOwner(ToolSearchTool, { query: 'edit' }),
      summarizeToolDefinitionOwner(EnterWorktreeTool, { name: 'tool-owner-review' }),
      summarizeToolDefinitionOwner(ExitWorktreeTool, { action: 'keep' }),
      summarizeToolDefinitionOwner(TaskGetTool, { taskId: 'task-1' }),
      summarizeToolDefinitionOwner(TaskListTool, {}),
      summarizeToolDefinitionOwner(TaskOutputTool, {
        task_id: 'task-1',
        block: false,
      }),
    ]

    for (const summary of summaries) {
      expect(summary.owner).not.toBe('DSXU Tool Lifecycle')
      expect(summary.evidence.length).toBeGreaterThan(0)
      expect(summary.uiProjection.length).toBeGreaterThan(0)
      expect(summary.inputValid).toBe(true)
    }

    expect(summaries.map(summary => summary.owner)).toContain('DSXU File Read Tool')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU MCP Resource Adapter')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU Skill Runtime Adapter')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU Worktree Lifecycle')
  })

  test('covers user-facing, LSP, MCP auth, structured output, and test-only fixtures', () => {
    const mcpAuthTool = createMcpAuthTool('github', {
      scope: 'project',
      type: 'http',
      url: 'https://example.com/mcp',
    })

    const summaries = [
      summarizeToolDefinitionOwner(AskUserQuestionTool, {
        questions: [
          {
            question: 'Which owner path should continue?',
            header: 'Owner path',
            options: [
              { label: 'Tools', description: 'Continue tool owner review.' },
              { label: 'MCP', description: 'Continue MCP release readiness.' },
            ],
          },
        ],
      }),
      summarizeToolDefinitionOwner(BriefTool, {
        message: 'Owner status',
        status: 'normal',
      }),
      summarizeToolDefinitionOwner(LSPTool, {
        operation: 'goToDefinition',
        filePath: 'D:\\tmp\\example.ts',
        line: 1,
        character: 1,
      }),
      summarizeToolDefinitionOwner(mcpAuthTool, {}),
      summarizeToolDefinitionOwner(SyntheticOutputTool, { status: 'ok' }),
      summarizeToolDefinitionOwner(TestingPermissionTool, {}),
    ]

    for (const summary of summaries) {
      expect(summary.owner).not.toBe('DSXU Tool Lifecycle')
      expect(summary.sideEffects.length).toBeGreaterThan(0)
      expect(summary.inputValid).toBe(true)
    }

    expect(summaries.map(summary => summary.owner)).toContain('DSXU User Interaction Surface')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU LSP Tool Adapter')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU MCP Auth Adapter')
    expect(summaries.map(summary => summary.owner)).toContain('DSXU Test-Only Permission Fixture')
  })
})
