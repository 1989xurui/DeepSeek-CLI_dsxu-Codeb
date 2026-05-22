import { hashEmbedding } from './embedding-ollama'

export type L3RecordType = 'experience' | 'pattern' | 'resolution'

export type L3ArchiveRecord = {
  id?: string
  ts: number
  type: L3RecordType
  description: string
  content: string
  quality: number
  helpfulness: number | null
  source: string
  embedding?: number[]
  retrievals?: number
}

export type L3ArchiveOptions = {
  dbPath: string
  embedFn?: (texts: string[]) => Promise<number[][]>
  embeddingDim?: number
  defaultTopK?: number
  minRelevance?: number
}

export class L3Archive {
  private records: L3ArchiveRecord[] = []
  private initialized = false
  private readonly embeddingDim: number
  private readonly defaultTopK: number
  private readonly minRelevance: number
  private readonly embedFn?: (texts: string[]) => Promise<number[][]>

  constructor(private readonly options: L3ArchiveOptions) {
    this.embeddingDim = options.embeddingDim ?? 768
    this.defaultTopK = options.defaultTopK ?? 5
    this.minRelevance = options.minRelevance ?? 0.1
    this.embedFn = options.embedFn
  }

  async init(): Promise<void> {
    this.initialized = true
  }

  async add(input: Omit<L3ArchiveRecord, 'id' | 'embedding' | 'retrievals'>): Promise<string | null> {
    this.ensureInit()
    if (input.quality < 0.6) return null

    const duplicate = this.records.find(
      (record) => record.description === input.description && record.content === input.content
    )
    if (duplicate) {
      duplicate.quality = Math.max(duplicate.quality, input.quality)
      duplicate.helpfulness = input.helpfulness ?? duplicate.helpfulness
      return duplicate.id ?? null
    }

    const [embedding] = this.embedFn
      ? await this.embedFn([`${input.description}\n${input.content}`])
      : [hashEmbedding(`${input.description}\n${input.content}`, this.embeddingDim)]
    const id = `l3-${Date.now().toString(36)}-${(this.records.length + 1)
      .toString()
      .padStart(4, '0')}`
    this.records.push({
      ...input,
      id,
      embedding,
      retrievals: 0,
    })
    return id
  }

  async retrieve(query: string, topK = this.defaultTopK): Promise<L3ArchiveRecord[]> {
    this.ensureInit()
    const [queryEmbedding] = this.embedFn
      ? await this.embedFn([query])
      : [hashEmbedding(query, this.embeddingDim)]
    const queryTerms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean))

    const scored = this.records
      .map((record) => {
        const text = `${record.description} ${record.content}`.toLowerCase()
        const lexical =
          Array.from(queryTerms).filter((term) => text.includes(term)).length /
          Math.max(1, queryTerms.size)
        const similarity = cosine(queryEmbedding, record.embedding ?? [])
        return {
          record,
          score: Math.max(lexical, similarity),
        }
      })
      .filter((item) => item.score >= this.minRelevance)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    for (const item of scored) {
      item.record.retrievals = (item.record.retrievals ?? 0) + 1
    }

    return scored.map((item) => ({ ...item.record }))
  }

  formatForInjection(records: L3ArchiveRecord[]): string {
    if (records.length === 0) return ''
    return [
      '<archived_knowledge>',
      ...records.map((record) => `- [${record.type}] ${record.description}: ${record.content}`),
      '</archived_knowledge>',
    ].join('\n')
  }

  async feedback(id: string, helpfulness: number): Promise<void> {
    const record = this.records.find((item) => item.id === id)
    if (!record) return
    record.helpfulness = helpfulness
    record.quality = record.quality * 0.7 + helpfulness * 0.3
  }

  stats(): { total: number; avgQuality: number } {
    const total = this.records.length
    return {
      total,
      avgQuality:
        total === 0
          ? 0
          : this.records.reduce((sum, record) => sum + record.quality, 0) / total,
    }
  }

  private ensureInit(): void {
    if (!this.initialized) throw new Error('L3Archive not initialized')
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const length = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1))
}
