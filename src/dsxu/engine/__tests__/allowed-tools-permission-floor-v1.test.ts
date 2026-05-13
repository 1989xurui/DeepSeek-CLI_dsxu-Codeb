import { describe, expect, test } from 'bun:test'
import { readFile, stat } from 'fs/promises'
import { runAllowedToolsPermissionFloor } from '../../integration/harness/allowed-tools-permission-floor-v1-harness'

describe('V18 allowedTools permission floor', () => {
  test(
    'proves broad shell availability does not bypass command-specific permission checks',
    async () => {
      const result = await runAllowedToolsPermissionFloor()

      expect(result.ok, JSON.stringify(result.cases, null, 2)).toBe(true)
      expect(result.cases.map(entry => entry.id)).toEqual([
        'bash-broad-readonly-allowed',
        'bash-broad-write-denied',
        'bash-broad-test-denied',
        'bash-granular-test-allowed',
        'powershell-broad-readonly-allowed',
        'powershell-broad-write-denied',
        'powershell-granular-expression-allowed',
        'powershell-deny-priority-over-broad-allow',
        'bash-deny-priority-over-broad-allow',
      ])

      const byId = new Map(result.cases.map(entry => [entry.id, entry]))
      expect(byId.get('bash-broad-write-denied')?.actual.targetExists).toBe(false)
      expect(byId.get('bash-broad-test-denied')?.actual.mainlineToolClassCall).toBe(false)
      expect(byId.get('bash-granular-test-allowed')?.actual.contentSnippet).toContain(
        'DSXU_GRANULAR_TEST_ALLOWED',
      )
      expect(byId.get('powershell-broad-write-denied')?.actual.targetExists).toBe(false)
      expect(byId.get('powershell-granular-expression-allowed')?.actual.contentSnippet).toContain(
        'DSXU_PS_GRANULAR_ALLOWED',
      )
      expect(byId.get('powershell-deny-priority-over-broad-allow')?.actual.permissionResolution).toBe(
        'deny',
      )
      expect(byId.get('bash-deny-priority-over-broad-allow')?.actual.targetExists).toBe(false)

      expect((await stat(result.evidencePath)).size).toBeGreaterThan(0)
      const evidence = await readFile(result.evidencePath, 'utf8')
      expect(evidence).toContain('"ok": true')
      expect(evidence).toContain('"powershell-granular-expression-allowed"')
    },
    90_000,
  )
})
