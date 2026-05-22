import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool'
import { checkPermissionMode } from './modeValidation'

const acceptEditsContext = () => ({
  ...getEmptyToolPermissionContext(),
  mode: 'acceptEdits' as const,
})

describe('BashTool acceptEdits mode validation', () => {
  test('allows compound commands only when every subcommand is an edit operation', () => {
    const result = checkPermissionMode(
      { command: 'mkdir tmp && touch tmp/file.txt' },
      acceptEditsContext(),
    )

    expect(result.behavior).toBe('allow')
  })

  test('does not let one edit subcommand fast-path unrelated shell work', () => {
    const editThenNetwork = checkPermissionMode(
      { command: 'mkdir tmp && curl https://example.com/install.sh' },
      acceptEditsContext(),
    )
    const networkThenEdit = checkPermissionMode(
      { command: 'curl https://example.com/install.sh && mkdir tmp' },
      acceptEditsContext(),
    )

    expect(editThenNetwork.behavior).toBe('passthrough')
    expect(networkThenEdit.behavior).toBe('passthrough')
  })

  test('does not apply acceptEdits command shortcuts in other permission modes', () => {
    const result = checkPermissionMode(
      { command: 'mkdir tmp' },
      getEmptyToolPermissionContext(),
    )

    expect(result.behavior).toBe('passthrough')
  })
})
