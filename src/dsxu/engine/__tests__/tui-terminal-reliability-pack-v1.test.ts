import { describe, expect, test } from 'bun:test'
import { readFile, stat } from 'fs/promises'
import { runTuiTerminalReliabilityPack } from '../../integration/harness/tui-terminal-reliability-pack-v1-harness'

describe('V18 TUI/Terminal Reliability Pack', () => {
  test(
    'produces an Excel-aligned replay for terminal state, permission visibility, background lifecycle, and TUI trace',
    async () => {
      const result = await runTuiTerminalReliabilityPack({
        includeRealTui: true,
      })

      expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
      expect(result.excelIds).toEqual([
        'B01',
        'B02',
        'B03',
        'B04',
        'B05',
        'B06',
        'B07',
        'B10',
        'B11',
        'B14',
        'C03',
        'E05',
        'E06',
      ])
      expect(Object.values(result.acceptance)).not.toContain(false)
      expect(result.terminalReplay.commandVerify).toMatchObject({
        exit0: true,
        artifactExists: true,
        markerMatches: true,
        fileDeltaTracked: true,
      })
      expect(result.terminalReplay.timeoutGuard.timeoutTriggered).toBe(true)
      expect(result.permission.ok).toBe(true)
      expect(result.background.ok).toBe(true)
      expect(result.background.coldStartStatuses).toContain(503)
      expect(result.background.readyStatus).toBe(200)
      expect(result.devServer.ok).toBe(true)
      expect(result.devServer.coldStartStatuses).toContain(503)
      expect(result.devServer.readyStatus).toBe(200)
      expect(result.devServer.browserProof.status).toBe(200)
      expect(result.devServer.browserProof.contentType).toContain('text/html')
      expect(result.devServer.browserProof.bodyContainsMarker).toBe(true)
      expect(result.devServer.browserProof.htmlRootPresent).toBe(true)
      expect(result.devServer.heartbeatLines).toBeGreaterThan(0)
      expect(result.devServer.stopStatus).toBe('stopped')
      expect(result.toolchain.ok).toBe(true)
      expect(result.realTui?.ok).toBe(true)
      expect(result.realTui?.sawPrompt).toBe(true)

      expect((await stat(result.evidencePath)).size).toBeGreaterThan(0)
      const evidence = await readFile(result.evidencePath, 'utf8')
      expect(evidence).toContain('"B01"')
      expect(evidence).toContain('"goStopDecision": true')
      expect(evidence).toContain('DSXU_TERMINAL_RELIABILITY_ARTIFACT')
    },
    75_000,
  )
})
