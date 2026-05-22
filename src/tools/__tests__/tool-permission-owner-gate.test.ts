import { describe, expect, test } from 'bun:test'
import { isAutoModeAllowlistedTool } from '../../utils/permissions/classifierDecision'
import { RemoteTriggerTool } from '../RemoteTriggerTool/RemoteTriggerTool'
import { CronCreateTool } from '../ScheduleCronTool/CronCreateTool'
import { CronDeleteTool } from '../ScheduleCronTool/CronDeleteTool'
import { TASK_CREATE_TOOL_NAME } from '../TaskCreateTool/constants'
import { TaskCreateTool } from '../TaskCreateTool/TaskCreateTool'
import { TASK_UPDATE_TOOL_NAME } from '../TaskUpdateTool/constants'
import { TaskUpdateTool } from '../TaskUpdateTool/TaskUpdateTool'
import { TASK_STOP_TOOL_NAME } from '../TaskStopTool/prompt'
import { TaskStopTool } from '../TaskStopTool/TaskStopTool'
import { TEAM_CREATE_TOOL_NAME } from '../TeamCreateTool/constants'
import { TeamCreateTool } from '../TeamCreateTool/TeamCreateTool'
import { TEAM_DELETE_TOOL_NAME } from '../TeamDeleteTool/constants'
import { TeamDeleteTool } from '../TeamDeleteTool/TeamDeleteTool'
import { EnterWorktreeTool } from '../EnterWorktreeTool/EnterWorktreeTool'
import { ExitWorktreeTool } from '../ExitWorktreeTool/ExitWorktreeTool'

describe('V20 tool permission owner gate', () => {
  test('routes remote trigger mutations through DSXU permission', async () => {
    const list = await RemoteTriggerTool.checkPermissions({
      action: 'list',
    } as never, {} as never)
    const create = await RemoteTriggerTool.checkPermissions({
      action: 'create',
      body: { name: 'daily check' },
    } as never, {} as never)

    expect(list.behavior).toBe('allow')
    expect(create.behavior).toBe('passthrough')
  })

  test('routes scheduled task mutations through DSXU permission', async () => {
    const create = await CronCreateTool.checkPermissions({
      cron: '*/30 * * * *',
      prompt: 'run focused check',
    } as never, {} as never)
    const remove = await CronDeleteTool.checkPermissions({
      id: 'cron_1',
    } as never, {} as never)

    expect(create.behavior).toBe('passthrough')
    expect(remove.behavior).toBe('passthrough')
  })

  test('keeps internal task edits explicit and gates destructive task actions', async () => {
    const create = await TaskCreateTool.checkPermissions({
      subject: 'review',
      description: 'review owner packet',
    } as never, {} as never)
    const update = await TaskUpdateTool.checkPermissions({
      taskId: '1',
      status: 'in_progress',
    } as never, {} as never)
    const deleteTask = await TaskUpdateTool.checkPermissions({
      taskId: '1',
      status: 'deleted',
    } as never, {} as never)
    const stop = await TaskStopTool.checkPermissions({
      task_id: 'task_1',
    } as never, {} as never)

    expect(create.behavior).toBe('allow')
    expect(update.behavior).toBe('allow')
    expect(deleteTask.behavior).toBe('passthrough')
    expect(stop.behavior).toBe('passthrough')
  })

  test('routes team and worktree state changes through explicit owner decisions', async () => {
    const teamCreate = await TeamCreateTool.checkPermissions({
      team_name: 'owner-review',
    } as never, {} as never)
    const teamDelete = await TeamDeleteTool.checkPermissions({} as never, {} as never)
    const enter = await EnterWorktreeTool.checkPermissions({
      name: 'review-branch',
    } as never, {} as never)
    const keep = await ExitWorktreeTool.checkPermissions({
      action: 'keep',
    } as never, {} as never)
    const remove = await ExitWorktreeTool.checkPermissions({
      action: 'remove',
      discard_changes: true,
    } as never, {} as never)

    expect(teamCreate.behavior).toBe('passthrough')
    expect(teamDelete.behavior).toBe('passthrough')
    expect(enter.behavior).toBe('passthrough')
    expect(keep.behavior).toBe('allow')
    expect(remove.behavior).toBe('passthrough')
  })

  test('keeps destructive state tools out of the auto-mode safe allowlist', () => {
    expect(isAutoModeAllowlistedTool(TASK_CREATE_TOOL_NAME)).toBe(true)
    expect(isAutoModeAllowlistedTool(TASK_UPDATE_TOOL_NAME)).toBe(false)
    expect(isAutoModeAllowlistedTool(TASK_STOP_TOOL_NAME)).toBe(false)
    expect(isAutoModeAllowlistedTool(TEAM_CREATE_TOOL_NAME)).toBe(false)
    expect(isAutoModeAllowlistedTool(TEAM_DELETE_TOOL_NAME)).toBe(false)
  })
})
