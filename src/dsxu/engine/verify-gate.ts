import type { QueryEvent, QueryResult, VerifySummary } from './types'
import { createCheckRuleResult } from './checks-as-rules'
import { spawn } from 'node:child_process'

type VerificationCommand = string | readonly string[]

interface VerificationEvidence {
  source: 'event' | 'command'
  label: string
  passed: boolean
  outputPreview: string
  exitCode?: number | null
}

export interface VerifyGateConfig {
  /** Enable the verification gate. */
  enabled: boolean
  /** Run verification after file edit tool results. */
  triggerOnFileEdit: boolean
  /** Run verification after shell tool results. */
  triggerOnBash: boolean
  /** Minimum passing verification score, from 0 to 100. */
  minScore: number
  /** Behavior when verification does not pass. */
  onFailure: 'warn' | 'block' | 'continue'
  /** Explicit native verification commands to run after a mutation. */
  verificationCommands?: VerificationCommand[]
  /** Working directory for explicit verification commands. */
  cwd?: string
  /** Per-command timeout in milliseconds. */
  commandTimeoutMs?: number
}

const DEFAULT_CONFIG: VerifyGateConfig = {
  enabled: true,
  triggerOnFileEdit: true,
  triggerOnBash: false,
  minScore: 70,
  onFailure: 'block',
  verificationCommands: [],
  commandTimeoutMs: 60_000,
}

function shouldRunVerification(
  events: QueryEvent[],
  config: VerifyGateConfig,
): boolean {
  if (!config.enabled) return false

  return events.some(event => {
    if (event.type !== 'tool_result' && event.type !== 'tool_dispatch_completed') {
      return false
    }

    const toolName = event.toolName?.toLowerCase() || ''
    return (
      (config.triggerOnFileEdit && isMutationTool(toolName)) ||
      (config.triggerOnBash && isShellTool(toolName))
    )
  })
}

function isMutationTool(toolName: string): boolean {
  return (
    toolName.includes('fileedit') ||
    toolName.includes('filewrite') ||
    toolName === 'edit' ||
    toolName === 'write'
  )
}

function isShellTool(toolName: string): boolean {
  return (
    toolName.includes('bash') ||
    toolName.includes('powershell') ||
    toolName.includes('runnativetest') ||
    toolName.includes('native-test')
  )
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map(item => extractText(item)).filter(Boolean).join('\n')
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.content === 'string') return record.content
    return JSON.stringify(record)
  }
  return ''
}

function preview(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 400 ? `${compact.slice(0, 400)}...` : compact
}

function extractFileEdits(events: QueryEvent[]): Array<{
  filePath: string
  toolName: string
  timestamp: number
  eventIndex: number
}> {
  const edits: Array<{
    filePath: string
    toolName: string
    timestamp: number
    eventIndex: number
  }> = []

  for (const [eventIndex, event] of events.entries()) {
    const toolName = event.toolName?.toLowerCase() || ''
    if (
      (event.type === 'tool_result' || event.type === 'tool_dispatch_completed') &&
      isMutationTool(toolName)
    ) {
      const result = (event as any).result ?? {}
      edits.push({
        filePath: String(result.filePath ?? result.path ?? result.meta?.filePath ?? 'unknown'),
        toolName: event.toolName ?? 'unknown',
        timestamp: event.timestamp ?? Date.now(),
        eventIndex,
      })
    }
  }

  return edits
}

function isVerificationCommandText(text: string): boolean {
  const lower = text.toLowerCase()
  return /\b(bun|npm|pnpm|yarn|pytest|vitest|jest|tsc|eslint|cargo|go test)\b/.test(lower) ||
    /\b(test|tests|verification|verify|lint|typecheck|build)\b/.test(lower)
}

function classifyVerificationOutput(text: string, isError?: boolean): 'passed' | 'failed' | 'unknown' {
  const lower = text.toLowerCase()
  if (
    isError ||
    /\b(?:[1-9]\d*)\s+fail(?:ed|s)?\b/.test(lower) ||
    /\b(?:error|exception|traceback|assertionerror|syntaxerror)\b/.test(lower) ||
    /\b(exit code|exitcode)\s*[:=]?\s*[1-9]\d*\b/.test(lower)
  ) {
    return 'failed'
  }
  if (
    /\b0\s+fail(?:ed|s)?\b/.test(lower) ||
    /\b(?:pass|passed|passing)\b/.test(lower) ||
    /\btests?\s+ok\b/.test(lower) ||
    /\bsuccess(?:ful|fully)?\b/.test(lower)
  ) {
    return 'passed'
  }
  return 'unknown'
}

