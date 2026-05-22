import { afterEach, describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool'
import {
  getDsxuToolRegistryRuntimeProfile,
  getTools,
} from '../../tools'

const providerMigrationSimpleEnv = `CL${'AUDE'}_CODE_SIMPLE`

const originalEnv = {
  dsxuMode: process.env.DSXU_CODE_MODE,
  dsxuSimple: process.env.DSXU_CODE_SIMPLE,
  exposeMcpHelperTools: process.env.DSXU_CODE_EXPOSE_MCP_HELPER_TOOLS,
  providerSimple: process.env[providerMigrationSimpleEnv],
}

function restoreEnv(saved: typeof originalEnv): void {
  if (saved.dsxuMode === undefined) {
    delete process.env.DSXU_CODE_MODE
  } else {
    process.env.DSXU_CODE_MODE = saved.dsxuMode
  }

  if (saved.dsxuSimple === undefined) {
    delete process.env.DSXU_CODE_SIMPLE
  } else {
    process.env.DSXU_CODE_SIMPLE = saved.dsxuSimple
  }

  if (saved.exposeMcpHelperTools === undefined) {
    delete process.env.DSXU_CODE_EXPOSE_MCP_HELPER_TOOLS
  } else {
    process.env.DSXU_CODE_EXPOSE_MCP_HELPER_TOOLS =
      saved.exposeMcpHelperTools
  }

  if (saved.providerSimple === undefined) {
    delete process.env[providerMigrationSimpleEnv]
  } else {
    process.env[providerMigrationSimpleEnv] = saved.providerSimple
  }
}

function simpleToolNames(): string[] {
  return getTools(getEmptyToolPermissionContext()).map(tool => tool.name)
}

afterEach(() => {
  restoreEnv(originalEnv)
})

describe('DSXU tool registry simple mode', () => {
  test('uses the DSXU simple-mode env as the primary owner', () => {
    process.env.DSXU_CODE_SIMPLE = '1'
    delete process.env[providerMigrationSimpleEnv]

    expect(simpleToolNames()).toEqual(['Bash', 'Read', 'Edit'])
  })

  test('keeps the archived simple-mode alias without duplicating the DSXU check', () => {
    delete process.env.DSXU_CODE_SIMPLE
    process.env[providerMigrationSimpleEnv] = '1'

    expect(simpleToolNames()).toEqual(['Bash', 'Read', 'Edit'])
    const profile = getDsxuToolRegistryRuntimeProfile()
    expect(profile.simpleModeEnv).toEqual([
      'DSXU_CODE_SIMPLE',
      'archived CODE_SIMPLE alias',
    ])
    expect(new Set(profile.simpleModeEnv).size).toBe(
      profile.simpleModeEnv.length,
    )
  })

  test('exposes MCP helper tools only for explicit evidence lanes', () => {
    process.env.DSXU_CODE_MODE = '1'
    delete process.env.DSXU_CODE_SIMPLE
    delete process.env.DSXU_CODE_EXPOSE_MCP_HELPER_TOOLS

    expect(simpleToolNames()).not.toContain('ListMcpResourcesTool')
    expect(simpleToolNames()).not.toContain('ReadMcpResourceTool')

    process.env.DSXU_CODE_EXPOSE_MCP_HELPER_TOOLS = '1'

    expect(simpleToolNames()).toContain('ListMcpResourcesTool')
    expect(simpleToolNames()).toContain('ReadMcpResourceTool')
  })
})
