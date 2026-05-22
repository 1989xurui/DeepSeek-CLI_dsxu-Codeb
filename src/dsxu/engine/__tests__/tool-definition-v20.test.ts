import { describe, expect, test } from 'bun:test'
import { summarizeToolDefinitionV20 } from '../../../Tool'
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
import { TungstenTool } from '../../../tools/TungstenTool/TungstenTool'

describe('V20 ToolDefinition owner metadata', () => {
  test('summarizes high-risk tool side effects without creating a second registry', () => {
    const native = summarizeToolDefinitionV20(RunNativeTestTool, {
      command: 'bun test',
      cwd: process.cwd(),
      reason: 'focused verification',
    })
    expect(native.name).toBe(RUN_NATIVE_TEST_TOOL_NAME)
    expect(native.owner).toBe('DSXU Semantic Verification Tool')
    expect(native.sideEffects).toContain('native-process-execution')
    expect(native.permissionOwner).toBe('tool-specific permission hook')
    expect(native.inputValid).toBe(true)

    const taskCreate = summarizeToolDefinitionV20(TaskCreateTool, {
      subject: 'Review V20 tool metadata',
      description: 'Confirm ToolDefinition V20 owner evidence',
    })
    expect(taskCreate.owner).toBe('DSXU Task Lifecycle')
    expect(taskCreate.sideEffects).toContain('task-state-write')
    expect(taskCreate.uiProjection).toBe('expanded task list visible state')

    const taskStop = summarizeToolDefinitionV20(TaskStopTool, {
      task_id: 'task-123',
    })
    expect(taskStop.owner).toBe('DSXU Task Lifecycle')
    expect(taskStop.sideEffects).toContain('task-stop')
  })

  test('keeps MCP tools under the mainline MCP adapter owner', () => {
    const summary = summarizeToolDefinitionV20(MCPTool, {})
    expect(summary.owner).toBe('DSXU MCP Tool Adapter')
    expect(summary.sideEffects).toContain('external-mcp-tool-call')
    expect(summary.isMcp).toBe(true)
    expect(summary.permission).toContain('MCPTool checkPermissions')
  })

  test('covers broader V20 side-effect owners without a second tool runtime', () => {
    const summaries = [
      summarizeToolDefinitionV20(FileEditTool, {
        file_path: 'D:\\tmp\\example.ts',
        old_string: 'before',
        new_string: 'after',
      }),
      summarizeToolDefinitionV20(FileWriteTool, {
        file_path: 'D:\\tmp\\example.ts',
        content: 'export const value = 1\n',
      }),
      summarizeToolDefinitionV20(NotebookEditTool, {
        notebook_path: 'D:\\tmp\\example.ipynb',
        new_source: 'print(1)',
      }),
      summarizeToolDefinitionV20(TodoWriteTool, { todos: [] }),
      summarizeToolDefinitionV20(TaskUpdateTool, {
        taskId: 'task-1',
        status: 'deleted',
      }),
      summarizeToolDefinitionV20(AgentTool, {
        description: 'Review metadata',
        prompt: 'Confirm V20 ToolDefinition owners',
      }),
      summarizeToolDefinitionV20(SendMessageTool, {
        to: 'worker',
        message: 'continue',
      }),
      summarizeToolDefinitionV20(TeamCreateTool, {
        team_name: 'v20-review',
      }),
      summarizeToolDefinitionV20(TeamDeleteTool, {}),
      summarizeToolDefinitionV20(RemoteTriggerTool, { action: 'list' }),
      summarizeToolDefinitionV20(CronCreateTool, {
        cron: '*/5 * * * *',
        prompt: 'check status',
        recurring: false,
        durable: false,
      }),
      summarizeToolDefinitionV20(CronListTool, {}),
      summarizeToolDefinitionV20(CronDeleteTool, { id: 'cron-1' }),
      summarizeToolDefinitionV20(WebFetchTool, {
        url: 'https://example.com',
        prompt: 'summarize',
      }),
      summarizeToolDefinitionV20(WebSearchTool, {
        query: 'deepseek coding',
      }),
      summarizeToolDefinitionV20(WorkflowTool, { action: 'list' }),
      summarizeToolDefinitionV20(CollectEvidenceTool, { scope: 'v20' }),
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
      summarizeToolDefinitionV20(FileReadTool, {
        file_path: 'D:\\tmp\\example.ts',
      }),
      summarizeToolDefinitionV20(GrepTool, { pattern: 'runtimeMetadata' }),
      summarizeToolDefinitionV20(GlobTool, { pattern: '**/*.ts' }),
      summarizeToolDefinitionV20(ListMcpResourcesTool, { server: 'filesystem' }),
      summarizeToolDefinitionV20(ReadMcpResourceTool, {
        server: 'filesystem',
        uri: 'file:///tmp/example.txt',
      }),
      summarizeToolDefinitionV20(SkillTool, { skill: 'code-review' }),
      summarizeToolDefinitionV20(ConfigTool, { setting: 'theme' }),
      summarizeToolDefinitionV20(EnterPlanModeTool, {}),
      summarizeToolDefinitionV20(ExitPlanModeV2Tool, {}),
      summarizeToolDefinitionV20(ToolSearchTool, { query: 'edit' }),
      summarizeToolDefinitionV20(EnterWorktreeTool, { name: 'v20-review' }),
      summarizeToolDefinitionV20(ExitWorktreeTool, { action: 'keep' }),
      summarizeToolDefinitionV20(TaskGetTool, { taskId: 'task-1' }),
      summarizeToolDefinitionV20(TaskListTool, {}),
      summarizeToolDefinitionV20(TaskOutputTool, {
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
      summarizeToolDefinitionV20(AskUserQuestionTool, {
        questions: [
          {
            question: 'Which V20 path should continue?',
            header: 'V20 path',
            options: [
              { label: 'Tools', description: 'Continue tool owner review.' },
              { label: 'MCP', description: 'Continue MCP release readiness.' },
            ],
          },
        ],
      }),
      summarizeToolDefinitionV20(BriefTool, {
        message: 'V20 status',
        status: 'normal',
      }),
      summarizeToolDefinitionV20(LSPTool, {
        operation: 'goToDefinition',
        filePath: 'D:\\tmp\\example.ts',
        line: 1,
        character: 1,
      }),
      summarizeToolDefinitionV20(mcpAuthTool, {}),
      summarizeToolDefinitionV20(SyntheticOutputTool, { status: 'ok' }),
      summarizeToolDefinitionV20(TestingPermissionTool, {}),
      summarizeToolDefinitionV20(TungstenTool, {}),
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

    const tungsten = summaries.find(summary => summary.name === 'tungsten')
    expect(tungsten?.owner).toBe('DSXU Disabled Recovery Stub')
    expect(tungsten?.isEnabled).toBe(false)
  })
})
