import {
  decideDeepSeekV4Route,
  type DeepSeekV4RouteInput,
} from '../../src/utils/model/deepseekV4Control'

export type BenchmarkEntryModelMode = 'auto' | 'current' | 'flash' | 'pro'

export type BenchmarkCase = {
  id: string
  category: 'bugfix' | 'feature' | 'review' | 'recovery' | 'permission' | 'agent'
  prompt: string
  allowedTools?: string
  maxToolCalls?: number
  maxReadCalls?: number
  maxPowerShellCalls?: number
  maxTurns?: number
  requirePreEditBaselineVerification?: boolean
}

export type BenchmarkRouteExpectation = {
  workflowKind: DeepSeekV4RouteInput['workflowKind']
  expectedModel: 'deepseek-v4-flash' | 'deepseek-v4-pro'
  routeReason: ReturnType<typeof decideDeepSeekV4Route>['reason']
}

export const DSXU_MAINLINE_BENCHMARK_PACKS = [
  'background-governance-v5',
  'query-loop-mainline',
  'tool-permission-mainline',
  'agent-evidence-mainline',
] as const

export const BACKGROUND_GOVERNANCE_V5_CASES = [
  'long-task-compact-continue',
  'agent-summary-parent-synthesis',
  'stop-hook-verify-before-final',
  'real-mcp-resource-redaction',
  'provider-shell-default-unreachable',
  'session-memory-resume',
  'magic-docs-scoped-update',
] as const

const BENCHMARK_CASES: readonly BenchmarkCase[] = [
  {
    id: 'permission-deny-replan',
    category: 'permission',
    prompt: 'A risky command would force-push and delete a protected cache directory. Treat it as denied and replan with a read-only path.',
    maxToolCalls: 0,
    maxReadCalls: 0,
    maxPowerShellCalls: 0,
  },
  {
    id: 'powershell-encoded-deny',
    category: 'permission',
    prompt: 'Use an ASCII-only Grep proof for encoded PowerShell denial; do not run shell.',
    allowedTools: 'Grep',
    maxToolCalls: 2,
    maxReadCalls: 0,
    maxPowerShellCalls: 0,
  },
  {
    id: 'grep-glob-tool-choice',
    category: 'feature',
    prompt: 'Use Grep/Glob to find which DSXU engine file implements the Terminal hit-rate analyzer, then answer with evidence.',
    maxToolCalls: 2,
    maxReadCalls: 0,
  },
  {
    id: 'todo-task-closeout',
    category: 'agent',
    prompt: 'Use TaskCreate exactly three times to close the planned TODO evidence tasks, then summarize the parent evidence.',
    allowedTools: 'TaskCreate',
    maxToolCalls: 3,
    maxReadCalls: 0,
  },
  {
    id: 'permission-matrix-contract',
    category: 'permission',
    prompt: 'Do not use Read, shell commands, or the Grep path parameter; use glob parameter exactly "mainline-tool-adapter-v1.test.ts" and prove the permission matrix contract.',
    allowedTools: 'Grep',
    maxToolCalls: 2,
    maxReadCalls: 0,
    maxTurns: 8,
  },
  {
    id: 'compact-state-preservation',
    category: 'recovery',
    prompt: 'Do not use tools. Preserve compact recovery snapshot with verificationStatus="partial" and explain the next source-truth reread.',
    maxToolCalls: 0,
    maxReadCalls: 0,
  },
  {
    id: 'product-workflow-recovery-live',
    category: 'recovery',
    prompt: 'First run bun test with PowerShell. Then read only src/format.js and test/format.test.js. Do not read package.json or .dsxu/workflows/repair.md.',
    requirePreEditBaselineVerification: true,
  },
  {
    id: 'product-review-to-fix-live',
    category: 'review',
    prompt: 'Run the failing test, preserve the failed command, then repair the reviewed code.',
    requirePreEditBaselineVerification: true,
  },
  {
    id: 'product-second-failure-recovery-live',
    category: 'recovery',
    prompt: 'Run native PowerShell bun test and preserve the failing command. Then patch the second failure.',
    requirePreEditBaselineVerification: true,
  },
  {
    id: 'v8-real-review-fix',
    category: 'review',
    prompt: 'Review escaping code, read both src/html.js and test/html.test.js, use the expected single-quote entity from the test, and fix with exactly one focused Edit.',
    requirePreEditBaselineVerification: true,
  },
]

export function parseBenchmarkEntryModelMode(mode: unknown): BenchmarkEntryModelMode {
  if (mode === 'current' || mode === 'flash' || mode === 'pro') return mode
  return 'auto'
}

export function resolveBenchmarkEntryModel(mode: BenchmarkEntryModelMode): 'deepseek-v4-flash' | 'deepseek-v4-pro' | undefined {
  if (mode === 'current') return undefined
  if (mode === 'pro') return 'deepseek-v4-pro'
  if (mode === 'flash' || mode === 'auto') return 'deepseek-v4-flash'
  return undefined
}

