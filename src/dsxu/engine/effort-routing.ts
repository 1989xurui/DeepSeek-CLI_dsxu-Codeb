import type {
  EffortLevel,
  EffortRoutingDecision,
  EffortRoutingInput,
  ReasoningPreference,
} from './types'

export type {
  EffortLevel,
  EffortRoutingDecision,
  EffortRoutingInput,
  ReasoningPreference,
} from './types'

type ValidationResult = {
  valid: boolean
  errors: string[]
}

const EFFORT_LEVELS: EffortLevel[] = ['low', 'medium', 'high']
const RISK_LEVELS = new Set(['low', 'medium', 'high'])
const PROFILES = new Set(['plan', 'edit', 'review', 'session'])

export function validateEffortRoutingInput(input: EffortRoutingInput): ValidationResult {
  const errors: string[] = []

  if (!Number.isFinite(input.taskComplexity) || input.taskComplexity < 1 || input.taskComplexity > 10) {
    errors.push('任务复杂度必须在1-10之间')
  }

  if (!RISK_LEVELS.has(input.sliceRisk)) {
    errors.push('风险等级必须是 low、medium 或 high')
  }

  if (!Number.isFinite(input.tokenBudget) || input.tokenBudget <= 0) {
    errors.push('token预算必须大于0')
  }

  if (!PROFILES.has(input.suggestedProfile)) {
    errors.push('建议剖面必须是 plan、edit、review 或 session')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function calculateEffortLevel(input: EffortRoutingInput): EffortLevel {
  let score = input.taskComplexity

  if (input.sliceRisk === 'medium') {
    score += 1
  } else if (input.sliceRisk === 'high') {
    score += 3
  }

  if (input.requiresDeepReview) {
    score += 2
  }

  if (input.hasToolExecution) {
    score += 1
  }

  if (input.priority !== undefined && input.priority >= 8) {
    score += 1
  }

  if (input.contextLength !== undefined && input.contextLength > 6000) {
    score += 1
  }

  if (score >= 8) {
    return 'high'
  }

  if (score >= 5) {
    return 'medium'
  }

  return 'low'
}

export function calculateReasoningPreference(input: EffortRoutingInput): ReasoningPreference {
  if (input.timeLimit !== undefined && input.timeLimit <= 3 && input.sliceRisk !== 'high') {
    return 'fast'
  }

  if (
    input.sliceRisk === 'high' ||
    input.requiresDeepReview ||
    input.suggestedProfile === 'plan' ||
    input.taskComplexity >= 8
  ) {
    return 'deep'
  }

  if (input.suggestedProfile === 'edit' || input.suggestedProfile === 'review' || (input.priority ?? 0) >= 7) {
    return 'balanced'
  }

  return input.taskComplexity <= 3 ? 'fast' : 'balanced'
}

export function shouldUseDeepReviewPath(input: EffortRoutingInput): boolean {
  return (
    input.requiresDeepReview ||
    input.sliceRisk === 'high' ||
    input.taskComplexity >= 8 ||
    (input.hasToolExecution && input.sliceRisk === 'medium' && (input.suggestedProfile === 'edit' || input.suggestedProfile === 'review'))
  )
}

export function calculateTokenAllocation(input: EffortRoutingInput): Pick<EffortRoutingDecision, 'reservedOutputTokens' | 'maxInputBudget'> {
  const effortLevel = calculateEffortLevel(input)
  const baseRatio = effortLevel === 'high' ? 0.34 : effortLevel === 'medium' ? 0.28 : 0.22
  const riskBonus = input.sliceRisk === 'high' ? 0.08 : input.sliceRisk === 'medium' ? 0.03 : 0
  const toolBonus = input.hasToolExecution ? 0.02 : 0
  const outputRatio = Math.min(0.48, baseRatio + riskBonus + toolBonus)
  const reservedOutputTokens = Math.max(1, Math.floor(input.tokenBudget * outputRatio))
  const maxInputBudget = Math.max(1, input.tokenBudget - reservedOutputTokens)

  return {
    reservedOutputTokens,
    maxInputBudget,
  }
}

export function decideEffortRouting(input: EffortRoutingInput): EffortRoutingDecision {
  const validation = validateEffortRoutingInput(input)
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '))
  }

  const effortLevel = calculateEffortLevel(input)
  const reasoningPreference = calculateReasoningPreference(input)
  const useDeepReviewPath = shouldUseDeepReviewPath(input)
  const tokenAllocation = calculateTokenAllocation(input)

  return {
    effortLevel,
    ...tokenAllocation,
    reasoningPreference,
    useDeepReviewPath,
    enableDetailedLogging: effortLevel === 'high' || input.sliceRisk === 'high' || useDeepReviewPath,
    enableExtraSafetyChecks: input.hasToolExecution || input.sliceRisk !== 'low' || useDeepReviewPath,
    suggestedThinkingTime: calculateSuggestedThinkingTime(input, effortLevel, reasoningPreference),
    decidedAt: Date.now(),
  }
}

function calculateSuggestedThinkingTime(
  input: EffortRoutingInput,
  effortLevel: EffortLevel,
  reasoningPreference: ReasoningPreference,
): number {
  const base = effortLevel === 'high' ? 90 : effortLevel === 'medium' ? 45 : 20
  const reasoningBonus = reasoningPreference === 'deep' ? 30 : reasoningPreference === 'balanced' ? 10 : 0
  const toolBonus = input.hasToolExecution ? 10 : 0
  return base + reasoningBonus + toolBonus
}

export function compareEffortLevel(left: EffortLevel, right: EffortLevel): number {
  return EFFORT_LEVELS.indexOf(left) - EFFORT_LEVELS.indexOf(right)
}
