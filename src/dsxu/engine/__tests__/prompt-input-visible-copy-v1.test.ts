import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const REPLACEMENT_GLYPH = '\uFFFD'
const COMMON_GBK_MOJIBAKE = '\u951f\u65a4\u62f7'

describe('prompt input visible copy V1', () => {
  test('keeps model switch notification copy free of replacement glyphs', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/PromptInput/PromptInput.tsx'),
      'utf8',
    )

    const notificationLines = source
      .split(/\r?\n/)
      .filter(line => line.includes('Billed as extra usage') || line.includes('Fast mode OFF'))
      .join('\n')

    expect(notificationLines).toContain("message += ' - Billed as extra usage'")
    expect(notificationLines).toContain("message += ' - Fast mode OFF'")
    expect(notificationLines).not.toContain(REPLACEMENT_GLYPH)
    expect(notificationLines).not.toContain(COMMON_GBK_MOJIBAKE)
  })
})