function extractEventVerificationEvidence(
  events: QueryEvent[],
  fileEdits: Array<{ eventIndex: number }>,
): VerificationEvidence[] {
  const latestMutationIndex = fileEdits.reduce(
    (latest, edit) => Math.max(latest, edit.eventIndex),
    -1,
  )
  const evidence: VerificationEvidence[] = []

  for (const [eventIndex, event] of events.entries()) {
    const toolName = event.toolName?.toLowerCase() || ''
    if (!isShellTool(toolName) || eventIndex <= latestMutationIndex) continue

    const result = (event as any).result ?? {}
    const text = extractText(result.content ?? result)
    if (!isVerificationCommandText(text)) continue

    const classified = classifyVerificationOutput(text, Boolean(result.isError))
    if (classified === 'unknown') continue

    evidence.push({
      source: 'event',
      label: event.toolName ?? 'shell',
      passed: classified === 'passed',
      outputPreview: preview(text),
      exitCode: typeof result.exitCode === 'number' ? result.exitCode : undefined,
    })
  }

  return evidence
}

async function runCommandEvidence(
  command: VerificationCommand,
  config: VerifyGateConfig,
): Promise<VerificationEvidence> {
  const label = Array.isArray(command) ? command.join(' ') : command
  const timeoutMs = config.commandTimeoutMs ?? 60_000
  if (Array.isArray(command) && command.length === 0) {
    return {
      source: 'command',
      label: '<empty verification command>',
      passed: false,
      outputPreview: 'Verification command array is empty.',
      exitCode: null,
    }
  }

  return await new Promise(resolve => {
    const child = Array.isArray(command)
      ? spawn(command[0] ?? '', command.slice(1), {
          cwd: config.cwd,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : spawn(command, {
          cwd: config.cwd,
          shell: true,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

    let settled = false
    let output = ''
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      resolve({
        source: 'command',
        label,
        passed: false,
        outputPreview: preview(`${output}\nCommand timed out after ${timeoutMs}ms.`),
        exitCode: null,
      })
    }, timeoutMs)

    child.stdout?.on('data', chunk => {
      output += String(chunk)
    })
    child.stderr?.on('data', chunk => {
      output += String(chunk)
    })
    child.on('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        source: 'command',
        label,
        passed: false,
        outputPreview: preview(error.message),
        exitCode: null,
      })
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        source: 'command',
        label,
        passed: code === 0,
        outputPreview: preview(output),
        exitCode: code,
      })
    })
  })
}

