import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('QueryEngine recovery mainline consumption', () => {
  test('product QueryEngine terminal errors consume recovery v3 without opening another runtime', () => {
    const source = readFileSync(join(process.cwd(), 'src/QueryEngine.ts'), 'utf8')

    expect(source).toContain("createDSXURecoveryMainlineBundle")
    expect(source).toContain("from './dsxu/engine/recovery/index.js'")
    expect(source).toContain('buildQueryEngineRecoveryEvidence')
    expect(source).toContain('taskId: \'query-engine-mainline\'')
    expect(source).toContain('subtype: \'error_max_turns\'')
    expect(source).toContain('subtype: \'error_max_budget_usd\'')
    expect(source).toContain('subtype: \'error_max_structured_output_retries\'')
    expect(source).toContain('subtype: \'error_during_execution\'')
    expect(source).toContain('[dsxu_recovery_mainline]')
    expect(source).not.toContain("from './dsxu/engine/recovery/recovery-integration-v2")
    expect(source).not.toContain("from './dsxu/engine/recovery/integration")
  })
})
