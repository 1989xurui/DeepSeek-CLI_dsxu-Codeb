import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createRecoveryBridge } from '../query-loop'

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const MOJIBAKE_MARKERS = [
  '\uFFFD',
  '\u951f',
  '\u95bf',
  '\u95c1',
  '\u95f3',
  '\u95fa',
  '\u9435',
  '\u6fc0',
]

describe('query-loop visible copy V1', () => {
  test('keeps query-loop module importable after visible-copy cleanup', () => {
    const bridge = createRecoveryBridge()
    const decision = bridge.quickRecoveryDecision('tool-failure', 1)

    expect(decision.reason).toBe('tool-failure')
    expect(decision.action.length).toBeGreaterThan(0)
  })

  test('keeps runtime-visible query-loop messages readable', () => {
    const source = read('src/dsxu/engine/query-loop.ts')

    expect(source).toContain('[Reached max turn limit]')
    expect(source).toContain('[User aborted]')
    expect(source).toContain('human intervention required')
    expect(source).toContain('content: `${currentContent}\\n\\n${anchorResult.anchor}`')
    expect(source).not.toContain('content: `${currentContent}/n/n${anchorResult.anchor}`')

    for (const marker of MOJIBAKE_MARKERS) {
      expect(source).not.toContain(marker)
    }
  })

  test('keeps Chinese intent keywords valid without mojibake literals', () => {
    const source = read('src/dsxu/engine/query-loop.ts')

    expect(source).toContain("'\\u67e5\\u770b'")
    expect(source).toContain("'\\u8bfb\\u53d6'")
    expect(source).toContain("'\\u4fee\\u590d'")
    expect(source).toContain("'\\u4fee\\u6539'")
    expect(source).toContain("'\\u67e5\\u627e'")
    expect(source).toContain("'\\u641c\\u7d22'")
    for (const marker of MOJIBAKE_MARKERS) {
      expect(source).not.toContain(marker)
    }
  })
})
