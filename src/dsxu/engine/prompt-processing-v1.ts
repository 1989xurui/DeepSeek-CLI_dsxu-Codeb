import type { PromptFragment, PromptStack, PromptLayerName } from './prompt-stack-v1'

export interface PromptSubmitInput {
  prompt: string
}

export interface PromptSubmitResult {
  accepted: boolean
  normalizedPrompt: string
  category: string
}

export interface LegacyPromptStack {
  task: string[]
  system: string[]
  context: string[]
}

export interface PromptStackLayersInput {
  normalizedPrompt: string
  category: string
  systemPromptType: string
  teammateAddendum?: string
}

export interface PromptEditResult {
  edits: string[]
  editedPrompt: string
}

export interface PromptShellResult {
  shouldExecute: boolean
  command: string
  reason: string
}

export interface TeammateAddendumResult {
  addendum: string
  prompt: string
}

export function submitPrompt(input: string | PromptSubmitInput): PromptSubmitResult {
  const raw = typeof input === 'string' ? input : input.prompt
  return handlePromptSubmit({ prompt: raw })
}

export function handlePromptSubmit(input: PromptSubmitInput): PromptSubmitResult {
  const normalizedPrompt = input.prompt.trim().replace(/\s+/g, ' ')
  const hasHint = /teammate|agent|verify|edit|patch|plan|fix|run/i.test(normalizedPrompt)

  return {
    accepted: normalizedPrompt.length > 0,
    normalizedPrompt,
    category: hasHint ? 'teammate' : 'user',
  }
}

export function processTextPrompt(raw: string): { normalized: string } {
  return { normalized: raw.trim().replace(/\s+/g, ' ') }
}

export function editPrompt(input: string, steps: string[]): PromptEditResult {
  const base = input.trim().replace(/\s+/g, ' ')
  const edits: string[] = []
  let editedPrompt = base

  for (const step of steps) {
    if (step === 'trim') {
      editedPrompt = editedPrompt.trim()
      edits.push('trim')
    } else if (step === 'normalize-space') {
      editedPrompt = editedPrompt.replace(/\s+/g, ' ')
      edits.push('normalize-space')
    } else if (step === 'lowercase') {
      editedPrompt = editedPrompt.toLowerCase()
      edits.push('lowercase')
    } else {
      edits.push(`noop:${step}`)
    }
  }

  return { edits, editedPrompt }
}

export function executePromptShell(raw: string): PromptShellResult {
  const command = raw.trim()
  const shouldExecute =
    /^(shell:|bash:|sh:|powershell:)/i.test(command) ||
    /(^|\s)(bun|npm|yarn|pnpm|pytest|pytest\.py|pytest-asyncio)\s/i.test(command) ||
    /\brun\s+.*(bun|npm|yarn|pnpm|pytest|node)\b/i.test(command)
  const reason = shouldExecute ? 'shell prompt detected' : 'no shell execution signal'
  return {
    shouldExecute,
    command,
    reason,
  }
}

export function detectSystemPromptType(prompt: string): string {
  const normalized = prompt.toLowerCase()

  if (/\b(shell:|bash:|powershell:|sh:)\b|(^|\s)run\s+(bun|npm|yarn|pnpm|pytest|node)\b|\bcommand\b|\bshell\b|\btest\b/i.test(normalized)) {
    return 'shell'
  }
  if (/(teammate|assistant|coord|review|verify|mate|协作|审核)/i.test(normalized)) return 'teammate'
  if (/(edit|fix|patch|refactor|modify|编辑|修复|重构)/i.test(normalized)) return 'code-edit'
  return 'general'
}

export function categorizePrompt(input: string): string {
  const command = detectSystemPromptType(input)
  return command === 'shell' ? 'shell' : command
}

export function addTeammatePromptAddendum(prompt: string): TeammateAddendumResult {
  const addendum = `teammate-context: ${prompt}`
  return {
    addendum,
    prompt: [prompt, addendum].filter(Boolean).join('\n'),
  }
}

export function extractUserKeywords(input: string): string[] {
  const lower = input.toLowerCase()
  return Array.from(new Set(lower.split(/\W+/).filter((token) => token.length >= 3)))
}

export function applyPromptProcessingResult(
  stack: PromptStack | LegacyPromptStack,
  input: PromptStackLayersInput,
): PromptStack | LegacyPromptStack {
  const normalizedSystemType = input.systemPromptType || 'general'

  const taskLayer = [
    `task:${input.normalizedPrompt}`,
    `category:${input.category}`,
    `type:${normalizedSystemType}`,
  ]

  const systemLayer = [
    `system:${input.systemPromptType}`,
    `category:${input.category}`,
  ]

  const contextLayer = [
    `context:${typeof input.normalizedPrompt === 'string' ? input.normalizedPrompt.length : 0}`,
  ]

  if (input.teammateAddendum) {
    taskLayer.push(`teammate:${input.teammateAddendum}`)
    systemLayer.push('teammate:addendum')
  }

  if (isPromptStack(stack)) {
    return {
      ...stack,
      layers: {
        system: appendFragments(stack.layers.system, buildFragments('system', systemLayer)),
        task: appendFragments(stack.layers.task, buildFragments('task', taskLayer)),
        context: appendFragments(stack.layers.context, buildFragments('context', contextLayer)),
        skill: [...stack.layers.skill],
      },
    }
  }

  return {
    task: [...stack.task, ...taskLayer],
    system: [...stack.system, ...systemLayer],
    context: [...stack.context, ...contextLayer],
  }
}

export function applyProcessingResult(stack: PromptStack | LegacyPromptStack, input: PromptStackLayersInput) {
  return applyPromptProcessingResult(stack, input)
}

export function parsePromptProcessingModules(text: string): {
  prompt: string
  category: 'shell' | 'edit' | 'review' | 'plan' | 'unknown'
} {
  const normalized = text.toLowerCase()
  if (/bun|npm|yarn|pnpm|pytest|test|pytest/.test(normalized)) return { prompt: text, category: 'shell' }
  if (/(edit|patch|fix|modify|refactor|修改|编辑|修复)/.test(normalized))
    return { prompt: text, category: 'edit' }
  if (/(verify|review|audit|检查|验证)/.test(normalized)) return { prompt: text, category: 'review' }
  if (/(plan|roadmap|milestone|phase|scope)/.test(normalized)) return { prompt: text, category: 'plan' }
  return { prompt: text, category: 'unknown' }
}

function isPromptStack(input: any): input is PromptStack {
  return (
    input &&
    typeof input === 'object' &&
    typeof input.stackId === 'string' &&
    input.layers &&
    typeof input.layers === 'object'
  )
}

function buildFragments(layer: PromptLayerName, lines: string[]): PromptFragment[] {
  return lines.map((line) => ({
    fragmentId: `${layer}-${Date.now().toString(36)}-${Math.floor(Math.random() * 10_000).toString(36)}`,
    layer,
    text: line,
    priority: 1,
    source: layer === 'system' ? 'system' : layer === 'task' ? 'task' : layer === 'context' ? 'context' : 'skill',
  }))
}

function appendFragments(base: PromptFragment[], added: PromptFragment[]) {
  const next = [...base, ...added]
  next.sort((a, b) => b.priority - a.priority || a.fragmentId.localeCompare(b.fragmentId))
  return next
}
