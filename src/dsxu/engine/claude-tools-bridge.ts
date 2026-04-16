/**
 * Claude Code 原有工具 → DSXU 引擎桥接器
 *
 * 目标：将 Claude Code 的 44 个工具全部吸收到 DSXU 引擎中
 * 实现 100% 能力吸收
 */

import type { ToolDefinition } from './types'

// 导入 Claude Code 原有工具
import { AgentTool } from '../../tools/AgentTool/AgentTool.js'
import { SkillTool } from '../../tools/SkillTool/SkillTool.js'
import { BashTool } from '../../tools/BashTool/BashTool.js'
import { FileEditTool } from '../../tools/FileEditTool/FileEditTool.js'
import { FileReadTool } from '../../tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from '../../tools/FileWriteTool/FileWriteTool.js'
import { GlobTool } from '../../tools/GlobTool/GlobTool.js'
import { NotebookEditTool } from '../../tools/NotebookEditTool/NotebookEditTool.js'
import { WebFetchTool } from '../../tools/WebFetchTool/WebFetchTool.js'
import { TaskStopTool } from '../../tools/TaskStopTool/TaskStopTool.js'
import { BriefTool } from '../../tools/BriefTool/BriefTool.js'
import { TaskOutputTool } from '../../tools/TaskOutputTool/TaskOutputTool.js'
import { WebSearchTool } from '../../tools/WebSearchTool/WebSearchTool.js'
import { TodoWriteTool } from '../../tools/TodoWriteTool/TodoWriteTool.js'
import { ExitPlanModeV2Tool } from '../../tools/ExitPlanModeTool/ExitPlanModeV2Tool.js'
import { TestingPermissionTool } from '../../tools/testing/TestingPermissionTool.js'
import { GrepTool } from '../../tools/GrepTool/GrepTool.js'
import { TungstenTool } from '../../tools/TungstenTool/TungstenTool.js'
import { AskUserQuestionTool } from '../../tools/AskUserQuestionTool/AskUserQuestionTool.js'
import { LSPTool } from '../../tools/LSPTool/LSPTool.js'
import { ListMcpResourcesTool } from '../../tools/ListMcpResourcesTool/ListMcpResourcesTool.js'
import { ReadMcpResourceTool } from '../../tools/ReadMcpResourceTool/ReadMcpResourceTool.js'
import { ToolSearchTool } from '../../tools/ToolSearchTool/ToolSearchTool.js'
import { EnterPlanModeTool } from '../../tools/EnterPlanModeTool/EnterPlanModeTool.js'
import { EnterWorktreeTool } from '../../tools/EnterWorktreeTool/EnterWorktreeTool.js'
import { ExitWorktreeTool } from '../../tools/ExitWorktreeTool/ExitWorktreeTool.js'
import { ConfigTool } from '../../tools/ConfigTool/ConfigTool.js'
import { TaskCreateTool } from '../../tools/TaskCreateTool/TaskCreateTool.js'
import { TaskGetTool } from '../../tools/TaskGetTool/TaskGetTool.js'
import { TaskUpdateTool } from '../../tools/TaskUpdateTool/TaskUpdateTool.js'
import { TaskListTool } from '../../tools/TaskListTool/TaskListTool.js'

// 动态导入的工具（条件加载）
let REPLTool: any = null
let SleepTool: any = null
let cronTools: any[] = []
let RemoteTriggerTool: any = null
let SendMessageTool: any = null
let TeamCreateTool: any = null
let TeamDeleteTool: any = null
let BriefTool: any = null
let PowerShellTool: any = null
let McpAuthTool: any = null
let SyntheticOutputTool: any = null
let ToolSearchClearTool: any = null

