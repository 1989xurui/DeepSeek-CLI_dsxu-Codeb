import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { collectPublicComparableRawApiBaseline } from '../dsxu-public-comparable-raw-api-baseline'
import { collectPublicComparableRawEvidence } from '../dsxu-public-comparable-raw-evidence'

describe('dsxu-public-comparable-raw-api-baseline', () => {
  test('blocks without API key and does not create raw API artifacts', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root)
    const report = await collectPublicComparableRawApiBaseline({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'baseline.json'),
      env: {},
    })

    expect(report).toMatchObject({
      status: 'BLOCKED',
      didCallProvider: false,
      capturedCaseCount: 0,
      failedCaseCount: 1,
      publicBenchmarkClaimAllowed: false,
      externalComparisonClaimAllowed: false,
    })
    expect(existsSync(join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1', 'raw-api-response.json'))).toBe(false)
  })

  test('captures raw API baseline evidence without writing DSXU completion metrics', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root)
    const fetchCalls: Array<{ url: string; body: Record<string, unknown>; authorization?: string | null }> = []
    const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      fetchCalls.push({
        url: String(url),
        body,
        authorization: init?.headers instanceof Headers
          ? init.headers.get('Authorization')
          : (init?.headers as Record<string, string> | undefined)?.Authorization,
      })
      return new Response(JSON.stringify({
        id: 'chatcmpl-test',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '{"caseId":"case-1","rawApiCanComplete":false,"limitations":["no tools"]}',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 25,
          prompt_cache_hit_tokens: 20,
          prompt_cache_miss_tokens: 80,
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const baselineReport = await collectPublicComparableRawApiBaseline({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'baseline.json'),
      env: { DEEPSEEK_API_KEY: 'test-key' },
      fetchImpl: mockFetch,
    })
    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const responseWrapper = JSON.parse(await readFile(join(caseDir, 'raw-api-response.json'), 'utf8'))
    const importReport = await collectPublicComparableRawEvidence({
      root,
      manifestPath,
      outputPath: join(root, 'docs', 'generated', 'raw.json'),
      reportPath: join(root, 'docs', 'generated', 'import.json'),
    })

    expect(baselineReport).toMatchObject({
      status: 'PASS',
      didCallProvider: true,
      capturedCaseCount: 1,
      publicBenchmarkClaimAllowed: false,
    })
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0]?.authorization).toBe('Bearer test-key')
    expect(responseWrapper.request).not.toHaveProperty('Authorization')
    expect(responseWrapper).toMatchObject({
      schemaVersion: 'dsxu.public-comparable-raw-api-response.v1',
      caseId: 'case-1',
      promptHash: 'hash-case-1',
      responseOk: true,
    })
    expect(existsSync(join(caseDir, 'metrics.json'))).toBe(false)
    expect(existsSync(join(caseDir, 'prompt-hash.txt'))).toBe(true)
    expect(importReport).toMatchObject({
      status: 'PARTIAL',
      importedCaseCount: 1,
      readyCaseCount: 0,
      publicBenchmarkClaimAllowed: false,
      rawManifestWritten: true,
    })
    expect(importReport.cases[0]?.foundFields).toContain('rawApiResponsePath')
    expect(importReport.cases[0]?.missingFields).toContain('toolTracePath')
  })
})

async function createRoot(): Promise<string> {
  const root = join(tmpdir(), `dsxu-public-comparable-raw-api-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

async function writeManifest(root: string): Promise<string> {
  const manifestPath = join(root, 'docs', 'generated', 'manifest.json')
  await mkdir(join(root, 'docs', 'generated'), { recursive: true })
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
    cases: [
      {
        id: 'case-1',
        category: 'feature',
        promptHash: 'hash-case-1',
        prompt: 'Explain how to fix the sample task without claiming tools.',
        expectedModel: 'deepseek-v4-flash',
        workflowKind: 'generic_chat',
        routeReason: 'lightweight_flash_non_thinking',
        allowedTools: 'Grep',
        budgets: { maxToolCalls: 0 },
      },
    ],
  }), 'utf8')
  return manifestPath
}
