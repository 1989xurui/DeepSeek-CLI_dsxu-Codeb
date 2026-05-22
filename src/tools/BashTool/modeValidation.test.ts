import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool'
import { getDsxuLaneReadOnlyShellViolation } from './BashTool'
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

  test('evidence-lane read-only shell blocks file writes but allows verification redirection', () => {
    const previous = process.env.DSXU_LANE_READONLY_SHELL
    try {
      process.env.DSXU_LANE_READONLY_SHELL = '1'

      expect(getDsxuLaneReadOnlyShellViolation('bun test test/api.test.ts 2>&1')).toBeNull()
      expect(getDsxuLaneReadOnlyShellViolation('printf "x" >> src/file.ts')).toContain('read-only shell gate')
      expect(getDsxuLaneReadOnlyShellViolation('cat << EOF >> src/file.ts')).toContain('read-only shell gate')
      expect(getDsxuLaneReadOnlyShellViolation('node -e "require(\'fs\').appendFileSync(\'x\', \'y\')"')).toContain('read-only shell gate')
    } finally {
      if (previous === undefined) delete process.env.DSXU_LANE_READONLY_SHELL
      else process.env.DSXU_LANE_READONLY_SHELL = previous
    }
  })
})
