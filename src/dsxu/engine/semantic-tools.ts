import { createHash } from 'crypto'

export type SemanticVerificationKind =
  | 'native_test'
  | 'native_build'
  | 'dev_server'
  | 'repo_probe'
  | 'unknown'

export type SemanticVerificationEvent = {
  id: string
  tool: 'Bash' | 'PowerShell' | 'RunNativeTest'
  command: string
  cwd?: string
  exitCode?: number | null
  output?: string
  sourceChangedBeforeRun?: boolean
}

export type RunNativeTestDecision = {
  semanticTool: 'RunNativeTest'
  action: 'run' | 'block_repeated_verification' | 'collect_existing_pass'
  status: 'RUN_ALLOWED' | 'BLOCKED_NEEDS_STRATEGY_CHANGE' | 'PASS_ALREADY_RECORDED'
  verificationKind: SemanticVerificationKind
  commandKey: string
  intentKey: string
  reason: string
  next: 'execute_native_test' | 'change_source_or_strategy' | 'collect_evidence'
  priorAttemptCount: number
  latestExitCode?: number | null
}

export type CollectEvidenceResult = {
  semanticTool: 'CollectEvidence'
  status: 'PASS' | 'FAIL' | 'PARTIAL'
  rawCommandCount: number
  uniqueCommandCount: number
  repeatedCommandCount: number
  evidenceDigest: string
  latestVerification?: {
    id: string
    command: string
    kind: SemanticVerificationKind
    exitCode?: number | null
    outputSignal: string
  }
  failedCommands: Array<{
    id: string
    command: string
    kind: SemanticVerificationKind
    exitCode?: number | null
    outputSignal: string
  }>
  warnings: string[]
}

export type VerificationFailureKind =
  | 'missing_export'
  | 'missing_module_or_file'
  | 'assertion_failure'
  | 'typescript_error'
  | 'command_unavailable'
  | 'runtime_exception'
  | 'unknown_failure'

export type VerificationFailureOracle = {
  kind: VerificationFailureKind
  confidence: 'high' | 'medium' | 'low'
  summary: string
  targetFiles: string[]
  symbols: string[]
  nextAction:
    | 'read_named_source_and_test'
    | 'locate_missing_module_or_file'
    | 'read_assertion_and_implementation'
    | 'read_type_error_location'
    | 'fix_command_or_environment'
    | 'inspect_first_failure_location'
    | 'report_partial_or_blocked'
}

export function normalizeSemanticCommand(command: string): string {
  return normalizeVerificationCommandForExecution(command).toLowerCase()
}

