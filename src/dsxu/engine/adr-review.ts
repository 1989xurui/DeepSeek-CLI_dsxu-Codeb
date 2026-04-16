/**
 * #5.4 ADR + 交叉审查 (Cross-Review)
 *
 * 5 种 ADR 模板 + 独立 Reviewer 节点：
 *   1. 检测到架构/设计类任务 → 注入 ADR 模板
 *   2. Reasoner 填写 ADR 文档
 *   3. 独立 Reviewer（不带讨论历史）审查 ADR
 *   4. 有问题 → 回到 2 修改（最多 2 轮）
 *
 * Reviewer 不带历史 = 不会被前面讨论误导 = 更客观
 * 成本：只多一次 chat 请求
 */

import type { Message, LLMCallFn } from './types'

// ── ADR 模板 ──

export const ADR_TEMPLATES: Record<string, string> = {
  'event-driven': `## ADR-{id}: {title}

### Context
What is the background? What problem are we solving?

### Decision: Event-Driven Architecture
- **Event Bus**: [选择：Kafka / RabbitMQ / Redis Streams / in-process EventEmitter]
- **Event Schema**: [JSON Schema / Protobuf / Avro]
- **Delivery**: [at-least-once / exactly-once / best-effort]

### Module Responsibilities
| Module | Produces Events | Consumes Events | Description |
|--------|----------------|-----------------|-------------|
| | | | |

### Interface Contract
\`\`\`typescript
interface Event<T> {
  type: string
  payload: T
  timestamp: number
  source: string
}
\`\`\`

### Data Flow
[Describe the event flow from trigger to final consumer]

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Event ordering | Data inconsistency | Sequence numbers + idempotency |
| | | |

### Decision Status: [Proposed / Accepted / Deprecated]`,

  'microkernel': `## ADR-{id}: {title}

### Context
What is the background? What problem are we solving?

### Decision: Microkernel / Plugin Architecture
- **Core**: [Minimal kernel responsibilities]
- **Plugin Interface**: [API / IPC / shared memory]
- **Plugin Discovery**: [directory scan / registry / config]

### Core vs Plugin Boundary
| Responsibility | Core | Plugin | Rationale |
|---------------|------|--------|-----------|
| | | | |

### Plugin Contract
\`\`\`typescript
interface Plugin {
  name: string
  version: string
  init(kernel: Kernel): Promise<void>
  destroy(): Promise<void>
}
\`\`\`

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Plugin conflicts | System instability | Sandbox + capability-based isolation |
| | | |

### Decision Status: [Proposed / Accepted / Deprecated]`,

  'mvc-service-repo': `## ADR-{id}: {title}

### Context
What is the background?

### Decision: MVC + Service + Repository
- **View**: [React / Vue / CLI / API-only]
- **Controller**: [Express routes / API handlers]
- **Service**: [Business logic layer]
- **Repository**: [Data access abstraction]

### Layer Responsibilities
| Layer | Allowed Dependencies | Responsibilities |
|-------|---------------------|-----------------|
| View | Controller | User interaction |
| Controller | Service | Request routing, validation |
| Service | Repository | Business logic |
| Repository | DB/External | Data persistence |

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| | | |

### Decision Status: [Proposed / Accepted / Deprecated]`,

  'cqrs-eventsource': `## ADR-{id}: {title}

### Context
What is the background?

### Decision: CQRS + Event Sourcing
- **Command Model**: [Write-side aggregate design]
- **Query Model**: [Read-side projections]
- **Event Store**: [EventStoreDB / PostgreSQL / custom]
- **Projection**: [Sync / Async / Both]

### Aggregates & Events
| Aggregate | Commands | Events | Description |
|-----------|----------|--------|-------------|
| | | | |

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Eventual consistency | Stale reads | Compensation events + UI indicators |
| | | |

### Decision Status: [Proposed / Accepted / Deprecated]`,

  'hexagonal': `## ADR-{id}: {title}

### Context
What is the background?

### Decision: Hexagonal / Ports and Adapters
- **Domain Core**: [Pure business logic, no I/O]
- **Ports**: [Interfaces defining boundaries]
- **Adapters**: [Implementations connecting to external systems]

### Ports & Adapters Map
| Port (Interface) | Direction | Adapter(s) | Description |
|-----------------|-----------|-----------|-------------|
| | Driving (in) | | |
| | Driven (out) | | |

### Dependency Rule
- Adapters depend on Ports (not vice versa)
- Domain Core depends on nothing external
- All I/O at the edges

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Over-abstraction | Boilerplate overhead | Only abstract at true boundaries |
| | | |

### Decision Status: [Proposed / Accepted / Deprecated]`,
}

export type ADRTemplate = keyof typeof ADR_TEMPLATES

/** 获取所有模板名称 */
export function getADRTemplateNames(): string[] {
  return Object.keys(ADR_TEMPLATES)
}

