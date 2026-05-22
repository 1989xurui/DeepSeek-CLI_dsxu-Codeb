import { describe, expect, test } from 'bun:test'
import {
  buildV18ModelPublicSurfaceGate,
  collectDsxuModelPublicSurfaceItems,
  runV18ModelPublicSurfaceGateHarness,
} from '../model-public-surface-gate'

describe('DSXU model public surface V1', () => {
  test('blocks provider-migration source model family names in public model UI/evidence', () => {
    const gate = buildV18ModelPublicSurfaceGate({
      items: [
        {
          kind: 'public',
          surface: 'model picker option',
          value: 'Opus 4.6 most capable',
        },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('BLOCKED_EVIDENCED')
    expect(gate.blockerCount).toBe(1)
  })

  test('allows provider-migration source model names only in hidden provider-migration evidence', () => {
    const gate = buildV18ModelPublicSurfaceGate({
      items: [
        {
          kind: 'migration',
          surface: 'provider migration model alias evidence',
          value: 'DSXU provider migration model alias: opus -> flash-max; route_intent=review; projection_only=true; cost_router_decides=true.',
        },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(1)
  })

  test('current DSXU public model surface has no old model family blockers', () => {
    const gate = buildV18ModelPublicSurfaceGate({
      items: collectDsxuModelPublicSurfaceItems(),
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.items.some(item => item.value.includes('flash-max'))).toBe(true)
    expect(gate.provenanceManifest.some(item => item.releasePolicy === 'migration-hidden')).toBe(true)
  })

  test('writes current repository public surface evidence without mutating files', async () => {
    const gate = await runV18ModelPublicSurfaceGateHarness()

    expect(gate.evidencePath).toContain('model-public-surface-gate-20260507.evidence.json')
    expect(gate.itemCount).toBeGreaterThan(0)
    expect(gate.blockerCount).toBe(0)
  })
})
