import { describe, expect, test } from 'bun:test'
import {
  createDsxuScopedPermissionContextFromGrants,
  createExternalWorkspaceGrant,
  filterActiveExternalWorkspaceGrants,
  renderExternalWorkspaceGrantSummary,
} from '../permission-usability'
import { PowerShellTool } from '../../../tools/PowerShellTool/PowerShellTool'
import {
  detectAmbiguousPowerShellProcessCleanup,
  renderAmbiguousPowerShellProcessCleanupMessage,
} from '../../../tools/PowerShellTool/processCleanupGuards'
import { resolvePermissionSchema } from '../permission-prompt-v1'

describe('DSXU V9 permission usability matrix', () => {
  test('normalizes Windows and WSL external workspace grants with visible expiration', () => {
    const now = Date.UTC(2026, 4, 1, 0, 0, 0)
    const windowsGrant = createExternalWorkspaceGrant('D:/shooter-game', {
      source: 'cli',
      now,
      ttlMs: 60_000,
    })
    const wslGrant = createExternalWorkspaceGrant('/mnt/d/shooter-game', {
      source: 'session',
      now,
    })

    const summary = renderExternalWorkspaceGrantSummary([windowsGrant, wslGrant])

    expect(windowsGrant.normalizedPath.toLowerCase()).toContain('shooter-game')
    expect(wslGrant.normalizedPath.replace(/\\/g, '/')).toContain('/mnt/d/shooter-game')
    expect(summary).toContain('source=cli')
    expect(summary).toContain('source=session')
    expect(summary).toContain('expiresAt=2026-05-01T00:01:00.000Z')
    expect(summary).toContain('expiresAt=never')
  })

  test('filters expired external grants before creating the permission context', () => {
    const now = Date.UTC(2026, 4, 1, 0, 0, 0)
    const active = createExternalWorkspaceGrant('D:/shooter-game', {
      now,
      ttlMs: 10_000,
    })
    const expired = createExternalWorkspaceGrant('D:/old-project', {
      now,
      ttlMs: 1,
    })

    const activeGrants = filterActiveExternalWorkspaceGrants(
      [active, expired],
      now + 5_000,
    )
    const context = createDsxuScopedPermissionContextFromGrants({
      cwd: process.cwd(),
      externalWriteGrants: [active, expired],
      now: now + 5_000,
      allowTestBuild: true,
    })
    const dirs = Array.from(context.additionalWorkingDirectories.keys()).join('\n')

    expect(activeGrants.map(grant => grant.path)).toEqual(['D:/shooter-game'])
    expect(dirs.toLowerCase()).toContain('shooter-game')
    expect(dirs.toLowerCase()).not.toContain('old-project')
    expect(context.alwaysAllowRules.session).toContain('Bash(bun test)')
    expect(context.alwaysAllowRules.session).toContain('PowerShell(bun test)')
  })

  test('PowerShell dev-server cleanup rejects broad process-name kills but allows scoped port cleanup', async () => {
    const finding = detectAmbiguousPowerShellProcessCleanup(
      'Stop-Process -Name node -Force; npm run dev',
    )
    expect(finding?.form).toBe('stop-process-name')
    expect(renderAmbiguousPowerShellProcessCleanupMessage(finding!)).toContain(
      'false server readiness or Waiting states',
    )

    const validation = await PowerShellTool.validateInput({
      command: 'Stop-Process -Name node -Force; npm run dev',
    })
    expect(validation.result).toBe(false)
    expect(validation.message).toContain('Get-NetTCPConnection -LocalPort 5173')

    expect(
      detectAmbiguousPowerShellProcessCleanup(
        'Get-NetTCPConnection -LocalPort 5173 | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ }; npm run dev',
      ),
    ).toBeNull()
  })

  test('V19 permission prompt gate classification relaxes read-only and confirms mutations visibly', () => {
    const readOnly = resolvePermissionSchema('read project file')
    const writeLocal = resolvePermissionSchema('edit local source file', {
      promptVisible: true,
    })

    expect(readOnly.stateOwner).toBe('query_loop')
    expect(readOnly.decision).toBe('allow')
    expect(readOnly.gateClass).toBe('RELAX_OR_REMOVE')
    expect(readOnly.blocked).toBe(false)
    expect(readOnly.nextAction).toBe('allow_read_only_tool')

    expect(writeLocal.stateOwner).toBe('query_loop')
    expect(writeLocal.decision).toBe('require_confirmation')
    expect(writeLocal.gateClass).toBe('QUALITY_BLOCK')
    expect(writeLocal.blocked).toBe(true)
    expect(writeLocal.visibleFallbackRequired).toBe(true)
    expect(writeLocal.nextAction).toBe('show_permission_prompt_before_mutation')
  })

  test('V19 permission prompt hidden UI becomes query-loop recovery visibility fallback', () => {
    const hiddenPrompt = resolvePermissionSchema('PowerShell edit generated file', {
      promptVisible: false,
      waitingMs: 10_000,
    })

    expect(hiddenPrompt.stateOwner).toBe('query_loop')
    expect(hiddenPrompt.schemaId).toBe('dsxu-permission-visible-fallback-required')
    expect(hiddenPrompt.gateKind).toBe('permission_visibility_fallback')
    expect(hiddenPrompt.gateClass).toBe('RECOVERY_BLOCK')
    expect(hiddenPrompt.blocked).toBe(true)
    expect(hiddenPrompt.visibleFallbackRequired).toBe(true)
    expect(hiddenPrompt.nextAction).toBe('show_visible_permission_fallback_or_return_error')
  })

  test('V19 permission prompt keeps destructive permission actions as safety blocks', () => {
    const denied = resolvePermissionSchema('rm -rf /')

    expect(denied.stateOwner).toBe('query_loop')
    expect(denied.decision).toBe('deny')
    expect(denied.gateClass).toBe('SAFETY_BLOCK')
    expect(denied.blocked).toBe(true)
    expect(denied.visibleFallbackRequired).toBe(false)
    expect(denied.nextAction).toBe('reject_and_explain_safety_boundary')
  })
})