export function normalizeVerificationCommandForExecution(command: string): string {
  return command
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeSemanticCwd(cwd: string | undefined): string {
  return (cwd ?? '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .toLowerCase()
}

export function classifyVerificationCommand(command: string): SemanticVerificationKind {
  const normalized = normalizeSemanticCommand(command)
  if (
    /\b(bun|npm|pnpm|yarn)\s+(?:run\s+)?test\b/.test(normalized) ||
    /\bpytest\b/.test(normalized) ||
    /\bgo\s+test\b/.test(normalized) ||
    /\bcargo\s+test\b/.test(normalized)
  ) {
    return 'native_test'
  }
  if (
    /\b(bun|npm|pnpm|yarn)\s+run\s+build\b/.test(normalized) ||
    /\btsc\s+-b\b/.test(normalized) ||
    /\bvite\s+build\b/.test(normalized)
  ) {
    return 'native_build'
  }
  if (
    /\b(npm|pnpm|yarn|bun)\s+run\s+dev\b/.test(normalized) ||
    /\bvite\b[\s\S]*\b--host\b/.test(normalized) ||
    /\bcurl\b[\s\S]*\b(?:localhost|127\.0\.0\.1)\b/.test(normalized)
  ) {
    return 'dev_server'
  }
  if (
    /\b(test-path|get-childitem|select-string|ls|dir|findstr|rg)\b/.test(normalized)
  ) {
    return 'repo_probe'
  }
  return 'unknown'
}

export function getVerificationCommandKey(
  event: Pick<SemanticVerificationEvent, 'command' | 'cwd'>,
): string {
  const kind = classifyVerificationCommand(event.command)
  return `${kind}:${normalizeSemanticCwd(event.cwd)}:${normalizeSemanticCommand(event.command)}`
}

export function stripNoisyVerificationShellSyntax(command: string): string {
  return normalizeVerificationCommandForExecution(command)
    .replace(/\s+(?:1>|2>|&>)\S+/g, '')
    .replace(/\s+2>&1\b/g, '')
    .replace(/\s+\|\s*(?:cat|out-string)\b/g, '')
    .replace(/\s+--(?:timeout|test-timeout)\s+\S+/g, '')
    .replace(/\s+--(?:reporter|output|format)\s+\S+/g, '')
    .replace(/\s+--(?:color|no-color|runinband|watch=false)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getVerificationIntentKey(
  event: Pick<SemanticVerificationEvent, 'command' | 'cwd'>,
): string {
  const kind = classifyVerificationCommand(event.command)
  return `${kind}:${normalizeSemanticCwd(event.cwd)}:${normalizeSemanticCommand(stripNoisyVerificationShellSyntax(event.command))}`
}

export function buildRunNativeTestDecision(input: {
  command: string
  cwd?: string
  previousAttempts?: readonly SemanticVerificationEvent[]
  sourceChangedSinceLastAttempt?: boolean
  strategyChangedSinceLastAttempt?: boolean
}): RunNativeTestDecision {
  const current = {
    id: 'current',
    tool: 'RunNativeTest' as const,
    command: input.command,
    cwd: input.cwd,
  }
  const commandKey = getVerificationCommandKey(current)
  const intentKey = getVerificationIntentKey(current)
  const sameAttempts = (input.previousAttempts ?? []).filter(
    event => getVerificationIntentKey(event) === intentKey,
  )
  const latestSameAttempt = sameAttempts.at(-1)
  const verificationKind = classifyVerificationCommand(input.command)

  if (!latestSameAttempt) {
    return {
      semanticTool: 'RunNativeTest',
      action: 'run',
      status: 'RUN_ALLOWED',
      verificationKind,
      commandKey,
      intentKey,
      reason: 'first_semantic_native_verification_for_target',
      next: 'execute_native_test',
      priorAttemptCount: 0,
    }
  }

  if (input.sourceChangedSinceLastAttempt === true) {
    return {
      semanticTool: 'RunNativeTest',
      action: 'run',
      status: 'RUN_ALLOWED',
      verificationKind,
      commandKey,
      intentKey,
      reason: latestSameAttempt.exitCode === 0
        ? 'source_changed_after_passed_native_verification'
        : 'source_changed_after_failed_native_verification',
      next: 'execute_native_test',
      priorAttemptCount: sameAttempts.length,
      latestExitCode: latestSameAttempt.exitCode,
    }
  }

  if (latestSameAttempt.exitCode === 0) {
    return {
      semanticTool: 'RunNativeTest',
      action: 'collect_existing_pass',
      status: 'PASS_ALREADY_RECORDED',
      verificationKind,
      commandKey,
      intentKey,
      reason: 'same_native_verification_already_passed',
      next: 'collect_evidence',
      priorAttemptCount: sameAttempts.length,
      latestExitCode: latestSameAttempt.exitCode,
    }
  }

  if (
    input.strategyChangedSinceLastAttempt === true
  ) {
    return {
      semanticTool: 'RunNativeTest',
      action: 'run',
      status: 'RUN_ALLOWED',
      verificationKind,
      commandKey,
      intentKey,
      reason: 'strategy_changed_after_failed_native_verification',
      next: 'execute_native_test',
      priorAttemptCount: sameAttempts.length,
      latestExitCode: latestSameAttempt.exitCode,
    }
  }

  return {
    semanticTool: 'RunNativeTest',
    action: 'block_repeated_verification',
    status: 'BLOCKED_NEEDS_STRATEGY_CHANGE',
    verificationKind,
    commandKey,
    intentKey,
    reason: 'same_failed_native_verification_without_source_or_strategy_change',
    next: 'change_source_or_strategy',
    priorAttemptCount: sameAttempts.length,
    latestExitCode: latestSameAttempt.exitCode,
  }
}

function outputSignal(output: string | undefined): string {
  if (!output) return ''
  const lines = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  const signalLines = lines.filter(line =>
    /\b(pass|fail|failed|error|exit code|timeout|listening|ready)\b/i.test(line),
  )
  const selected = (signalLines.length > 0 ? signalLines : lines.slice(-4)).slice(-6)
  return selected.join('\n').slice(0, 900)
}

function stableDigest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 16)
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function normalizeFailurePath(value: string | undefined): string | null {
  if (!value) return null
  const cleaned = value
    .trim()
    .replace(/^file:\/+/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\/g, '/')
  return cleaned || null
}

function extractFirstTestPath(output: string): string | null {
  const match = output.match(/(?:^|\n)\s*([A-Za-z]:?[\\/][^\n:]+(?:test|spec)\.[cm]?[tj]sx?|(?:test|tests|__tests__)[\\/][^\n:]+(?:test|spec)\.[cm]?[tj]sx?)\s*:/i)
  if (match?.[1]) return normalizeFailurePath(match[1])
  const quotedMatch = output.match(/['"`]([A-Za-z]:?[\\/][^'"`\n]*(?:test|spec)\.[cm]?[tj]sx?|(?:test|tests|__tests__)[\\/][^'"`\n]*(?:test|spec)\.[cm]?[tj]sx?)['"`]/i)
  return normalizeFailurePath(quotedMatch?.[1])
}

function extractFirstSourcePath(output: string): string | null {
  const match = output.match(/(?:^|\n|at\s+)([A-Za-z]:?[\\/][^\n:()]+?\.[cm]?[tj]sx?|(?:src|lib|app)[\\/][^\n:()]+?\.[cm]?[tj]sx?)(?::\d+)?/i)
  return normalizeFailurePath(match?.[1])
}

function compactFailureSummary(value: string): string {
  const line = value
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(Boolean)
  return (line ?? value.trim()).replace(/\s+/g, ' ').slice(0, 240)
}

export function analyzeVerificationFailure(output: string): VerificationFailureOracle {
  const text = output.replace(/\r\n/g, '\n')
  const testPath = extractFirstTestPath(text)
  const sourcePath = extractFirstSourcePath(text)

  const missingExport = text.match(/Export named ['"`]([^'"`]+)['"`] not found in module ['"`]([^'"`]+)['"`]/i)
  if (missingExport) {
    return {
      kind: 'missing_export',
      confidence: 'high',
      summary: `missing export ${missingExport[1]} from ${normalizeFailurePath(missingExport[2]) ?? 'module'}`,
      targetFiles: uniqueNonEmpty([
        normalizeFailurePath(missingExport[2]) ?? '',
        testPath ?? '',
      ]),
      symbols: uniqueNonEmpty([missingExport[1] ?? '']),
      nextAction: 'read_named_source_and_test',
    }
  }

  const missingModule = text.match(/(?:Cannot find module|Module not found|ENOENT|no such file or directory)[^\n'"`]*['"`]([^'"`\n]+)['"`]/i)
  if (missingModule || /file does not exist|path does not exist|cannot open/i.test(text)) {
    return {
      kind: 'missing_module_or_file',
      confidence: missingModule ? 'high' : 'medium',
      summary: missingModule
        ? `missing module or file ${normalizeFailurePath(missingModule[1]) ?? 'unknown'}`
        : compactFailureSummary(text),
      targetFiles: uniqueNonEmpty([
        normalizeFailurePath(missingModule?.[1]) ?? '',
        testPath ?? '',
        sourcePath ?? '',
      ]),
      symbols: [],
      nextAction: 'locate_missing_module_or_file',
    }
  }

  const tsError = text.match(/\b(TS\d{3,5})\b[^\n]*/i)
  if (tsError) {
    return {
      kind: 'typescript_error',
      confidence: 'high',
      summary: compactFailureSummary(tsError[0]),
      targetFiles: uniqueNonEmpty([sourcePath ?? '', testPath ?? '']),
      symbols: uniqueNonEmpty([tsError[1] ?? '']),
      nextAction: 'read_type_error_location',
    }
  }

  if (/expected\b[\s\S]{0,500}\breceived\b|\bexpect\(|AssertionError|toBe\(|toEqual\(/i.test(text)) {
    return {
      kind: 'assertion_failure',
      confidence: 'medium',
      summary: compactFailureSummary(text.match(/(?:Expected|Received|AssertionError|expect\()[^\n]*/i)?.[0] ?? text),
      targetFiles: uniqueNonEmpty([testPath ?? '', sourcePath ?? '']),
      symbols: [],
      nextAction: 'read_assertion_and_implementation',
    }
  }

  if (/command not found|not recognized as|ENOENT.*spawn|executable file not found/i.test(text)) {
    return {
      kind: 'command_unavailable',
      confidence: 'high',
      summary: compactFailureSummary(text),
      targetFiles: [],
      symbols: [],
      nextAction: 'fix_command_or_environment',
    }
  }

  if (/\b(?:SyntaxError|TypeError|ReferenceError|RangeError)\b/i.test(text)) {
    return {
      kind: 'runtime_exception',
      confidence: 'medium',
      summary: compactFailureSummary(text.match(/\b(?:SyntaxError|TypeError|ReferenceError|RangeError)\b[^\n]*/i)?.[0] ?? text),
      targetFiles: uniqueNonEmpty([testPath ?? '', sourcePath ?? '']),
      symbols: [],
      nextAction: 'inspect_first_failure_location',
    }
  }

  return {
    kind: 'unknown_failure',
    confidence: 'low',
    summary: compactFailureSummary(text) || 'native verification failed without a recognized failure shape',
    targetFiles: uniqueNonEmpty([testPath ?? '', sourcePath ?? '']),
    symbols: [],
    nextAction: testPath || sourcePath ? 'inspect_first_failure_location' : 'report_partial_or_blocked',
  }
}

function compactCommand(event: SemanticVerificationEvent) {
  return {
    id: event.id,
    command: event.command,
    kind: classifyVerificationCommand(event.command),
    exitCode: event.exitCode,
    outputSignal: outputSignal(event.output),
  }
}

export function collectEvidenceFromVerificationEvents(
  events: readonly SemanticVerificationEvent[],
): CollectEvidenceResult {
  const commandKeys = events.map(getVerificationIntentKey)
  const uniqueCommandCount = new Set(commandKeys).size
  const repeatedCommandCount = Math.max(0, events.length - uniqueCommandCount)
  const latest = events.at(-1)
  const failedCommands = events
    .filter(event => typeof event.exitCode === 'number' && event.exitCode !== 0)
    .map(compactCommand)
  const latestVerification = latest ? compactCommand(latest) : undefined

  const status =
    latest?.exitCode === 0
      ? 'PASS'
      : failedCommands.length > 0
        ? 'FAIL'
        : 'PARTIAL'
  const warnings: string[] = []
  if (repeatedCommandCount > 0) {
    warnings.push('raw verification had repeated commands; prefer RunNativeTest before shell fallback')
  }
  if (events.some(event => classifyVerificationCommand(event.command) === 'repo_probe')) {
    warnings.push('repo probe command was mixed into verification evidence')
  }

  const digestInput = {
    status,
    commands: events.map(event => ({
      key: getVerificationCommandKey(event),
      exitCode: event.exitCode,
      signal: outputSignal(event.output),
    })),
  }

  return {
    semanticTool: 'CollectEvidence',
    status,
    rawCommandCount: events.length,
    uniqueCommandCount,
    repeatedCommandCount,
    evidenceDigest: stableDigest(digestInput),
    latestVerification,
    failedCommands,
    warnings,
  }
}
