import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { getEmptyToolPermissionContext } from '../../../Tool'
import { registerMainlineCoreToolAdapters } from '../../engine/engine-tool-adapter'
import type { ToolContext, ToolResult } from '../../engine/types'
import { ToolRegistry } from '../../engine/tool-registry'

export type PermissionFloorCase = {
  id: string
  toolName: 'Bash' | 'PowerShell'
  command: string
  expected: {
    isError: boolean
    permissionResolution?: string
    mainlineToolClassCall?: boolean
    targetExists?: boolean
    contentIncludes?: string
  }
  actual: {
    isError: boolean
    contentSnippet: string
    permission?: unknown
    permissionResolution?: unknown
    permissionSource?: unknown
    mainlineToolClassCall?: unknown
    targetExists?: boolean
    targetContent?: string
  }
  pass: boolean
}

export type PermissionFloorResult = {
  ok: boolean
  evidencePath: string
  cwd: string
  cases: PermissionFloorCase[]
}

export type PermissionFloorOptions = {
  repoRoot?: string
  evidenceDir?: string
}

function makeContext(
  cwd: string,
  sessionId: string,
  sessionRules: {
    allow?: string[]
    deny?: string[]
  },
): ToolContext {
  return {
    cwd,
    sessionId,
    gear: 1,
    mainlineToolPermissionContext: {
      ...getEmptyToolPermissionContext(),
      alwaysAllowRules: sessionRules.allow?.length
        ? { session: sessionRules.allow }
        : {},
      alwaysDenyRules: sessionRules.deny?.length
        ? { session: sessionRules.deny }
        : {},
    },
  }
}

function snippet(content: string): string {
  return content.replace(/\s+/g, ' ').slice(0, 500)
}

function casePassed(
  result: ToolResult,
  expected: PermissionFloorCase['expected'],
  targetPath?: string,
): PermissionFloorCase['actual'] & { pass: boolean } {
  const targetExists = targetPath ? existsSync(targetPath) : undefined
  const targetContent =
    targetPath && targetExists ? readFileSync(targetPath, 'utf8') : undefined
  const actual = {
    isError: result.isError,
    contentSnippet: snippet(result.content),
    permission: result.meta?.permission,
    permissionResolution: result.meta?.permissionResolution,
    permissionSource: result.meta?.permissionSource,
    mainlineToolClassCall: result.meta?.mainlineToolClassCall,
    targetExists,
    targetContent,
  }
  const pass =
    actual.isError === expected.isError &&
    (expected.permissionResolution === undefined ||
      actual.permissionResolution === expected.permissionResolution) &&
    (expected.mainlineToolClassCall === undefined ||
      actual.mainlineToolClassCall === expected.mainlineToolClassCall) &&
    (expected.targetExists === undefined ||
      actual.targetExists === expected.targetExists) &&
    (expected.contentIncludes === undefined ||
      result.content.includes(expected.contentIncludes) ||
      targetContent?.includes(expected.contentIncludes) === true)

  return { ...actual, pass }
}

