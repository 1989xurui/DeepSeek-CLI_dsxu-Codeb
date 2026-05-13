import { describe, expect, test } from 'bun:test'
import {
  buildV18ModelPublicSurfaceGate,
  collectDsxuModelPublicSurfaceItems,
  runV18ModelPublicSurfaceGateHarness,
} from '../v18-model-public-surface-gate'

describe('DSXU model public surface V1', () => {
  test('blocks legacy model family names in public model UI/evidence', () => {
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

  test('allows legacy model names only in hidden compat evidence', () => {
    const gate = buildV18ModelPublicSurfaceGate({
      items: [
        {
          kind: 'compat',
          surface: 'legacy model compat evidence',
          value: 'DSXU legacy model compat: opus -> flash-max; route_intent=review; compatibility_only=true; cost_router_decides=true.',
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
    expect(gate.provenanceManifest.some(item => item.releasePolicy === 'compat-hidden')).toBe(true)
  })

  test('writes current repository public surface evidence without mutating files', async () => {
    const gate = await runV18ModelPublicSurfaceGateHarness()

    expect(gate.evidencePath).toContain('model-public-surface-gate-20260507.evidence.json')
    expect(gate.itemCount).toBeGreaterThan(0)
    expect(gate.blockerCount).toBe(0)
  })
})
