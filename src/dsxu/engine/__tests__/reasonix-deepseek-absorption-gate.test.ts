import { describe, expect, test } from 'bun:test'
import {
  DSXU_REASONIX_REQUIRED_METRICS,
  buildDSXUReasonixDeepSeekAbsorptionGate,
} from '../reasonix-deepseek-absorption-gate'

describe('V26 Reasonix DeepSeek absorption gate', () => {
  test('records all required performance metrics while keeping open gaps explicit', () => {
    const gate = buildDSXUReasonixDeepSeekAbsorptionGate({
      generatedAt: '2026-05-17T00:00:00.000Z',
    })

    expect(gate.schemaVersion).toBe('dsxu.reasonix.deepseek-absorption-gate.v1')
    expect(gate.noNewRuntime).toBe(true)
    expect(gate.status).toBe('RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS')
    expect(gate.missingMetrics).toEqual([])
    expect(Object.keys(gate.metricCoverage).sort()).toEqual([...DSXU_REASONIX_REQUIRED_METRICS].sort())
    expect(gate.metrics.map(metric => metric.name).sort()).toEqual([...DSXU_REASONIX_REQUIRED_METRICS].sort())
    expect(gate.metrics.find(metric => metric.name === 'cacheHitRatePct')).toMatchObject({
      state: 'measured',
      value: 66.8,
    })
    expect(gate.metrics.find(metric => metric.name === 'toolResultChars')).toMatchObject({
      state: 'measured',
      value: 0,
    })
    expect(gate.metrics.find(metric => metric.name === 'tuiRenderResizeLatencyMs')).toMatchObject({
      state: 'required_not_yet_measured',
    })
    expect(gate.metrics.find(metric => metric.name === 'wallClockMs')).toMatchObject({
      state: 'required_not_yet_measured',
    })
    expect(gate.metrics.find(metric => metric.name === 'proAdmissionCount')).toMatchObject({
      state: 'measured',
      value: 0,
    })
    expect(gate.metrics.find(metric => metric.name === 'artifactLogSizeBytes')).toMatchObject({
      state: 'required_not_yet_measured',
    })
    expect(gate.guards.join('\n')).toContain('tuiRenderResizeLatencyMs: required measurement not yet produced')
    expect(gate.guards.join('\n')).toContain('artifactLogSizeBytes: required measurement not yet produced')
  })

  test('proves current DSXU baselines without pretending Reasonix tool repair is complete', () => {
    const gate = buildDSXUReasonixDeepSeekAbsorptionGate({
      generatedAt: '2026-05-17T00:00:00.000Z',
    })

    const byPacket = new Map(gate.packets.map(packet => [packet.packet, packet]))

    expect(byPacket.get('RDX-CACHE-01')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'prompt-prefix-cache-builder / query-loop evidence',
    })
    expect(byPacket.get('RDX-CACHE-02')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'Context / recovery / compact owner',
    })
    expect(byPacket.get('RDX-CACHE-03')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'DeepSeek adapter / history healing',
    })
    expect(byPacket.get('RDX-CACHE-04')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'Tool result storage / microCompact',
    })
    expect(byPacket.get('RDX-CACHE-05')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'DeepSeek API transport owner',
    })
    expect(byPacket.get('RDX-TOOL-02')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'DeepSeek adapter extraction path',
    })
    expect(byPacket.get('RDX-TOOL-02')?.evidence.join('\n')).toContain('XML/free-form DeepSeek tool extraction works')
    expect(byPacket.get('RDX-TOOL-02')?.evidence.join('\n')).toContain('raw JSON/OpenAI-style reasoning/content tool-call scavenge is supported')
    expect(byPacket.get('RDX-TOOL-03')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'DeepSeek adapter / schema validator',
    })
    expect(byPacket.get('RDX-TOOL-03')?.evidence.join('\n')).toContain('recoverable truncated JSON tool args are repaired')
    expect(byPacket.get('RDX-TOOL-04')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'query-loop gate / Tool Gate state',
    })
    expect(byPacket.get('RDX-TOOL-04')?.evidence.join('\n')).toContain('identical tool+args storm gate blocks')
    expect(byPacket.get('RDX-TOOL-05')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'DeepSeek cost router / trajectory store',
    })
    expect(byPacket.get('RDX-TOOL-05')?.evidence.join('\n')).toContain('allows Pro only after prior Flash')
    expect(byPacket.get('RDX-TOOL-01')).toMatchObject({
      status: 'implemented_baseline',
      owner: 'Tool schema adapter / DeepSeek adapter',
    })
    expect(byPacket.get('RDX-TOOL-01')?.evidence.join('\n')).toContain('flattened in DeepSeek tool emission path')
    expect(gate.nextPackets).toContain('RDX-F real window + benchmark')
    expect(gate.guards.join('\n')).not.toContain('open RDX packets:')
    expect(gate.guards.join('\n')).toContain('tuiRenderResizeLatencyMs: required measurement not yet produced')
  })

  test('fails the gate when a required metric is omitted instead of silently passing', () => {
    const gate = buildDSXUReasonixDeepSeekAbsorptionGate({
      generatedAt: '2026-05-17T00:00:00.000Z',
      metrics: [
        {
          name: 'cacheHitRatePct',
          state: 'measured',
          value: 70,
          unit: 'percent',
          evidence: 'fixture',
        },
      ],
    })

    expect(gate.status).toBe('RDX_ACCEPTANCE_GATE_INVALID')
    expect(gate.missingMetrics).toEqual([
      'toolResultChars',
      'tuiRenderResizeLatencyMs',
      'wallClockMs',
      'proAdmissionCount',
      'artifactLogSizeBytes',
    ])
    expect(gate.guards.join('\n')).toContain('missing required metrics')
  })
})
