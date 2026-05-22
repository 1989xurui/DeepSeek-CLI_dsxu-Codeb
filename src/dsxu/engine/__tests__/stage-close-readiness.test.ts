import { describe, expect, test } from 'bun:test'
import { buildV18StageCloseReadiness, type V18StageCloseSignal } from '../stage-close-readiness'

function signal(input: Partial<V18StageCloseSignal> & Pick<V18StageCloseSignal, 'id' | 'area'>): V18StageCloseSignal {
  return {
    ok: true,
    evidencePath: `.dsxu/trace/${input.id}.json`,
    summary: `${input.id} evidence`,
    requiredFor22Case: true,
    requiredForProBare: true,
    requiredForBenchmax: true,
    ...input,
  }
}

describe('V18 stage-close readiness V1', () => {
  test('allows 22-case stage close while blocking Pro bare and BenchMax when paid baselines are missing', () => {
    const readiness = buildV18StageCloseReadiness({
      signals: [
        signal({ id: 'persistent-smooth-resume', area: 'experience_store' }),
        signal({ id: 'agent-live-report-replay', area: 'agent' }),
        signal({ id: 'control-plane-cp12', area: 'control_plane' }),
        signal({ id: 'tui-terminal-reliability', area: 'tui_terminal' }),
        signal({ id: 'flash-bare-code10-final4', area: 'flash_bare' }),
        signal({
          id: 'pro-bare-code10',
          area: 'pro_bare',
          ok: false,
          requiredFor22Case: false,
          requiredForProBare: true,
          requiredForBenchmax: true,
        }),
        signal({
          id: 'benchmax-code10',
          area: 'benchmax',
          ok: false,
          requiredFor22Case: false,
          requiredForProBare: false,
          requiredForBenchmax: true,
        }),
      ],
    })

    expect(readiness.status).toBe('READY_FOR_22_CASE_STAGE_CLOSE')
    expect(readiness.proBare).toBe('STOP_PRO_BARE')
    expect(readiness.benchmax).toBe('STOP_BENCHMAX')
    expect(readiness.blockers).toContain('pro-bare-code10: pro-bare-code10 evidence')
    expect(readiness.blockers).toContain('benchmax-code10: benchmax-code10 evidence')
    expect(readiness.guards).toContain(
      'Run broad 22-case only once as a stage-close regression, not after every patch.',
    )
  })

  test('blocks 22-case when any required focused local evidence is missing', () => {
    const readiness = buildV18StageCloseReadiness({
      signals: [
        signal({ id: 'persistent-smooth-resume', area: 'experience_store' }),
        signal({
          id: 'tui-terminal-reliability',
          area: 'tui_terminal',
          ok: false,
        }),
      ],
    })

    expect(readiness.status).toBe('NOT_READY')
    expect(readiness.proBare).toBe('STOP_PRO_BARE')
    expect(readiness.nextStep).toContain('Continue closing required focused evidence')
  })

  test('allows BenchMax only after 22-case and Pro bare prerequisites are green', () => {
    const readiness = buildV18StageCloseReadiness({
      signals: [
        signal({ id: 'persistent-smooth-resume', area: 'experience_store' }),
        signal({ id: 'agent-live-report-replay', area: 'agent' }),
        signal({ id: 'control-plane-cp12', area: 'control_plane' }),
        signal({ id: 'tui-terminal-reliability', area: 'tui_terminal' }),
        signal({ id: 'flash-bare-code10-final4', area: 'flash_bare' }),
        signal({
          id: 'pro-bare-code10',
          area: 'pro_bare',
          requiredFor22Case: false,
          requiredForProBare: true,
          requiredForBenchmax: true,
        }),
        signal({
          id: 'benchmax-code10',
          area: 'benchmax',
          requiredFor22Case: false,
          requiredForProBare: false,
          requiredForBenchmax: true,
        }),
      ],
    })

    expect(readiness.status).toBe('READY_FOR_22_CASE_STAGE_CLOSE')
    expect(readiness.proBare).toBe('GO_PRO_BARE')
    expect(readiness.benchmax).toBe('GO_BENCHMAX')
    expect(readiness.blockers).toEqual([])
  })
})
