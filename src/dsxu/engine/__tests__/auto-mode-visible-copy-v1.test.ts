import { describe, expect, test } from 'bun:test'
import { normalizeAttachmentForAPI } from '../../../utils/messages'

const REPLACEMENT_GLYPH = '\uFFFD'
const COMMON_GBK_MOJIBAKE = '\u951f\u65a4\u62f7'

describe('auto mode visible copy V1', () => {
  test('does not leak mojibake into the auto-mode reminder shown to the model', () => {
    const messages = normalizeAttachmentForAPI({
      type: 'auto_mode',
      reminderType: 'full',
    } as any)

    const rendered = messages
      .map(message => {
        const content = (message as any).message?.content
        if (typeof content === 'string') return content
        return JSON.stringify(content)
      })
      .join('\n')

    expect(rendered).toContain('## Auto Mode Active')
    expect(rendered).toContain('**Execute immediately** - Start implementing right away')
    expect(rendered).not.toContain(COMMON_GBK_MOJIBAKE)
    expect(rendered).not.toContain(REPLACEMENT_GLYPH)
  })
})
