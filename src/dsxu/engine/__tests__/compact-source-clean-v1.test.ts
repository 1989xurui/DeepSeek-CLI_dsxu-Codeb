import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  DSXU_COMPACT_RECOVERY_SCHEMA_VERSION,
  renderCompactRecoverySchemaContract,
} from '../compact'

const ACTIVE_COMPACT_SOURCE = join(process.cwd(), 'src/dsxu/engine/compact.ts')
const MOJIBAKE_PATTERN = new RegExp(
  [
    '\\uFFFD',
    '\\u951F',
    '\\u9225',
    '\\u95BF',
    '\\u732B',
    '\\u83BD',
    '\\u6C13',
    '\\u2013',
    '\\u2014',
    '\\u2018',
    '\\u2019',
    '\\u201C',
    '\\u201D',
  ].join('|'),
)

describe('compact source clean V1', () => {
  test('keeps active compact source free of known mojibake markers', () => {
    const source = readFileSync(ACTIVE_COMPACT_SOURCE, 'utf8')

    expect(source).not.toMatch(MOJIBAKE_PATTERN)
    expect(source).toContain("DSXU_COMPACT_RECOVERY_SCHEMA_VERSION = 'dsxu.compact-recovery.v1'")
    expect(source).toContain('Resume rule: re-read source truth')
  })

  test('keeps compact recovery contract explicit and resume-safe', () => {
    const contract = renderCompactRecoverySchemaContract()

    expect(DSXU_COMPACT_RECOVERY_SCHEMA_VERSION).toBe('dsxu.compact-recovery.v1')
    expect(contract).toContain('Do not drop user constraints')
    expect(contract).toContain('source files and verification are truth')
  })
})