// 初始化动态工具
function initDynamicTools() {
  // 这些工具可能需要条件加载，这里简化处理
  try {
    // 尝试导入动态工具
    const { REPLTool: REPL } = require('../../tools/REPLTool/REPLTool.js')
    REPLTool = REPL
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { SleepTool: Sleep } = require('../../tools/SleepTool/SleepTool.js')
    SleepTool = Sleep
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { CronCreateTool } = require('../../tools/ScheduleCronTool/CronCreateTool.js')
    cronTools.push(CronCreateTool)
  } catch (e) {
    console.warn('[工具桥接] 无法导入 CronCreateTool:', e.message)
  }

  try {
    const { CronDeleteTool } = require('../../tools/ScheduleCronTool/CronDeleteTool.js')
    cronTools.push(CronDeleteTool)
  } catch (e) {
    console.warn('[工具桥接] 无法导入 CronDeleteTool:', e.message)
  }

  try {
    const { CronListTool } = require('../../tools/ScheduleCronTool/CronListTool.js')
    cronTools.push(CronListTool)
  } catch (e) {
    console.warn('[工具桥接] 无法导入 CronListTool:', e.message)
  }

  try {
    const { RemoteTriggerTool: RemoteTrigger } = require('../../tools/RemoteTriggerTool/RemoteTriggerTool.js')
    RemoteTriggerTool = RemoteTrigger
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { SendMessageTool: SendMessage } = require('../../tools/SendMessageTool/SendMessageTool.js')
    SendMessageTool = SendMessage
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { TeamCreateTool: TeamCreate } = require('../../tools/TeamCreateTool/TeamCreateTool.js')
    TeamCreateTool = TeamCreate
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { TeamDeleteTool: TeamDelete } = require('../../tools/TeamDeleteTool/TeamDeleteTool.js')
    TeamDeleteTool = TeamDelete
  } catch (e) {
    // 忽略导入错误
  }

  // 添加缺失的工具
  try {
    const { BriefTool: Brief } = require('../../tools/BriefTool/BriefTool.js')
    BriefTool = Brief
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { PowerShellTool: PowerShell } = require('../../tools/PowerShellTool/PowerShellTool.js')
    PowerShellTool = PowerShell
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { createMcpAuthTool: McpAuth } = require('../../tools/McpAuthTool/McpAuthTool.js')
    McpAuthTool = McpAuth
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { isSyntheticOutputTool: SyntheticOutput } = require('../../tools/SyntheticOutputTool/SyntheticOutputTool.js')
    SyntheticOutputTool = SyntheticOutput
  } catch (e) {
    // 忽略导入错误
  }

  try {
    const { clearTool: ToolSearchClear } = require('../../tools/ToolSearchTool/ToolSearchTool.js')
    ToolSearchClearTool = ToolSearchClear
  } catch (e) {
    // 忽略导入错误
  }
}

// Claude Tool → DSXU Tool 适配器
function adaptClaudeTool(claudeTool: any): ToolDefinition {
  return {
    name: claudeTool.name,
    description: claudeTool.description || `Claude Code tool: ${claudeTool.name}`,
    inputSchema: claudeTool.inputSchema || {
      type: 'object',
      properties: {},
      additionalProperties: true
    },
    concurrencySafe: claudeTool.concurrencySafe !== undefined ? claudeTool.concurrencySafe : true,
    readOnly: claudeTool.readOnly !== undefined ? claudeTool.readOnly : false,
    execute: async (input, context) => {
      try {
        // 调用 Claude 工具的执行函数
        const result = await claudeTool.execute(input, {
          cwd: context.cwd,
          // 传递其他必要的上下文
          fileHistory: context.fileHistory,
          toolUseId: context.toolUseId
        })

        // 适配返回格式
        return {
          content: result.content || '',
          isError: result.isError || false,
          meta: result.meta || {}
        }
      } catch (error: any) {
        return {
          content: `Claude tool execution error: ${error.message}`,
          isError: true,
          meta: { error: error.message }
        }
      }
    }
  }
}