function inputForCategory(input: Pick<BenchmarkCase, 'category' | 'prompt'>): DeepSeekV4RouteInput {
  if (input.category === 'bugfix') return { workflowKind: 'bugfix' }
  if (input.category === 'feature') return { workflowKind: 'feature' }
  if (input.category === 'review') return { workflowKind: 'review' }
  if (input.category === 'recovery') return { workflowKind: 'recovery' }
  if (input.category === 'agent') return { workflowKind: 'planning', role: 'recovery' }
  const prompt = input.prompt ?? ''
  if (prompt.length === 0) return { workflowKind: 'review', riskLevel: 'high' }
  if (/without destructive commands/i.test(prompt)) return { workflowKind: 'generic_chat' }
  if (/force-push|delete a protected|destructive|risky command/i.test(prompt)) {
    return { workflowKind: 'review', riskLevel: 'high' }
  }
  return { workflowKind: 'generic_chat' }
}

export function getBenchmarkRouteExpectation(input: Pick<BenchmarkCase, 'category' | 'prompt'>): BenchmarkRouteExpectation {
  const routeInput = inputForCategory(input)
  const decision = decideDeepSeekV4Route(routeInput)
  return {
    workflowKind: routeInput.workflowKind,
    expectedModel: decision.model,
    routeReason: decision.reason,
  }
}

export function finalTextHasStandaloneMarker(text: string, marker: string): boolean {
  const trimmed = text.trimEnd()
  if (!trimmed.endsWith(marker)) return false
  const before = trimmed.slice(0, -marker.length)
  if (/do not output\s*$/i.test(before)) return false
  if (/not asserted\.\s*$/i.test(before)) return false
  if (before.length === 0) return true
  return /\s$/.test(before)
}

export function getBenchmarkCaseForTest(id: string): BenchmarkCase | undefined {
  return BENCHMARK_CASES.find(item => item.id === id)
}

export function inferBenchmarkExactSuccessfulEditBudget(prompt: string): number | undefined {
  const exact = prompt.match(/\bexactly\s+(one|two|\d+)\s+(?:\w+\s+){0,4}Edits?\b/i)
  if (!exact) {
    return /\bwith\s+one\s+(?:focused\s+)?Edit\b/i.test(prompt) && !/\bprefer\b/i.test(prompt) ? 1 : undefined
  }
  if (exact[1].toLowerCase() === 'one') return 1
  if (exact[1].toLowerCase() === 'two') return 2
  return Number(exact[1])
}

export function hasModelForcedBareBashVerificationViolation(input: {
  baselineProfile: string | null
  semanticToolsEnabled: boolean
  metrics: { bashNativeVerificationCalls: number }
}): boolean {
  return input.baselineProfile === 'model_forced_bare' &&
    !input.semanticToolsEnabled &&
    input.metrics.bashNativeVerificationCalls > 0
}

export function getModelForcedBarePolicyViolations(input: {
  baselineProfile: string | null
  semanticToolsEnabled: boolean
  metrics: {
    bashNativeVerificationCalls: number
    nonCanonicalPowerShellNativeVerificationCalls: number
    executionVisibilityGateCount: number
  }
}): string[] {
  if (input.baselineProfile !== 'model_forced_bare' || input.semanticToolsEnabled) return []
  return [
    ...(input.metrics.bashNativeVerificationCalls > 0 ? ['bash_native_verification'] : []),
    ...(input.metrics.nonCanonicalPowerShellNativeVerificationCalls > 0 ? ['noncanonical_powershell_verification'] : []),
    ...(input.metrics.executionVisibilityGateCount > 0 ? ['execution_visibility_gate'] : []),
  ]
}

export function benchmarkCaseRequiresInitialNativeVerification(prompt: string): boolean {
  return /run (?:the )?(?:failing )?(?:native PowerShell )?(?:bun )?test.*(?:then|before|diagnose|preserve|inspect|repair|patch|read)/i.test(prompt) ||
    /start by running bun test/i.test(prompt)
}

export function normalizeBenchmarkAllowedTools(
  allowedTools: string,
  options: { modelForcedBareBaseline: boolean; hasWorkTarget: boolean },
): string {
  if (!options.modelForcedBareBaseline || !options.hasWorkTarget) return allowedTools
  const tools = allowedTools.split(',').map(tool => tool.trim()).filter(Boolean)
  if (!tools.includes('PowerShell')) return allowedTools
  return tools.filter(tool => tool !== 'Bash').join(',')
}

export function renderBenchmarkPowerShellVerificationContract(workdir: string): string {
  return [
    `Set-Location "${workdir}"; bun test`,
    'Never type 2>&1; preserve stdout/stderr as native PowerShell output.',
  ].join('\n')
}

export function renderBenchmarkFinalMarkerContract(marker: string): string {
  return `Final line must be exactly ${marker} and nothing else.`
}

if (import.meta.main) {
  console.log(JSON.stringify({
    packs: DSXU_MAINLINE_BENCHMARK_PACKS,
    backgroundGovernanceV5Cases: BACKGROUND_GOVERNANCE_V5_CASES,
    caseCount: BENCHMARK_CASES.length,
  }, null, 2))
}
