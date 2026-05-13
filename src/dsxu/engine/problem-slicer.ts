import { decideEffortRouting } from './effort-routing'
import type {
  EffortRoutingInput,
  ProblemSlice,
  ProblemSliceProfile,
  ProblemSliceRiskLevel,
  ProblemSlicerResult,
} from './types'

export type {
  ProblemSlice,
  ProblemSliceProfile,
  ProblemSliceRiskLevel,
  ProblemSlicerResult,
} from './types'

type ProblemSliceInput = Omit<ProblemSlice, 'createdAt' | 'updatedAt'>

type ValidationResult = {
  valid: boolean
  errors: string[]
}

const PROFILES: ProblemSliceProfile[] = ['plan', 'edit', 'review', 'session']
const RISK_LEVELS: ProblemSliceRiskLevel[] = ['low', 'medium', 'high']

export function createProblemSlice(input: ProblemSliceInput): ProblemSlice {
  const now = Date.now()
  return {
    ...input,
    expectedTools: [...input.expectedTools],
    dependencies: input.dependencies ? [...input.dependencies] : undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export function createProblemSlicerResult(originalTask: string, slices: ProblemSlice[]): ProblemSlicerResult {
  const totalEstimatedEffort =
    slices.length > 0 && slices.every(slice => slice.estimatedEffort !== undefined)
      ? slices.reduce((sum, slice) => sum + (slice.estimatedEffort ?? 0), 0)
      : undefined

  return {
    originalTask,
    slices,
    totalSlices: slices.length,
    overallRiskLevel: highestRiskLevel(slices.map(slice => slice.riskLevel)),
    totalEstimatedEffort,
    generatedAt: Date.now(),
  }
}

export function validateProblemSlice(slice: Partial<ProblemSlice>): ValidationResult {
  const errors: string[] = []

  if (!slice.id || slice.id.trim().length === 0) {
    errors.push('切片ID不能为空')
  }

  if (!slice.title || slice.title.trim().length === 0) {
    errors.push('切片标题不能为空')
  }

  if (!slice.intent || slice.intent.trim().length === 0) {
    errors.push('切片意图不能为空')
  }

  if (!slice.suggestedProfile) {
    errors.push('必须指定建议剖面')
  } else if (!PROFILES.includes(slice.suggestedProfile)) {
    errors.push('建议剖面必须是 plan、edit、review 或 session')
  }

  if (!slice.riskLevel || !RISK_LEVELS.includes(slice.riskLevel)) {
    errors.push('风险等级必须是 low、medium 或 high')
  }

  if (!Array.isArray(slice.expectedTools)) {
    errors.push('expectedTools必须是数组')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function sliceProblem(task: string): ProblemSlicerResult {
  const originalTask = task
  const normalizedTask = task.trim()

  if (normalizedTask.length === 0) {
    return createProblemSlicerResult(originalTask, [])
  }

  const segments = splitTask(normalizedTask)
  const baseSlices = buildBaseSlices(segments, normalizedTask)
  const slicesWithEffort = baseSlices.map((slice, index) => attachEffortRouting(slice, index, baseSlices.length))

  return createProblemSlicerResult(originalTask, slicesWithEffort)
}

function splitTask(task: string): string[] {
  const segments = task
    .split(/[\r\n。.!?！？；;]+/u)
    .map(part => part.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return [task]
  }

  return segments.slice(0, 4)
}

function buildBaseSlices(segments: string[], fullTask: string): ProblemSlice[] {
  const candidates = segments.map((segment, index) => createSliceFromSegment(segment, index, fullTask))
  const normalized = ensurePlanAndReview(candidates, fullTask)

  return normalized.slice(0, 4)
}

function createSliceFromSegment(segment: string, index: number, fullTask: string): ProblemSlice {
  const profile = inferProfile(segment)
  const riskLevel = inferRiskLevel(segment, fullTask)
  const expectedTools = inferExpectedTools(segment, profile)

  return createProblemSlice({
    id: `slice-${String(index + 1).padStart(3, '0')}`,
    title: summarizeTitle(segment, profile),
    intent: segment,
    suggestedProfile: profile,
    expectedTools,
    riskLevel,
    description: segment,
    estimatedEffort: estimateEffort(segment, riskLevel, expectedTools),
  })
}

function ensurePlanAndReview(slices: ProblemSlice[], fullTask: string): ProblemSlice[] {
  const next = [...slices]
  const fullRisk = inferRiskLevel(fullTask, fullTask)

  if (!next.some(slice => slice.suggestedProfile === 'plan')) {
    next.unshift(createProblemSlice({
      id: 'slice-plan',
      title: 'Plan task approach',
      intent: `Analyze and plan: ${fullTask}`,
      suggestedProfile: 'plan',
      expectedTools: ['analysis'],
      riskLevel: fullRisk,
      description: fullTask,
      estimatedEffort: estimateEffort(fullTask, fullRisk, ['analysis']),
    }))
  }

  if (!next.some(slice => slice.suggestedProfile === 'review')) {
    const reviewTools = inferExpectedTools(fullTask, 'review')
    next.push(createProblemSlice({
      id: 'slice-review',
      title: 'Review and verify result',
      intent: `Review and verify: ${fullTask}`,
      suggestedProfile: 'review',
      expectedTools: reviewTools,
      riskLevel: fullRisk,
      description: fullTask,
      estimatedEffort: estimateEffort(fullTask, fullRisk, reviewTools),
    }))
  }

  return renumberSlices(next.slice(0, 4))
}

function renumberSlices(slices: ProblemSlice[]): ProblemSlice[] {
  return slices.map((slice, index) => ({
    ...slice,
    id: `slice-${String(index + 1).padStart(3, '0')}`,
  }))
}

function attachEffortRouting(slice: ProblemSlice, index: number, total: number): ProblemSlice {
  const input: EffortRoutingInput = {
    taskComplexity: calculateComplexity(slice, index, total),
    sliceRisk: slice.riskLevel,
    tokenBudget: 12000,
    suggestedProfile: slice.suggestedProfile,
    requiresDeepReview: slice.riskLevel === 'high' || slice.suggestedProfile === 'review',
    hasToolExecution: slice.expectedTools.some(tool => ['bash', 'git', 'file_edit'].includes(tool)),
    priority: slice.riskLevel === 'high' ? 9 : slice.suggestedProfile === 'plan' ? 8 : 5,
  }
  const decision = decideEffortRouting(input)

  return {
    ...slice,
    effortLevel: decision.effortLevel,
    reasoningPreference: decision.reasoningPreference,
    useDeepReviewPath: decision.useDeepReviewPath,
    updatedAt: Date.now(),
  }
}

function inferProfile(text: string): ProblemSliceProfile {
  if (matchesAny(text, ['分析', '规划', '计划', '设计', '架构', '方案', 'analyze', 'plan', 'design'])) {
    return 'plan'
  }

  if (matchesAny(text, ['编辑', '修改', '修复', '创建', '实现', '编写', '代码', '配置', 'edit', 'fix', 'create', 'implement'])) {
    return 'edit'
  }

  if (matchesAny(text, ['审查', '验证', '测试', '检查', '审核', 'review', 'verify', 'test'])) {
    return 'review'
  }

  return 'session'
}

function inferRiskLevel(text: string, fullTask: string): ProblemSliceRiskLevel {
  const combined = `${text}\n${fullTask}`

  if (matchesAny(combined, ['关键', '安全', '漏洞', '权限', '删除', '迁移', '生产', '高风险', 'critical', 'security', 'permission', 'delete', 'migration'])) {
    return 'high'
  }

  if (matchesAny(combined, ['重要', '重构', '数据库', '并发', '认证', '复杂', '性能', 'important', 'refactor', 'database', 'auth', 'performance'])) {
    return 'medium'
  }

  return 'low'
}

function inferExpectedTools(text: string, profile: ProblemSliceProfile): string[] {
  const tools = new Set<string>()

  if (matchesAny(text, ['编辑', '修改', '修复', '创建', '实现', '编写', '代码', '配置', 'file', 'edit', 'fix', 'create'])) {
    tools.add('file_edit')
  }

  if (matchesAny(text, ['执行', '运行', '测试', '脚本', '命令', 'bash', 'run', 'test'])) {
    tools.add('bash')
  }

  if (matchesAny(text, ['git', '提交', '分支', '仓库', 'commit', 'branch'])) {
    tools.add('git')
  }

  if (profile === 'plan') {
    tools.add('analysis')
  }

  if (profile === 'review') {
    tools.add('bash')
  }

  if (profile === 'edit' && tools.size === 0) {
    tools.add('file_edit')
  }

  if (tools.size === 0) {
    tools.add('analysis')
  }

  return [...tools]
}

function calculateComplexity(slice: ProblemSlice, index: number, total: number): number {
  const lengthScore = slice.intent.length > 80 ? 3 : slice.intent.length > 30 ? 2 : 1
  const riskScore = slice.riskLevel === 'high' ? 4 : slice.riskLevel === 'medium' ? 2 : 0
  const profileScore = slice.suggestedProfile === 'plan' ? 2 : slice.suggestedProfile === 'review' ? 2 : 1
  const orchestrationScore = total > 2 ? 1 : 0
  return Math.min(10, Math.max(1, lengthScore + riskScore + profileScore + orchestrationScore + (index === 0 ? 1 : 0)))
}

function estimateEffort(text: string, riskLevel: ProblemSliceRiskLevel, tools: string[]): number {
  const base = Math.max(15, Math.ceil(text.length / 8) * 5)
  const riskMultiplier = riskLevel === 'high' ? 2 : riskLevel === 'medium' ? 1.5 : 1
  return Math.round(base * riskMultiplier + tools.length * 5)
}

function highestRiskLevel(levels: ProblemSliceRiskLevel[]): ProblemSliceRiskLevel {
  if (levels.includes('high')) {
    return 'high'
  }

  if (levels.includes('medium')) {
    return 'medium'
  }

  return 'low'
}

function summarizeTitle(text: string, profile: ProblemSliceProfile): string {
  const summary = text.length > 36 ? `${text.slice(0, 36)}...` : text
  return summary.length > 0 ? summary : `${profile} slice`
}

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase()
  return keywords.some(keyword => lower.includes(keyword.toLowerCase()))
}
