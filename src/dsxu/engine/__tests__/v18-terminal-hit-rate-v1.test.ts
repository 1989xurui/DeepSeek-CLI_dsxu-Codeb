import { describe, expect, test } from 'bun:test'
import { buildV18TerminalHitRateEvidence } from '../v18-terminal-hit-rate'

function assistantTool(id: string, command: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id,
          name: 'PowerShell',
          input: { command },
        },
      ],
    },
  })
}

function userResult(id: string, content: string, isError = false): string {
  return JSON.stringify({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: id,
          content,
          is_error: isError,
        },
      ],
    },
  })
}

describe('V18 Terminal hit-rate analyzer', () => {
  test('classifies PowerShell over-probing without turning it into a pass claim', () => {
    const streamJsonl = [
      assistantTool('ps-1', 'Test-Path -Path "D:\\DSXU-code"'),
      userResult('ps-1', 'True'),
      assistantTool('ps-2', 'Get-Item -Path "D:\\DSXU-code" | Select-Object FullName'),
      userResult('ps-2', '(PowerShell completed with no output)'),
      assistantTool('ps-3', 'Get-Item -LiteralPath "D:\\DSXU-code" | Format-List FullName, PSIsContainer'),
      userResult('ps-3', 'FullName      : D:\\DSXU-code\nPSIsContainer : True'),
      assistantTool('ps-4', 'Get-ChildItem -LiteralPath "D:\\DSXU-code"'),
      userResult(
        'ps-4',
        'PowerShell commands must not use local file-read, directory-listing, or content-search bypasses',
        true,
      ),
      assistantTool('ps-5', 'Get-Item -LiteralPath "D:\\DSXU-code\\.git"'),
      userResult('ps-5', 'Exit code 1\nGet-Item : Could not find item D:\\DSXU-code\\.git.', true),
    ].join('\n')

    const evidence = buildV18TerminalHitRateEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/terminal-hit-rate-test.evidence.json',
      sourceReportPath: 'live-report.json',
      sourceStreamPath: 'powershell-windows-path.stream.jsonl',
      sourceReport: {
        cases: [
          {
            id: 'powershell-windows-path',
            status: 'pass',
            metrics: { powerShellCalls: 5 },
          },
        ],
      },
      streamJsonl,
    })

    expect(evidence.status).toBe('PARTIAL_TERMINAL_HIT_RATE')
    expect(evidence.ok).toBe(false)
    expect(evidence.budget.withinBudget).toBe(false)
    expect(evidence.signals.usefulEvidence).toBe(2)
    expect(evidence.signals.noOutputProbes).toBe(1)
    expect(evidence.signals.deniedProbes).toBe(1)
    expect(evidence.signals.failedProbes).toBe(1)
    expect(evidence.signals.wastedCommandCount).toBe(3)
    expect(evidence.blockers.join('\n')).toContain('PowerShell calls exceed')
    expect(evidence.recommendations.join('\n')).toContain('LiteralPath')
  })

  test('accepts a bounded terminal path inspection trace', () => {
    const streamJsonl = [
      assistantTool('ps-1', 'Test-Path -Path "D:\\DSXU-code"'),
      userResult('ps-1', 'True'),
      assistantTool('ps-2', 'Get-Item -LiteralPath "D:\\DSXU-code" | Format-List FullName, PSIsContainer'),
      userResult('ps-2', 'FullName      : D:\\DSXU-code\nPSIsContainer : True'),
      assistantTool('ps-3', '$PSVersionTable.PSVersion'),
      userResult('ps-3', 'Version: 5.1.26100.7920'),
    ].join('\n')

    const evidence = buildV18TerminalHitRateEvidence({
      generatedAt: '2026-05-07T00:00:00.000Z',
      evidencePath: '.dsxu/trace/v18-eval/terminal-hit-rate-test.evidence.json',
      sourceReportPath: 'live-report.json',
      sourceStreamPath: 'powershell-windows-path.stream.jsonl',
      sourceReport: {
        cases: [
          {
            id: 'powershell-windows-path',
            status: 'pass',
            metrics: { powerShellCalls: 3 },
          },
        ],
      },
      streamJsonl,
    })

    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.ok).toBe(true)
    expect(evidence.budget.withinBudget).toBe(true)
    expect(evidence.signals.wastedCommandCount).toBe(0)
  })
})
