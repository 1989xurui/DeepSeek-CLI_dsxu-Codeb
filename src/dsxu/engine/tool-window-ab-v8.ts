import {
  evaluateDSXUV8ToolWindowCount,
  getDSXUV8ToolWindowPolicy,
  type DSXUV8ToolWindowProfile,
} from './tool-window-policy-v8'

export type DSXUV8ToolWindowABResultLevel =
  | 'mock'
  | 'internal_replay'
  | 'live_provider'
  | 'real_benchmark'

export type DSXUV8ToolWindowABSample = {
  profile: DSXUV8ToolWindowProfile
  window: number
  taskId: string
  expectedToolCount?: number
  usedToolCount?: number
  pass: boolean
  verified: boolean
  falsePass?: boolean
  invalidToolCall?: boolean
  toolMisuse?: boolean
  costUsd: number
  latencyMs: number
  contextGrowthTokens: number
}

export type DSXUV8ToolWindowABProfileWindowResult = {
  profile: DSXUV8ToolWindowProfile
  window: number
  sampleCount: number
  passAt1: number
  verifiedCompletionRate: number
  costToVerifiedCompletion: number
  medianLatencyMs: number
  toolMisuseRate: number
  invalidToolCallRate: number
  toolStarvationRate: number
  falsePassRate: number
  contextGrowthTokens: number
  policyMin: number
  policyDefault: number
  policyMax: number
  guards: readonly string[]
}

export type DSXUV8ToolWindowABReport = {
  schemaVersion: 'dsxu.tool-window-ab.v8'
  owner: 'Evidence / Tool Gate'
  suite: string
  resultLevel: DSXUV8ToolWindowABResultLevel
  publicClaimAllowed: boolean
  generatedAt: string
  profiles: readonly DSXUV8ToolWindowProfile[]
  windows: readonly number[]
  results: readonly DSXUV8ToolWindowABProfileWindowResult[]
  selection: readonly {
    profile: DSXUV8ToolWindowProfile
    selectedWindow: number
    reason: string
  }[]
  blockedClaims: readonly string[]
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Number((numerator / denominator).toFixed(4))
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
    : sorted[mid]
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6))
}

export function createDSXUV8MockToolWindowABSamples(input: {
  profiles: readonly DSXUV8ToolWindowProfile[]
  windows: readonly number[]
  suite: string
}): DSXUV8ToolWindowABSample[] {
  const samples: DSXUV8ToolWindowABSample[] = []
  for (const profile of input.profiles) {
    const policy = getDSXUV8ToolWindowPolicy(profile)
    for (const window of input.windows) {
      const starvation = window < policy.minVisibleTools
      const tooWide = window > policy.maxVisibleTools
      const distanceFromDefault = Math.abs(window - policy.defaultVisibleTools)
      const pass = !starvation && !tooWide && distanceFromDefault <= 8
      const verified = pass && window >= policy.minVisibleTools
      samples.push({
        profile,
        window,
        taskId: `${input.suite}-${profile}-${window}`,
        expectedToolCount: policy.defaultVisibleTools,
        usedToolCount: Math.min(window, policy.defaultVisibleTools),
        pass,
        verified,
        falsePass: pass && !verified,
        invalidToolCall: tooWide && window - policy.maxVisibleTools > 4,
        toolMisuse: tooWide,
        costUsd: Number((0.002 + window * 0.00017 + distanceFromDefault * 0.00004).toFixed(6)),
        latencyMs: 900 + window * 38 + distanceFromDefault * 22,
        contextGrowthTokens: 700 + window * 45,
      })
    }
  }
  return samples
}

