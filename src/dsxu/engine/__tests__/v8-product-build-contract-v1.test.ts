import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  getDsxuV8Item,
  getDsxuV8ProductBuildContract,
} from '../v8-product-build-contract'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('DSXU V8 product build contract', () => {
  test('defines the product-build queue without claiming real live work is complete', () => {
    const contract = getDsxuV8ProductBuildContract()

    expect(contract.runtime).toBe('DSXU V8 Product Build')
    expect(contract.target).toContain('product-grade DeepSeek coding agent behavior')
    expect(contract.rules.join('\n')).toContain('Do not mark a real product capability complete from Grep-only evidence')
    expect(contract.releaseGate.dryGate).toBe('v8-product-build')
    expect(contract.releaseGate.mutationLiveGate).toBe('v8-mutation-live')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(92)
    expect(contract.items.map(item => item.id)).toEqual([
      'V8-1 Provider Backend Replacement',
      'V8-2 Real Mutation Live Suite',
      'V8-3 StopHook Product Runtime',
      'V8-4 SessionMemory AutoDream Resume',
      'V8-5 Agent Long-Run Suite',
      'V8-6 Real MCP Server Harness',
      'V8-7 Permission Usability',
      'V8-8 Encoding and Docs Cleanup',
    ])
  })

  test('keeps provider backend replacement green after compatibility aliases are remapped', () => {
    const provider = getDsxuV8Item('V8-1')
    const cli = read('src/entrypoints/cli.tsx')
    const init = read('src/entrypoints/init.ts')
    const main = read('src/main.tsx')
    const sendMessage = read('src/tools/SendMessageTool/SendMessageTool.ts')

    expect(provider?.state).toBe('evidence_green')
    expect(provider?.buildTasks.join('\n')).toContain('--remote, remote-control, and bridge:')
    expect(cli).not.toContain("await import('../bridge/bridgeMain.js')")
    expect(init).not.toContain("../upstreamproxy/upstreamproxy.js")
    expect(main).not.toContain("await import('./remote/DsxuRemoteSessionCoordinator.js')")
    expect(sendMessage).not.toContain("../../bridge/replBridgeHandle.js")
  })

  test('keeps V8 runtime suites evidence-green once focused contract tests cover product behavior', () => {
    const mutation = getDsxuV8Item('V8-2')
    expect(mutation?.state).toBe('evidence_green')

    for (const id of ['V8-3', 'V8-4', 'V8-5', 'V8-6']) {
      const item = getDsxuV8Item(id)
      expect(item?.state).toBe('evidence_green')
      expect(item?.acceptance.join('\n')).toMatch(/PASS|verifier|credential|hook|resume|source evidence|worker/i)
    }
  })

  test('puts permission usability into evidence-green state while docs cleanup stays ready-to-build', () => {
    const permission = getDsxuV8Item('V8-7')
    const docs = getDsxuV8Item('V8-8')

    expect(permission?.state).toBe('evidence_green')
    expect(permission?.buildTasks.join('\n')).toContain('external workspace write grants')
    expect(permission?.acceptance.join('\n')).toContain('external writes require explicit scoped grant')
    expect(permission?.dsxuLanding.join('\n')).toContain('permission-usability.ts')
    expect(docs?.state).toBe('ready_to_build')
    expect(docs?.buildTasks.join('\n')).toContain('Normalize V3-V7 docs')
  })

  test('records the V8 execution document and benchmark gate names', () => {
    const doc = read('.dsxu/ops/DSXU-Code-V8-产品级能力建设执行队列.md')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')

    expect(doc).toContain('V8-1')
    expect(doc).toContain('V8-8')
    expect(doc).toContain('not a claim that provider backend or mutation live tasks are complete')
    expect(benchmark).toContain('v7-productization')
  })
})