async function runVerification(
  events: QueryEvent[],
  _result: QueryResult,
  config: VerifyGateConfig,
): Promise<VerifySummary> {
  console.log('[VerifyGate] Starting verification for code changes')

  const fileEdits = extractFileEdits(events)
  const shellVerificationRequested = config.triggerOnBash && events.some(event =>
    (event.type === 'tool_result' || event.type === 'tool_dispatch_completed') &&
    isShellTool(event.toolName?.toLowerCase() || ''),
  )
  if (fileEdits.length === 0 && !shellVerificationRequested) {
    console.log('[VerifyGate] No file edits detected; skipping verification')
    return {
      passed: true,
      score: 100,
      findings: [],
      timestamp: Date.now(),
      ruleResults: [
        createCheckRuleResult({
          id: `verify-rule-${Date.now()}-skip`,
          ruleId: 'verification-skip-001',
          status: 'passed',
          target: 'verification-gate',
          details: 'No file edit was detected for this verification pass.',
          context: { eventCount: events.length, fileEditCount: 0 },
        }),
      ],
    }
  }

  console.log(`[VerifyGate] Detected ${fileEdits.length} file edit(s)`)

  const timestamp = Date.now()
  const commandEvidence = []
  for (const command of config.verificationCommands ?? []) {
    commandEvidence.push(await runCommandEvidence(command, config))
  }
  const eventEvidence = extractEventVerificationEvidence(events, fileEdits)
  const evidence = [...commandEvidence, ...eventEvidence]
  const hasEvidence = evidence.length > 0
  const allEvidencePassed = hasEvidence && evidence.every(item => item.passed)
  const score = !hasEvidence ? 0 : allEvidencePassed ? 100 : 0

  if (!hasEvidence) {
    const detail = fileEdits.length > 0
      ? 'File mutation happened, but no native verification command or post-edit shell verification evidence was recorded.'
      : 'Verification was requested, but no native verification command evidence was recorded.'
    return {
      passed: false,
      score,
      findings: [
        {
          severity: 'P1',
          title: 'Verification evidence is missing',
          detail,
          suggestion: 'Run the focused native test, lint, typecheck, or build command and attach the resulting tool evidence before finalizing.',
        },
      ],
      timestamp,
      ruleResults: [
        createCheckRuleResult({
          id: `verify-rule-${timestamp}-needs-verification`,
          ruleId: 'verification-evidence-001',
          status: 'failed',
          target: 'verification-gate',
          details: detail,
          fixSuggestion: 'Run focused verification and retry the final step.',
          context: { fileEditCount: fileEdits.length, eventCount: events.length },
        }),
      ],
    }
  }

  const passed = allEvidencePassed && score >= config.minScore

  const findings = passed
    ? []
    : [
        {
          severity: 'P1' as const,
          title: 'Native verification failed',
          detail: evidence
            .filter(item => !item.passed)
            .map(item => `${item.label}: ${item.outputPreview || 'no output'}`)
            .join('\n'),
          suggestion: 'Fix the failing verification command, rerun it, and keep the latest passing evidence before finalizing.',
        },
      ]

  const ruleResults = [
    createCheckRuleResult({
      id: `verify-rule-${Date.now()}-1`,
      ruleId: 'syntax-check-001',
      status: passed ? 'passed' : 'failed',
      target: 'code-change-verification',
      details: evidence.map(item => `${item.label}: ${item.passed ? 'PASS' : 'FAIL'}`).join('; '),
      fixSuggestion: passed
        ? undefined
        : 'Improve the change quality or add stronger test evidence.',
    }),
    createCheckRuleResult({
      id: `verify-rule-${Date.now()}-2`,
      ruleId: 'verification-001',
      status: 'passed',
      target: 'verification-gate',
      details: 'Verification gate executed.',
      context: {
        eventCount: events.length,
        fileEditCount: fileEdits.length,
        evidenceCount: evidence.length,
        evidence: evidence.map(item => ({
          source: item.source,
          label: item.label,
          passed: item.passed,
          exitCode: item.exitCode,
          outputPreview: item.outputPreview,
        })),
      },
    }),
  ]

  const verificationResult: VerifySummary = {
    passed,
    score,
    findings,
    timestamp,
    ruleResults,
  }

  console.log(
    `[VerifyGate] Verification completed: score=${score.toFixed(1)} passed=${passed}`,
  )

  if (!passed && config.onFailure === 'block') {
    console.warn('[VerifyGate] Verification failed; blocking final result')
  } else if (!passed) {
    console.warn('[VerifyGate] Verification failed; continuing by configuration')
  }

  return verificationResult
}

export async function runVerifyGate(
  events: QueryEvent[],
  result: QueryResult,
  config: Partial<VerifyGateConfig> = {},
): Promise<{ result: QueryResult; verification?: VerifySummary }> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }

  if (!shouldRunVerification(events, fullConfig)) {
    return { result }
  }

  const verification = await runVerification(events, result, fullConfig)

  if (!verification.passed) {
    const detail = verification.findings[0]?.detail || 'Verification did not pass.'

    switch (fullConfig.onFailure) {
      case 'block':
        return {
          result: {
            ...result,
            exitReason: 'max_errors',
            finalMessage: `Task blocked by verification gate: ${detail}`,
            verification,
          },
          verification,
        }
      case 'warn':
        return {
          result: {
            ...result,
            finalMessage: `[Verification warning] ${detail}\n\n${result.finalMessage}`,
            verification,
          },
          verification,
        }
      case 'continue':
        return {
          result: { ...result, verification },
          verification,
        }
    }
  }

  return {
    result: { ...result, verification },
    verification,
  }
}
