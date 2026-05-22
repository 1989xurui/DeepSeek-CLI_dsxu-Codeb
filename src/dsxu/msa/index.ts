import { L3Archive, type L3ArchiveRecord, type L3ArchiveOptions } from './l3-archive'

export { L3Archive } from './l3-archive'
export { createOllamaEmbedFn, getEmbeddingDimension } from './embedding-ollama'

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function stableHash(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export class L1Core {
  private cached: { prefix: string; estimatedTokens: number; hash: string } | null = null

  constructor(
    private readonly options: {
      projectRoot: string
      projectName?: string
      customInstructions?: string
      maxTokens?: number
    }
  ) {}

  async build(): Promise<{ prefix: string; estimatedTokens: number; hash: string }> {
    if (this.cached) return this.cached
    const maxTokens = this.options.maxTokens ?? 2_500
    let prefix = [
      `Project: ${this.options.projectName ?? 'DSXU Project'}`,
      `Root: ${this.options.projectRoot}`,
      this.options.customInstructions ? `Instructions: ${this.options.customInstructions}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    const maxChars = maxTokens * 4
    if (prefix.length > maxChars) prefix = prefix.slice(0, maxChars)
    this.cached = {
      prefix,
      estimatedTokens: Math.min(maxTokens, estimateTokens(prefix)),
      hash: stableHash(prefix),
    }
    return this.cached
  }

  getCached(): { prefix: string; estimatedTokens: number; hash: string } | null {
    return this.cached
  }

  invalidate(): void {
    this.cached = null
  }
}

type L2Entry = {
  type: 'conversation' | 'file_context' | 'task_state' | 'tool_result'
  key?: string
  content: string
}

export class L2Working {
  private rounds: Array<{ user: string; assistant: string }> = []
  private entries: L2Entry[] = []
  private taskState: string | null = null

  constructor(private readonly options: { maxTokens?: number; keepFullRounds?: number } = {}) {}

  get entryCount(): number {
    return this.entries.length + this.rounds.length + (this.taskState ? 1 : 0)
  }

  addConversationRound(user: string, assistant: string): void {
    this.rounds.push({ user, assistant })
    const keep = this.options.keepFullRounds ?? 3
    while (this.rounds.length > keep) {
      const evicted = this.rounds.shift()
      if (evicted) {
        this.entries.push({
          type: 'conversation',
          content: `Summary: ${evicted.user} -> ${evicted.assistant}`,
        })
      }
    }
  }

  addFileContext(path: string, content: string): void {
    this.entries = this.entries.filter(
      (entry) => !(entry.type === 'file_context' && entry.key === path)
    )
    this.entries.push({
      type: 'file_context',
      key: path,
      content: `${path}\n${content}`,
    })
  }

  setTaskState(content: string): void {
    this.taskState = content
  }

  addToolResult(tool: string, result: string): void {
    this.entries.push({
      type: 'tool_result',
      key: tool,
      content: `${tool}: ${result}`,
    })
  }

  getConversationRounds(): Array<{ user: string; assistant: string }> {
    return [...this.rounds]
  }

  getEntries(): L2Entry[] {
    const taskEntry: L2Entry[] = this.taskState
      ? [{ type: 'task_state', content: this.taskState }]
      : []
    return [...this.entries, ...taskEntry]
  }

  build(maxTokens = this.options.maxTokens ?? 4_500): { text: string; estimatedTokens: number } {
    const lines: string[] = []
    for (const entry of this.getEntries()) lines.push(entry.content)
    for (const round of this.rounds) lines.push(`User: ${round.user}\nAssistant: ${round.assistant}`)
    let text = lines.join('\n\n')
    const maxChars = maxTokens * 4
    if (text.length > maxChars) text = text.slice(0, maxChars)
    return {
      text,
      estimatedTokens: estimateTokens(text),
    }
  }

  clear(): void {
    this.rounds = []
    this.entries = []
    this.taskState = null
  }
}

export class MSA {
  readonly l1: L1Core
  readonly l2: L2Working
  readonly l3: L3Archive
  private initialized = false
  private readonly totalBudget: number

  constructor(options: {
    l1: ConstructorParameters<typeof L1Core>[0]
    l2?: ConstructorParameters<typeof L2Working>[0]
    l3?: L3ArchiveOptions
    totalBudget?: number
  }) {
    this.l1 = new L1Core(options.l1)
    this.l2 = new L2Working(options.l2)
    this.l3 = new L3Archive(
      options.l3 ?? {
        dbPath: '/tmp/dsxu-msa.db',
        embeddingDim: 768,
      }
    )
    this.totalBudget = options.totalBudget ?? 8_000
  }

  async init(): Promise<void> {
    await this.l3.init()
    this.initialized = true
  }

  async buildContext(query?: string): Promise<{
    l1: Awaited<ReturnType<L1Core['build']>>
    l2: ReturnType<L2Working['build']>
    l3Results: string
    l3Tokens: number
    totalTokens: number
    overBudget: boolean
  }> {
    this.ensureInit()
    const l1 = await this.l1.build()
    const remainingAfterL1 = Math.max(0, this.totalBudget - l1.estimatedTokens)
    const l2 = this.l2.build(remainingAfterL1)
    let l3Results = ''
    let l3Tokens = 0

    if (query) {
      const records = await this.l3.retrieve(query)
      l3Results = this.l3.formatForInjection(records)
      l3Tokens = estimateTokens(l3Results)
    }

    const totalTokens = l1.estimatedTokens + l2.estimatedTokens + l3Tokens
    return {
      l1,
      l2,
      l3Results,
      l3Tokens,
      totalTokens,
      overBudget: totalTokens > this.totalBudget,
    }
  }

  archive(record: Omit<L3ArchiveRecord, 'id' | 'embedding' | 'retrievals'>): Promise<string | null> {
    this.ensureInit()
    return this.l3.add(record)
  }

  archiveSession(summary: string): Promise<string | null> {
    return this.archive({
      ts: Date.now(),
      type: 'experience',
      description: summary,
      content: summary,
      quality: 0.8,
      helpfulness: null,
      source: 'session',
    })
  }

  resetSession(): void {
    this.l2.clear()
  }

  stats(): {
    budget: number
    l1: { cached: boolean }
    l2: { entries: number }
    l3: ReturnType<L3Archive['stats']>
  } {
    return {
      budget: this.totalBudget,
      l1: { cached: this.l1.getCached() !== null },
      l2: { entries: this.l2.entryCount },
      l3: this.l3.stats(),
    }
  }

  private ensureInit(): void {
    if (!this.initialized) throw new Error('MSA not initialized')
  }
}
