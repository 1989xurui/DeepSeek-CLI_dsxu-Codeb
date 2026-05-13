import type { DSXUTraceCollector } from './dsxu-trace'

export type MemoryLayer = 'process' | 'session' | 'extracted' | 'rule' | 'project' | 'team'

export interface DSXUMemoryRecord {
  memoryId: string
  layer: MemoryLayer
  text: string
  tags: string[]
  createdAt: number
}

export interface MemoryRefillResult {
  taskId: string
  selected: DSXUMemoryRecord[]
  injection: string
}

export interface MemoryRefillStats {
  totalMemories: number
  byLayer: Record<MemoryLayer, number>
  searchCount: number
  refillCount: number
  processCount: number
}

export interface MemoryTurnProcessResult {
  taskId: string
  extracted: DSXUMemoryRecord[]
  status: 'skipped' | 'processed'
}

export function createMemoryRefillControl(trace?: DSXUTraceCollector) {
  const records: DSXUMemoryRecord[] = []
  let seq = 0
  let searchCount = 0
  let refillCount = 0
  let processCount = 0

  return {
    remember(input: { layer: MemoryLayer; text: string; tags?: string[] }): DSXUMemoryRecord {
      const record: DSXUMemoryRecord = {
        memoryId: `memory-${++seq}`,
        layer: input.layer,
        text: input.text,
        tags: input.tags ?? [],
        createdAt: Date.now(),
      }
      records.push(record)
      return record
    },
    search(input: { query: string; layers?: MemoryLayer[]; limit?: number }): DSXUMemoryRecord[] {
      searchCount++
      return selectMemories(input.query, input.layers, input.limit)
    },
    refill(input: { taskId: string; query: string; layers?: MemoryLayer[]; limit?: number }): MemoryRefillResult {
      refillCount++
      const selected = selectMemories(input.query, input.layers, input.limit)
      const injection = selected.map((record) => `[${record.layer}] ${record.text}`).join('\n')
      trace?.record({
        type: 'task.updated',
        taskId: input.taskId,
        payload: { memoryRefill: { selected: selected.map((record) => record.memoryId), injection } },
      })
      return { taskId: input.taskId, selected, injection }
    },
    processTurnEnd(input: {
      taskId: string
      messages: Array<{ role: string; content: string }>
      minMessages?: number
    }): MemoryTurnProcessResult {
      const minMessages = input.minMessages ?? 5
      if (input.messages.length < minMessages) {
        return { taskId: input.taskId, extracted: [], status: 'skipped' }
      }
      processCount++
      const extracted: DSXUMemoryRecord[] = []
      const decisionMessages = input.messages.filter((message) => /(决定|decision|规则|rule|修复|fix|偏好|preference)/i.test(message.content))
      for (const message of decisionMessages.slice(-5)) {
        extracted.push(this.remember({
          layer: 'extracted',
          text: message.content.slice(0, 500),
          tags: inferTags(message.content),
        }))
      }
      trace?.record({
        type: 'task.updated',
        taskId: input.taskId,
        payload: { memoryTurnEnd: { extracted: extracted.map((record) => record.memoryId) } },
      })
      return { taskId: input.taskId, extracted, status: 'processed' }
    },
    stats(): MemoryRefillStats {
      const byLayer = {
        process: 0,
        session: 0,
        extracted: 0,
        rule: 0,
        project: 0,
        team: 0,
      }
      for (const record of records) byLayer[record.layer]++
      return {
        totalMemories: records.length,
        byLayer,
        searchCount,
        refillCount,
        processCount,
      }
    },
    list() {
      return [...records]
    },
  }

  function selectMemories(query: string, layersInput?: MemoryLayer[], limitInput?: number): DSXUMemoryRecord[] {
    const q = query.toLowerCase()
    const layers = layersInput ?? ['session', 'extracted', 'rule', 'project']
    return records
      .filter((record) => layers.includes(record.layer))
      .filter((record) => record.tags.some((tag) => q.includes(tag.toLowerCase())) || q.includes(record.text.toLowerCase().slice(0, 12)))
      .slice(0, limitInput ?? 5)
  }
}

function inferTags(text: string): string[] {
  const tags = new Set<string>()
  const lower = text.toLowerCase()
  if (/(test|测试|验证)/i.test(lower)) tags.add('test')
  if (/(fix|修复|bug)/i.test(lower)) tags.add('fix')
  if (/(rule|规则|policy|策略)/i.test(lower)) tags.add('rule')
  if (/(decision|决定|决策)/i.test(lower)) tags.add('decision')
  if (/(preference|偏好)/i.test(lower)) tags.add('preference')
  return [...tags]
}