/** 选择最合适的 ADR 模板 */
export function selectADRTemplate(taskDescription: string): ADRTemplate {
  const lower = taskDescription.toLowerCase()

  // Check CQRS before event-driven (more specific match first)
  if (lower.includes('cqrs') || lower.includes('event sourc') || lower.includes('事件溯源')) {
    return 'cqrs-eventsource'
  }
  if (lower.includes('event') || lower.includes('message') || lower.includes('pub/sub') || lower.includes('队列')) {
    return 'event-driven'
  }
  if (lower.includes('plugin') || lower.includes('extension') || lower.includes('插件')) {
    return 'microkernel'
  }
  if (lower.includes('hexagonal') || lower.includes('port') || lower.includes('adapter') || lower.includes('六边形')) {
    return 'hexagonal'
  }
  // Default
  return 'mvc-service-repo'
}

// ── Cross-Review ──

export interface ReviewResult {
  /** 审查是否通过 */
  approved: boolean
  /** 具体反馈 */
  feedback: string
  /** 发现的问题 */
  issues: string[]
  /** 审查轮次 */
  round: number
}

const REVIEWER_PROMPT = `You are an independent architecture reviewer. You have NOT seen the discussion that led to this ADR — you only see the final document.

Review the ADR for:
1. **Completeness**: Are all sections filled? Missing modules/interfaces/risks?
2. **Consistency**: Do interfaces match module responsibilities? Are data flows correct?
3. **Risk Coverage**: Are major risks identified? Are mitigations realistic?
4. **Clarity**: Can a new developer understand this without additional context?

Output format (JSON):
{"approved": true/false, "issues": ["issue 1", "issue 2"], "feedback": "overall assessment"}`

/**
 * 独立交叉审查 — Reviewer 不带历史上下文
 *
 * @param adrContent ADR 文档内容
 * @param llmCall LLM 调用函数
 * @returns 审查结果
 */
export async function crossReview(
  adrContent: string,
  llmCall: LLMCallFn,
  round: number = 1,
): Promise<ReviewResult> {
  try {
    const response = await llmCall(
      [
        { role: 'system', content: REVIEWER_PROMPT },
        { role: 'user', content: `Review this Architecture Decision Record:\n\n${adrContent}` },
      ],
      [],
      { model: 'deepseek-chat', maxTokens: 2000 },
    )

    // Parse reviewer response
    const text = response.content.trim()

    // Try JSON parsing
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[0])
        return {
          approved: obj.approved === true,
          feedback: obj.feedback || '',
          issues: Array.isArray(obj.issues) ? obj.issues : [],
          round,
        }
      } catch {}
    }

    // Fallback: infer from text
    const hasIssues = /issue|problem|missing|incomplete|concern/i.test(text)
    return {
      approved: !hasIssues,
      feedback: text.slice(0, 2000),
      issues: hasIssues ? [text.slice(0, 500)] : [],
      round,
    }
  } catch (error: any) {
    return {
      approved: true,  // Don't block on reviewer failure
      feedback: `Review failed: ${error.message}`,
      issues: [],
      round,
    }
  }
}

/**
 * 完整 ADR 流程：生成 + 审查 + 修改（最多 2 轮）
 *
 * @param taskDescription 任务描述
 * @param context 额外上下文
 * @param llmCall LLM 调用函数
 */
export async function runADRWorkflow(
  taskDescription: string,
  context: string,
  llmCall: LLMCallFn,
): Promise<{ adr: string; reviews: ReviewResult[]; template: string }> {
  const templateName = selectADRTemplate(taskDescription)
  const template = ADR_TEMPLATES[templateName]
  const reviews: ReviewResult[] = []

  // Step 1: Generate ADR
  const genResponse = await llmCall(
    [
      {
        role: 'system',
        content: `You are a senior architect. Fill in this ADR template completely based on the task description and context. Be specific — no placeholders.\n\nTemplate:\n${template}`,
      },
      {
        role: 'user',
        content: `Task: ${taskDescription}\n\nContext:\n${context}`,
      },
    ],
    [],
    { model: 'deepseek-reasoner', maxTokens: 4000 },
  )

  let adr = genResponse.content

  // Step 2-3: Review + Revise (max 2 rounds)
  for (let round = 1; round <= 2; round++) {
    const review = await crossReview(adr, llmCall, round)
    reviews.push(review)

    if (review.approved || review.issues.length === 0) {
      break
    }

    // Revise based on feedback
    const reviseResponse = await llmCall(
      [
        {
          role: 'system',
          content: 'Revise the ADR to address the reviewer feedback. Keep the same format.',
        },
        {
          role: 'user',
          content: `Current ADR:\n${adr}\n\nReviewer Feedback (Round ${round}):\n${review.feedback}\n\nIssues:\n${review.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`,
        },
      ],
      [],
      { model: 'deepseek-chat', maxTokens: 4000 },
    )

    adr = reviseResponse.content
  }

  return { adr, reviews, template: templateName }
}

/** 检测是否是架构类任务 */
export function isArchitectureTask(text: string): boolean {
  const patterns = [
    /architect/i, /设计架构/i, /refactor entire/i, /系统设计/i,
    /microservice/i, /monolith/i, /从零开始/i, /from scratch/i,
    /重构/i, /redesign/i, /migration plan/i, /技术选型/i,
    /ADR/i, /决策记录/i,
  ]
  return patterns.some(p => p.test(text))
}
