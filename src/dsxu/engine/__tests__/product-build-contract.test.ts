import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  getDsxuProductBuildContract,
  getDsxuProductBuildItem,
} from '../product-build-contract'

const root = process.cwd()

function read(path: string): string {
  if (path.includes('DSXU-Code-V8-')) {
    return readOpsDocContaining('V8-1', 'V8-8')
  }
  return readFileSync(join(root, path), 'utf8')
}

function readOpsDocContaining(...markers: string[]): string {
  const opsRoot = join(root, '.dsxu', 'ops')
  for (const name of readdirSync(opsRoot)) {
    if (!name.endsWith('.md')) continue
    const content = readFileSync(join(opsRoot, name), 'utf8')
    if (markers.every(marker => content.includes(marker))) return content
  }
  throw new Error(`missing ops doc with markers: ${markers.join(', ')}`)
}

describe('DSXU product build contract', () => {
  test('defines the product-build queue without claiming real live work is complete', () => {
    const contract = getDsxuProductBuildContract()

    expect(contract.runtime).toBe('DSXU Product Build')
    expect(contract.target).toContain('product-grade DeepSeek coding agent behavior')
    expect(contract.rules.join('\n')).toContain(
      'Do not mark a real product capability complete from Grep-only evidence',
    )
    expect(contract.releaseGate.dryGate).toBe('product-build')
    expect(contract.releaseGate.mutationLiveGate).toBe('product-mutation-live')
    expect(contract.releaseGate.minimumBenchmarkCount).toBeGreaterThanOrEqual(92)
    expect(contract.items.map(item => item.id)).toEqual([
      'product-build-1 Provider Backend Replacement',
      'product-build-2 Real Mutation Live Suite',
      'product-build-3 StopHook Product Runtime',
      'product-build-4 SessionMemory AutoDream Resume',
      'product-build-5 Agent Long-Run Suite',
      'product-build-6 Real MCP Server Harness',
      'product-build-7 Permission Usability',
      'product-build-8 Encoding and Docs Cleanup',
    ])
  })

  test('keeps provider backend replacement green after provider aliases are remapped', () => {
    const provider = getDsxuProductBuildItem('product-build-1')
    const cli = read('src/entrypoints/cli.tsx')
    const init = read('src/entrypoints/init.ts')
    const main = read('src/main.tsx')
    const sendMessage = read('src/tools/SendMessageTool/SendMessageTool.ts')

    expect(provider?.state).toBe('evidence_green')
    expect(provider?.buildTasks.join('\n')).toContain(
      '--remote, remote-control, and legacy target selectors',
    )
    expect(cli).not.toContain("await import('../bridge/bridgeMain.js')")
    expect(init).not.toContain('../upstreamproxy/upstreamproxy.js')
    expect(main).not.toContain("await import('./remote/DsxuRemoteSessionCoordinator.js')")
    expect(sendMessage).not.toContain('../../bridge/replBridgeHandle.js')
  })

  test('keeps runtime suites evidence-green once focused contract tests cover behavior', () => {
    const mutation = getDsxuProductBuildItem('product-build-2')
    expect(mutation?.state).toBe('evidence_green')

    for (const id of ['product-build-3', 'product-build-4', 'product-build-5', 'product-build-6']) {
      const item = getDsxuProductBuildItem(id)
      expect(item?.state).toBe('evidence_green')
      expect(item?.acceptance.join('\n')).toMatch(/PASS|verifier|credential|hook|resume|source evidence|worker/i)
    }
  })

  test('puts permission usability into evidence-green while docs cleanup stays ready', () => {
    const permission = getDsxuProductBuildItem('product-build-7')
    const docs = getDsxuProductBuildItem('product-build-8')

    expect(permission?.state).toBe('evidence_green')
    expect(permission?.buildTasks.join('\n')).toContain('external workspace write grants')
    expect(permission?.acceptance.join('\n')).toContain('external writes require explicit scoped grant')
    expect(permission?.dsxuLanding.join('\n')).toContain('permission-usability.ts')
    expect(docs?.state).toBe('ready_to_build')
    expect(docs?.buildTasks.join('\n')).toContain('Normalize historical-stage docs')
  })

  test('records historical execution docs and benchmark gate names without bad bytes', () => {
    const doc = read('.dsxu/ops/DSXU-Code-V8-historical-product-build-execution.md')
    const benchmark = read('scripts/benchmark/dsxu-mainline-benchmark.ts')

    expect(doc).toContain('V8-1')
    expect(doc).toContain('V8-8')
    expect(doc).toContain('not a claim that provider backend or mutation live tasks are complete')
    expect(benchmark).toContain('productization')
  })
})