// 获取所有 Claude 工具
export function getAllClaudeTools(): ToolDefinition[] {
  // 初始化动态工具
  initDynamicTools()

  const claudeTools = [
    AgentTool,
    SkillTool,
    BashTool,
    FileEditTool,
    FileReadTool,
    FileWriteTool,
    GlobTool,
    NotebookEditTool,
    WebFetchTool,
    TaskStopTool,
    BriefTool,
    TaskOutputTool,
    WebSearchTool,
    TodoWriteTool,
    ExitPlanModeV2Tool,
    TestingPermissionTool,
    GrepTool,
    TungstenTool,
    AskUserQuestionTool,
    LSPTool,
    ListMcpResourcesTool,
    ReadMcpResourceTool,
    ToolSearchTool,
    EnterPlanModeTool,
    EnterWorktreeTool,
    ExitWorktreeTool,
    ConfigTool,
    TaskCreateTool,
    TaskGetTool,
    TaskUpdateTool,
    TaskListTool
  ]

  // 添加动态工具
  if (REPLTool) claudeTools.push(REPLTool)
  if (SleepTool) claudeTools.push(SleepTool)
  if (RemoteTriggerTool) claudeTools.push(RemoteTriggerTool)
  if (SendMessageTool) claudeTools.push(SendMessageTool)
  if (TeamCreateTool) claudeTools.push(TeamCreateTool)
  if (TeamDeleteTool) claudeTools.push(TeamDeleteTool)

  // 添加缺失的工具
  if (BriefTool) claudeTools.push(BriefTool)
  if (PowerShellTool) claudeTools.push(PowerShellTool)
  if (McpAuthTool) claudeTools.push(McpAuthTool)
  if (SyntheticOutputTool) claudeTools.push(SyntheticOutputTool)
  if (ToolSearchClearTool) claudeTools.push(ToolSearchClearTool)

  // 添加定时任务工具
  cronTools.forEach(tool => {
    if (tool) claudeTools.push(tool)
  })

  // 适配所有工具
  return claudeTools
    .filter(tool => tool && tool.name) // 过滤有效工具
    .map(adaptClaudeTool)
}

// 工具去重（按名称），处理Claude和DSXU的重复工具
function dedupeTools(tools: ToolDefinition[]): ToolDefinition[] {
  const seen = new Set<string>()
  const result: ToolDefinition[] = []

  // 名称映射：Claude工具名 -> DSXU工具名
  const nameMapping: Record<string, string> = {
    'askuserquestion': 'askuser',
    'fileedit': 'edit',
    'fileread': 'read',
    'filewrite': 'write',
    'exitplanmodev2': 'exitplanmode'
  }

  // 优先保留的工具（DSXU版本优先）
  const preferredTools = new Set(['bash', 'read', 'write', 'edit', 'grep', 'glob', 'askuser'])

  for (const tool of tools) {
    let key = tool.name.toLowerCase().trim()
    if (!key) continue

    // 应用名称映射
    if (nameMapping[key]) {
      key = nameMapping[key]
    }

    if (seen.has(key)) {
      // 如果已经存在，检查是否应该替换
      const existingIndex = result.findIndex(t =>
        t.name.toLowerCase().trim() === key ||
        (nameMapping[t.name.toLowerCase().trim()] === key)
      )

      if (existingIndex !== -1) {
        const existingTool = result[existingIndex]
        // 如果新工具是优先工具，替换旧工具
        if (preferredTools.has(key) && !preferredTools.has(existingTool.name.toLowerCase())) {
          result[existingIndex] = tool
        }
        // 否则保留现有的
      }
      continue
    }

    seen.add(key)
    result.push(tool)
  }

  return result
}

// 获取完整的工具池（Claude + DSXU）
export function getFullToolCapabilityPool(): ToolDefinition[] {
  // 导入 DSXU 原有工具
  const { getCoreTools, getReadOnlyTools } = require('./builtin-tools')
  const { getExtendedTools } = require('./extended-tools')
  const { getDebugTools } = require('./debug-tools')
  const { BlastRadiusTool } = require('./blast-radius')
  const { AccessibilityTreeTool } = require('./accessibility-tree')

  const dsxuTools = [
    ...getCoreTools(),
    ...getExtendedTools(),
    ...getDebugTools(),
    BlastRadiusTool,
    AccessibilityTreeTool
  ]

  const claudeTools = getAllClaudeTools()

  // 合并并去重
  const allTools = dedupeTools([...dsxuTools, ...claudeTools])

  console.log(`[工具桥接] 合并完成: DSXU=${dsxuTools.length} + Claude=${claudeTools.length} = 总计${allTools.length}个工具`)

  return allTools
}

// 工具池快照
export function getFullToolPoolSnapshot() {
  const tools = getFullToolCapabilityPool()

  return {
    total: tools.length,
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      readOnly: t.readOnly,
      concurrencySafe: t.concurrencySafe
    })),
    categories: {
      core: tools.filter(t => ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob'].includes(t.name)).length,
      extended: tools.filter(t => ['WebFetch', 'WebSearch', 'TodoWrite', 'AskUser'].includes(t.name)).length,
      debug: tools.filter(t => t.name.includes('Debug')).length,
      analysis: tools.filter(t => ['BlastRadius', 'AccessibilityTree'].includes(t.name)).length,
      claude: tools.length - 16 // 减去 DSXU 原有的 16 个工具
    }
  }
}