export function buildDSXUV8ToolWindowABReport(input: {
  suite: string
  resultLevel: DSXUV8ToolWindowABResultLevel
  samples: readonly DSXUV8ToolWindowABSample[]
  generatedAt?: string
}): DSXUV8ToolWindowABReport {
  const profiles = [...new Set(input.samples.map(sample => sample.profile))]
  const windows = [...new Set(input.samples.map(sample => sample.window))].sort((a, b) => a - b)
  const results: DSXUV8ToolWindowABProfileWindowResult[] = []

  for (const profile of profiles) {
    const policy = getDSXUV8ToolWindowPolicy(profile)
    for (const window of windows) {
      const group = input.samples.filter(sample => sample.profile === profile && sample.window === window)
      if (group.length === 0) continue
      const countDecision = evaluateDSXUV8ToolWindowCount({
        visibleToolCount: window,
        policy,
        actualToolPoolCount: Math.max(policy.maxVisibleTools, window),
      })
      const verifiedCount = group.filter(sample => sample.verified).length
      const verifiedCosts = group.filter(sample => sample.verified).map(sample => sample.costUsd)
      results.push({
        profile,
        window,
        sampleCount: group.length,
        passAt1: ratio(group.filter(sample => sample.pass).length, group.length),
        verifiedCompletionRate: ratio(verifiedCount, group.length),
        costToVerifiedCompletion: verifiedCount > 0 ? average(verifiedCosts) : 0,
        medianLatencyMs: median(group.map(sample => sample.latencyMs)),
        toolMisuseRate: ratio(group.filter(sample => sample.toolMisuse).length, group.length),
        invalidToolCallRate: ratio(group.filter(sample => sample.invalidToolCall).length, group.length),
        toolStarvationRate: ratio(
          group.filter(sample =>
            window < policy.minVisibleTools ||
            (sample.expectedToolCount !== undefined && window < sample.expectedToolCount),
          ).length,
          group.length,
        ),
        falsePassRate: ratio(group.filter(sample => sample.falsePass).length, group.length),
        contextGrowthTokens: Math.round(average(group.map(sample => sample.contextGrowthTokens))),
        policyMin: policy.minVisibleTools,
        policyDefault: policy.defaultVisibleTools,
        policyMax: policy.maxVisibleTools,
        guards: countDecision.guards,
      })
    }
  }

  const selection = profiles.map(profile => {
    const candidates = results
      .filter(result =>
        result.profile === profile &&
        result.falsePassRate === 0 &&
        result.toolStarvationRate <= 0.05 &&
        result.guards.length === 0,
      )
      .sort((left, right) => {
        if (right.passAt1 !== left.passAt1) return right.passAt1 - left.passAt1
        if (right.verifiedCompletionRate !== left.verifiedCompletionRate) {
          return right.verifiedCompletionRate - left.verifiedCompletionRate
        }
        if (left.costToVerifiedCompletion !== right.costToVerifiedCompletion) {
          return left.costToVerifiedCompletion - right.costToVerifiedCompletion
        }
        return left.medianLatencyMs - right.medianLatencyMs
      })
    const selected = candidates[0]
    return {
      profile,
      selectedWindow: selected?.window ?? getDSXUV8ToolWindowPolicy(profile).defaultVisibleTools,
      reason: selected
        ? `selected by pass@1=${selected.passAt1}, verified=${selected.verifiedCompletionRate}, cost=${selected.costToVerifiedCompletion}`
        : 'fallback to policy default because no candidate passed V8 gates',
    }
  })

  const publicClaimAllowed = input.resultLevel === 'real_benchmark'
  return {
    schemaVersion: 'dsxu.tool-window-ab.v8',
    owner: 'Evidence / Tool Gate',
    suite: input.suite,
    resultLevel: input.resultLevel,
    publicClaimAllowed,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    profiles,
    windows,
    results,
    selection,
    blockedClaims: publicClaimAllowed
      ? []
      : [
          `${input.resultLevel} tool-window AB output is internal evidence only`,
          'Do not publish pass@1, verified completion, or selected windows as public benchmark claims without real_benchmark paired raw evidence',
        ],
  }
}