export async function runAllowedToolsPermissionFloor(
  options: PermissionFloorOptions = {},
): Promise<PermissionFloorResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd())
  const evidenceDir =
    options.evidenceDir ?? join(repoRoot, '.dsxu', 'trace', 'v18-permissions')
  const evidencePath = join(evidenceDir, 'allowed-tools-permission-floor.json')
  mkdirSync(evidenceDir, { recursive: true })

  const cwd = mkdtempSync(join(tmpdir(), 'dsxu-v18-permission-floor-'))
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify(
      {
        scripts: {
          test: 'node -e "console.log(\\"DSXU_GRANULAR_TEST_ALLOWED\\")"',
        },
      },
      null,
      2,
    ),
    'utf8',
  )

  const registry = new ToolRegistry()
  await registerMainlineCoreToolAdapters(registry)

  const broadContext = makeContext(cwd, 'v18-broad-shell-allowedtools', {
    allow: ['Bash', 'PowerShell'],
  })
  const granularPowerShellCommand =
    'Start-Sleep -Milliseconds 1; Write-Output DSXU_PS_GRANULAR_ALLOWED'
  const granularContext = makeContext(cwd, 'v18-granular-shell-allowedtools', {
    allow: ['Bash(bun run test)', `PowerShell(${granularPowerShellCommand})`],
  })
  const denyPriorityContext = makeContext(cwd, 'v18-shell-deny-priority', {
    allow: ['Bash', 'PowerShell'],
    deny: ['Bash(echo DSXU_DENY_PRIORITY:*)', 'PowerShell(Remove-Item:*)'],
  })

  const definitions: Array<{
    id: string
    toolName: 'Bash' | 'PowerShell'
    command: string
    context: ToolContext
    targetPath?: string
    expected: PermissionFloorCase['expected']
  }> = [
    {
      id: 'bash-broad-readonly-allowed',
      toolName: 'Bash',
      command: 'pwd',
      context: broadContext,
      expected: {
        isError: false,
        permissionResolution: 'allow',
        mainlineToolClassCall: true,
      },
    },
    {
      id: 'bash-broad-write-denied',
      toolName: 'Bash',
      command: 'echo DSXU_BROAD_BASH_DENIED > broad-bash-denied.txt',
      context: broadContext,
      targetPath: join(cwd, 'broad-bash-denied.txt'),
      expected: {
        isError: true,
        permissionResolution: 'deny',
        mainlineToolClassCall: false,
        targetExists: false,
      },
    },
    {
      id: 'bash-broad-test-denied',
      toolName: 'Bash',
      command: 'bun run test',
      context: broadContext,
      expected: {
        isError: true,
        permissionResolution: 'deny',
        mainlineToolClassCall: false,
      },
    },
    {
      id: 'bash-granular-test-allowed',
      toolName: 'Bash',
      command: 'bun run test',
      context: granularContext,
      expected: {
        isError: false,
        permissionResolution: 'allow',
        mainlineToolClassCall: true,
        contentIncludes: 'DSXU_GRANULAR_TEST_ALLOWED',
      },
    },
    {
      id: 'powershell-broad-readonly-allowed',
      toolName: 'PowerShell',
      command: 'Get-Location',
      context: broadContext,
      expected: {
        isError: false,
        permissionResolution: 'allow',
        mainlineToolClassCall: true,
      },
    },
    {
      id: 'powershell-broad-write-denied',
      toolName: 'PowerShell',
      command:
        'Set-Content -Path broad-ps-denied.txt -Value DSXU_BROAD_PS_DENIED',
      context: broadContext,
      targetPath: join(cwd, 'broad-ps-denied.txt'),
      expected: {
        isError: true,
        permissionResolution: 'deny',
        mainlineToolClassCall: false,
        targetExists: false,
      },
    },
    {
      id: 'powershell-granular-expression-allowed',
      toolName: 'PowerShell',
      command: granularPowerShellCommand,
      context: granularContext,
      expected: {
        isError: false,
        permissionResolution: 'allow',
        mainlineToolClassCall: true,
        contentIncludes: 'DSXU_PS_GRANULAR_ALLOWED',
      },
    },
    {
      id: 'powershell-deny-priority-over-broad-allow',
      toolName: 'PowerShell',
      command: 'rm definitely-missing-v18-file',
      context: denyPriorityContext,
      expected: {
        isError: true,
        permissionResolution: 'deny',
        mainlineToolClassCall: false,
      },
    },
    {
      id: 'bash-deny-priority-over-broad-allow',
      toolName: 'Bash',
      command: 'echo DSXU_DENY_PRIORITY > deny-priority.txt',
      context: denyPriorityContext,
      targetPath: join(cwd, 'deny-priority.txt'),
      expected: {
        isError: true,
        permissionResolution: 'deny',
        mainlineToolClassCall: false,
        targetExists: false,
      },
    },
  ]

  const cases: PermissionFloorCase[] = []
  for (const definition of definitions) {
    const result = await registry.execute(
      definition.toolName,
      {
        command: definition.command,
        description: `V18 permission floor case ${definition.id}`,
        timeout: 60_000,
      },
      `tool-${definition.id}`,
      definition.context,
    )
    const actual = casePassed(result, definition.expected, definition.targetPath)
    cases.push({
      id: definition.id,
      toolName: definition.toolName,
      command: definition.command,
      expected: definition.expected,
      actual,
      pass: actual.pass,
    })
  }

  const output: PermissionFloorResult = {
    ok: cases.every(entry => entry.pass),
    evidencePath,
    cwd,
    cases,
  }
  writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  return output
}
