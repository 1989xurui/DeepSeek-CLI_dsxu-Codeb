import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const repoRoot = process.cwd()

function readDoc(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('DSXU public documentation truth', () => {
  test('benchmark index binds public claims to real evidence and blocked-claim rules', () => {
    const doc = readDoc('docs/BENCHMARK.md')

    expect(doc).toContain('DSXU Benchmark and Public Evidence Truth')
    expect(doc).toContain('bun run benchmark:hard-engineering')
    expect(doc).toContain('DSXU_HARD_ENGINEERING_BENCHMARK_20260517.md')
    expect(doc).toContain('bun run evidence:blocked-claim-corpus')
    expect(doc).toContain('same-task target/reference manifest')
    expect(doc).toContain('No external leaderboard win')
    expect(doc).not.toMatch(/reaches\s+.*95/i)
    expect(doc).not.toMatch(/beats\s+/i)
  })

  test('DeepSeek capability truth uses official source URLs and DSXU route boundaries', () => {
    const doc = readDoc('docs/DEEPSEEK_V4_CAPABILITIES.md')

    expect(doc).toContain('https://api-docs.deepseek.com/zh-cn/api/create-chat-completion')
    expect(doc).toContain('https://api-docs.deepseek.com/zh-cn/guides/thinking_mode')
    expect(doc).toContain('https://api-docs.deepseek.com/zh-cn/guides/json_mode')
    expect(doc).toContain('https://api-docs.deepseek.com/zh-cn/guides/function_calling')
    expect(doc).toContain('https://api-docs.deepseek.com/zh-cn/guides/fim_completion')
    expect(doc).toContain('https://api-docs.deepseek.com/zh-cn/guides/kv_cache')
    expect(doc).toContain('Flash non-thinking')
    expect(doc).toContain('Pro')
    expect(doc).toContain('Requires explicit admission reason')
    expect(doc).toContain('Cache hit rate is an optimization signal')
  })
})
