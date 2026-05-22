import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { RunNativeTestTool } from './RunNativeTestTool'

describe('RunNativeTestTool owner gate', () => {
  test('requires an absolute existing cwd before native execution', async () => {
    const relative = await RunNativeTestTool.validateInput({
      command: 'bun test',
      cwd: 'relative-project',
    } as never, {} as never)
    expect(relative.result).toBe(false)

    const missing = await RunNativeTestTool.validateInput({
      command: 'bun test',
      cwd: join(process.cwd(), 'does-not-exist-for-run-native-test'),
    } as never, {} as never)
    expect(missing.result).toBe(false)

    const ok = await RunNativeTestTool.validateInput({
      command: 'bun test',
      cwd: process.cwd(),
    } as never, {} as never)
    expect(ok.result).toBe(true)
  })

  test('uses the DSXU permission pipeline instead of default allow', async () => {
    const decision = await RunNativeTestTool.checkPermissions({
      command: 'bun test',
      cwd: process.cwd(),
    } as never, {} as never)

    expect(decision.behavior).toBe('passthrough')
    expect(decision.message).toContain('RunNativeTest wants to execute')
  })
})
