import { ExperienceStore } from '../../services/experience/store'
import { runMutationTests } from '../../services/mutation/index'
import { runPbt, suggestProperties } from '../../services/pbt/index'

export function createRuntime(options?: {
  vectorStore?: unknown
  experience?: ConstructorParameters<typeof ExperienceStore>[0]
  mcp?: unknown
}) {
  const experienceStore = new ExperienceStore(options?.experience)

  return {
    vectorStore: options?.vectorStore ?? null,
    experienceStore,
    search: {
      query: async () => [],
    },
    mcpAdapters: ['filesystem', 'shell', 'git', 'browser', 'provider'].map((name) => ({
      name,
      mcp: options?.mcp ?? null,
    })),
    mutation: {
      run: runMutationTests,
    },
    pbt: {
      suggest: suggestProperties,
      run: runPbt,
    },
  }
}

export function wireExperienceToPrompt(store: ExperienceStore) {
  return {
    async getExperienceContext(task: string): Promise<string> {
      try {
        const records = await store.retrieve(task, 3)
        if (records.length === 0) return ''
        return records
          .map((record) => `- ${record.taskDescription}: ${record.outcome}`)
          .join('\n')
      } catch {
        return ''
      }
    },
  }
}

export function wireMutationToAnalysis() {
  return {
    async getMutationCoverage(sourceCode: string, testRunner: () => Promise<boolean>) {
      const report = await runMutationTests(
        sourceCode,
        'inline.js',
        { maxMutations: 10, timeoutMs: 1_000 },
        {
          mockTestRunner: async () => ({ passed: await testRunner(), output: 'mock' }),
          mockMutationGenerator: (source, file) => [
            {
              id: 'mut-1',
              file,
              line: 1,
              operator: 'replace-operator',
              before: source.includes('+') ? '+' : source.slice(0, 1),
              after: source.includes('+') ? '-' : source.slice(0, 1),
              description: 'inline smoke mutation',
            },
          ],
        }
      )
      return {
        killRate: report.killRate,
        totalMutations: report.total,
      }
    },
  }
}
