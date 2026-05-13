import { describe, expect, test } from 'bun:test'
import {
  buildV18GoStopDecision,
  normalizeV18EvidenceJsonText,
  type V18GoStopSignal,
} from '../v18-go-stop-decision'

const baseSignals: V18GoStopSignal[] = [
  {
    id: 'real-tui',
    ok: true,
    evidencePath: '.dsxu/trace/tui.json',
    summary: 'real tui evidence',
    requiredForLocal: true,
    requiredForPublicBenchmark: true,
  },
  {
    id: 'remote-network',
    ok: true,
    evidencePath: '.dsxu/trace/remote.json',
    summary: 'remote replay evidence',
    requiredForLocal: true,
    requiredForPublicBenchmark: true,
  },
]

describe('V18 Go/Stop Decision V1', () => {
  test('allows local Phase H while blocking public benchmark when live gate is config-probe only', () => {
    const decision = buildV18GoStopDecision({
      signals: baseSignals,
      liveBenchmarkGate: {
        status: 'ready',
        evidenceMode: 'config_probe_only',
        releaseEvidence: false,
        provider: 'deepseek',
        requiredEnv: ['DEEPSEEK_API_KEY or DSXU_API_KEY'],
        scenarios: ['bugfix'],
      },
    })

    expect(decision.localPhaseH).toBe('GO_LOCAL_PHASE_H')
    expect(decision.publicBenchmark).toBe('STOP_PUBLIC_BENCH')
    expect(decision.releaseEvidence).toBe(false)
    expect(decision.blockers[0]).toContain('live-benchmark-gate')
  })

  test('blocks local progress when required evidence is missing', () => {
    const decision = buildV18GoStopDecision({
      signals: [
        baseSignals[0]!,
        {
          ...baseSignals[1]!,
          ok: false,
          summary: 'missing remote replay',
        },
      ],
      liveBenchmarkGate: {
        status: 'blocked',
        evidenceMode: 'config_probe_only',
        releaseEvidence: false,
        provider: 'deepseek',
        requiredEnv: ['DEEPSEEK_API_KEY or DSXU_API_KEY'],
        reason: 'No key',
        scenarios: ['bugfix'],
      },
    })

    expect(decision.localPhaseH).toBe('STOP_LOCAL')
    expect(decision.publicBenchmark).toBe('STOP_PUBLIC_BENCH')
    expect(decision.failures).toEqual(['remote-network: missing remote replay'])
  })

  test('normalizes BOM and mojibake BOM prefixes before parsing evidence JSON', () => {
    expect(JSON.parse(normalizeV18EvidenceJsonText('\uFEFF{"ok":true}'))).toEqual({
      ok: true,
    })
    expect(JSON.parse(normalizeV18EvidenceJsonText('锘?{"ok":true}'))).toEqual({
      ok: true,
    })
  })
})
