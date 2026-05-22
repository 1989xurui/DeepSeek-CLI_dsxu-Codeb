import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  appendLedgerEvent,
  buildDSXUActiveFrame,
  buildDurableLedgerRecoveryProof,
  buildLongTaskLedgerProjection,
  buildRuntimeEventSchemaConsumptionProof,
  createProgressLedger,
  projectVerificationRecoveryDecision,
  recordVerificationRecoveryDecision,
  type VerifySummary,
} from '../src/dsxu/engine/progress-ledger'

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function main(): void {
  let ledger = createProgressLedger('v8-long-task-ledger-replay', 'session-v8-ledger', 'plan')
  ledger = appendLedgerEvent(ledger, {
    kind: 'goal',
    owner: 'Query Loop',
    summary: 'finish V8 closure without creating a second runtime',
    evidence: ['goal:V8 closure'],
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'plan',
    owner: 'PlanGraph',
    summary: 'reachability, Chinese replay, ledger replay, provider smoke',
    evidence: ['plan:four hard V8 gates'],
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'task_contract',
    owner: 'Query Loop / PlanGraph / Tool Gate',
    summary: 'long_task via V8 tool window',
    metadata: {
      executionContract: {
        goal: 'V8 long task closure',
        risk: 'high',
        visibleTools: ['Read', 'Grep', 'Todo', 'Agent', 'Bash'],
        verificationLevel: 'full',
      },
    },
    evidence: ['taskType:long_task', 'visibleTools:Agent|Bash|RunNativeTest'],
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'source_evidence',
    owner: 'Source Truth',
    summary: 'read V8 owner modules',
    evidence: ['src/dsxu/engine/action-contract.ts', 'src/dsxu/engine/tool-window-policy-v8.ts'],
    metadata: { filesRead: ['src/dsxu/engine/action-contract.ts', 'src/dsxu/engine/tool-window-policy-v8.ts'] },
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'tool',
    owner: 'Tool Gate',
    summary: 'focused V8 script/test execution planned',
    evidence: ['tool:Bash', 'bounded-output:true'],
  })
  const failedVerification: VerifySummary = {
    passed: false,
    score: 62,
    findings: [{
      severity: 'P1',
      title: 'fresh six-stage did not close',
      detail: 'outer run timed out before release closure finished',
      suggestion: 'split owner evidence and rerun focused V8 gates',
    }],
    timestamp: Date.now(),
  }
  ledger = recordVerificationRecoveryDecision(ledger, projectVerificationRecoveryDecision({
    verification: failedVerification,
    onFailure: 'block',
    failedAttemptsSinceProgress: 2,
    command: 'bun run test:six-stage-final',
    owner: 'VerificationKernel',
    evidence: ['fresh-run-required:true'],
  }))
  ledger = appendLedgerEvent(ledger, {
    kind: 'recovery',
    owner: 'Recovery / GearBox',
    summary: 'split V8 final gates into reachability, CN replay, ledger replay, and provider smoke',
    evidence: ['recovery:split-owner-gates'],
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'evidence',
    owner: 'Evidence / Release Claim Binder',
    summary: 'public claim remains blocked until paired raw evidence and clean export exist',
    evidence: ['publicClaimAllowed:false', 'cleanExportArtifact:not-created'],
  })

  const projection = buildLongTaskLedgerProjection(ledger)
  const activeFrame = buildDSXUActiveFrame({ ledger, task: 'V8 closure replay' })
  const durableProof = buildDurableLedgerRecoveryProof(ledger)
  const runtimeProof = buildRuntimeEventSchemaConsumptionProof({
    events: ledger.events ?? [],
    requiredKinds: ['goal', 'plan', 'tool', 'verification', 'recovery', 'evidence'],
  })
  const blockers = [
    projection.finalClaimAllowed ? 'final claim unexpectedly allowed after blocking verification' : '',
    projection.finalReportSection.status !== 'recoverable' ? `ledger status:${projection.finalReportSection.status}` : '',
    durableProof.status !== 'PASS_DURABLE_LEDGER_RECOVERY_READY' ? `durable:${durableProof.status}` : '',
    runtimeProof.status !== 'PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION' ? `runtime:${runtimeProof.status}` : '',
    activeFrame.guards.length > 0 ? `activeFrame:${activeFrame.guards.join('|')}` : '',
  ].filter(Boolean)
  const report = {
    schemaVersion: 'dsxu.v8.long-task-ledger-replay.v1',
    generatedAt: new Date().toISOString(),
    owner: 'PlanGraph / Work-State / Recovery / Evidence',
    status: blockers.length === 0 ? 'PASS_V8_LONG_TASK_LEDGER_REPLAY' : 'FAIL_V8_LONG_TASK_LEDGER_REPLAY',
    publicClaimAllowed: false,
    blockers,
    projection,
    activeFrame,
    durableProof,
    runtimeProof,
    rule: 'This replay proves long-task ledger recovery behavior from existing DSXU ledger/projection owners. It does not claim final release readiness.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V8_LONG_TASK_LEDGER_REPLAY_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V8_LONG_TASK_LEDGER_REPLAY_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V8 Long Task Ledger Replay',
    '',
    `Status: ${report.status}`,
    '',
    `Projection: ${projection.finalReportSection.status}`,
    '',
    `Durable recovery: ${durableProof.status}`,
    '',
    `Runtime event schema: ${runtimeProof.status}`,
    '',
    `Final claim allowed: ${String(projection.finalClaimAllowed)}`,
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    '## TUI Lines',
    '',
    ...projection.tuiLines.map(line => `- ${line}`),
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({
    status: report.status,
    blockers,
    outputJson: jsonPath,
    outputMd: mdPath,
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
