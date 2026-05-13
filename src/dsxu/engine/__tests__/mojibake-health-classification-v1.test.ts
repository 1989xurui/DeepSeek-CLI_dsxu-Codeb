import { describe, expect, test } from 'bun:test'
import {
  classifyMojibakeLineSurface,
  findClassifiedMojibakeIssuesInText,
  isActiveUserVisibleSourcePath,
} from '../../../utils/dsxuHealthMonitor'

const COMMENT_MOJIBAKE = '\u951f\u65a4\u62f7'
const STRING_MOJIBAKE = '\u951f\u65a4\u62f7'
const GBK_STYLE_MOJIBAKE = '\u93cc\u30e9\u7359\u7487\u4f79\u69f8\u935a\ufe42\u20ac\u6c33\u7e43'

describe('mojibake health classification V1', () => {
  test('separates comment debt from active user-visible string risk', () => {
    const text = [
      `// historical note ${COMMENT_MOJIBAKE} old arrow`,
      `const visible = '${STRING_MOJIBAKE}'`,
    ].join('\n')

    const issues = findClassifiedMojibakeIssuesInText(
      'src/utils/messages.ts',
      text,
    )

    expect(issues).toHaveLength(2)
    expect(issues[0]).toMatchObject({
      surface: 'comment',
      activePath: true,
      userVisibleRisk: false,
    })
    expect(issues[1]).toMatchObject({
      surface: 'string_or_template',
      activePath: true,
      userVisibleRisk: true,
    })
  })

  test('does not treat inactive documentation comments as product-blocking risk', () => {
    const issues = findClassifiedMojibakeIssuesInText(
      'docs/archive.md',
      `// stale import path ${COMMENT_MOJIBAKE} old note`,
    )

    expect(issues[0]?.activePath).toBe(false)
    expect(issues[0]?.userVisibleRisk).toBe(false)
  })

  test('keeps active path and surface heuristics narrow and explainable', () => {
    expect(isActiveUserVisibleSourcePath('src/screens/REPL.tsx')).toBe(true)
    expect(isActiveUserVisibleSourcePath('src/utils/messages.ts')).toBe(true)
    expect(isActiveUserVisibleSourcePath('src/vendor/old.ts')).toBe(false)

    expect(classifyMojibakeLineSurface(`// x ${COMMENT_MOJIBAKE} y`)).toBe('comment')
    expect(classifyMojibakeLineSurface(`const n = 1 // x ${COMMENT_MOJIBAKE} y`)).toBe(
      'comment',
    )
    expect(classifyMojibakeLineSurface(`message: '${STRING_MOJIBAKE}'`)).toBe(
      'string_or_template',
    )
    expect(classifyMojibakeLineSurface('const marker = value')).toBe('unknown')
  })

  test('detects GBK-style DSXU adapter mojibake that previously escaped the scanner', () => {
    const issues = findClassifiedMojibakeIssuesInText(
      'src/dsxu/engine/adapters/bridge-adapter.ts',
      [
        `// comment-only debt: ${GBK_STYLE_MOJIBAKE}`,
        `const message = '${GBK_STYLE_MOJIBAKE}'`,
      ].join('\n'),
    )

    expect(issues).toHaveLength(2)
    expect(issues[0]).toMatchObject({
      surface: 'comment',
      userVisibleRisk: false,
    })
    expect(issues[1]).toMatchObject({
      surface: 'string_or_template',
      userVisibleRisk: false,
    })
  })
})
