import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  appendLedgerEvent,
  buildDSXUActiveFrame,
  buildDurableLedgerRecoveryProof,
  buildLongTaskLedgerProjection,
  buildRuntimeEventSchemaConsumptionProof,
  createProgressLedger,
  projectToolCallResultToLedgerEvent,
  projectVerificationRecoveryDecision,
  recordVerificationRecoveryDecision,
} from '../src/dsxu/engine/progress-ledger'

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V6_LEDGER_RESUME_SMOKE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_LEDGER_RESUME_SMOKE_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/[\\/]+/g, '/')
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  let ledger = createProgressLedger('v6-ledger-resume-smoke', 'session-v6-smoke', 'verify')
  ledger = appendLedgerEvent(ledger, {
    kind: 'goal',
    owner: 'Query Loop',
    summary: 'Validate V6 active frame and durable ledger resume',
    eventId: 'goal-v6-smoke',
    evidence: ['goal:v6-ledger-resume-smoke'],
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'plan',
    owner: 'PlanGraph',
    summary: 'Use existing progress-ledger owner for active frame and resume proof',
    eventId: 'plan-v6-smoke',
    evidence: ['plan:owner-folded'],
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'task_contract',
    owner: 'Query Loop / PlanGraph / Tool Gate',
    summary: 'long_task via flash-max',
    eventId: 'contract-v6-smoke',
    evidence: ['contract:v6-ledger-resume-smoke'],
    metadata: {
      executionContract: {
        goal: 'Validate V6 active frame and durable ledger resume',
        risk: 'medium',
        visibleTools: ['Read', 'Grep', 'Bash', 'Evidence'],
        verificationLevel: 'affected_tests',
      },
    },
  })
  ledger = appendLedgerEvent(ledger, projectToolCallResultToLedgerEvent({
    callId: 'tool-v6-smoke',
    toolName: 'Read',
    owner: 'Tool Gate / Query Loop',
    result: {
      ok: true,
      outputText: 'progress-ledger source evidence',
      events: [],
      metadata: {
        duration: 20,
        executorKind: 'dsxu_native',
        usedBridge: false,
      },
    },
  }))
  ledger = appendLedgerEvent(ledger, {
    kind: 'source_evidence',
    owner: 'Source Truth Repair',
    summary: 'Progress ledger owner inspected',
    eventId: 'source-v6-smoke',
    evidence: ['src/dsxu/engine/progress-ledger.ts'],
    metadata: {
      filesRead: ['src/dsxu/engine/progress-ledger.ts'],
    },
  })
  const verificationProjection = projectVerificationRecoveryDecision({
    verification: {
      passed: false,
      score: 50,
      findings: [
        {
          severity: 'P1',
          title: 'Resume proof required before final claim',
          detail: 'V6 WP5 must prove failed verification stays resumable.',
        },
      ],
      timestamp: Date.now(),
    },
    onFailure: 'block',
    failedAttemptsSinceProgress: 2,
    command: 'bun test src/dsxu/engine/__tests__/active-frame-ledger.test.ts',
    owner: 'VerificationKernel',
    evidence: ['verification:resume-proof-required'],
  })
  ledger = recordVerificationRecoveryDecision(ledger, verificationProjection)
  ledger = appendLedgerEvent(ledger, {
    kind: 'recovery',
    owner: 'Recovery / GearBox',
    summary: verificationProjection.recoveryDecision?.nextAction ?? 'Recovery decision recorded',
    eventId: 'recovery-v6-smoke',
    evidence: [
      'recovery:from-verification-projection',
      ...(verificationProjection.recoveryDecision?.evidence ?? []),
    ],
    metadata: {
      recoveryDecision: verificationProjection.recoveryDecision,
      finalClaimAllowed: false,
    },
  })
  ledger = appendLedgerEvent(ledger, {
    kind: 'evidence',
    owner: 'Evidence / Release Claim Binder',
    summary: 'Ledger resume smoke evidence packet linked',
    eventId: 'evidence-v6-smoke',
    evidence: [rel(OUT_JSON)],
  })

  const activeFrame = buildDSXUActiveFrame({ ledger })
  const projection = buildLongTaskLedgerProjection(ledger)
  const durableProof = buildDurableLedgerRecoveryProof(ledger)
  const runtimeProof = buildRuntimeEventSchemaConsumptionProof({
    events: ledger.events ?? [],
  })
  const blockers = [
    activeFrame.guards.length > 0 ? `activeFrame guards: ${activeFrame.guards.join('; ')}` : '',
    durableProof.status !== 'PASS_DURABLE_LEDGER_RECOVERY_READY' ? `durableProof status=${durableProof.status}` : '',
    runtimeProof.status !== 'PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION' ? `runtimeProof status=${runtimeProof.status}` : '',
    projection.finalClaimAllowed ? 'final claim allowed despite failed verification' : '',
    !projection.isResumable ? 'ledger is not resumable after failed verification' : '',
  ].filter(Boolean)
  const status = blockers.length === 0
    ? 'PASS_V6_LEDGER_RESUME_SMOKE'
    : 'NEEDS_V6_LEDGER_RESUME_EVIDENCE'
  const report = {
    schemaVersion: 'dsxu.v6.ledger-resume-smoke.v1',
    generatedAt: new Date().toISOString(),
    status,
    blockers,
    activeFrame,
    projection,
    durableProof,
    runtimeProof,
  }
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, [
    '# DSXU V6 Ledger Resume Smoke',
    '',
    `- status: \`${status}\``,
    `- active frame phase: \`${activeFrame.phase}\``,
    `- resume point: \`${projection.resumePoint ?? 'none'}\``,
    `- final claim allowed: \`${String(projection.finalClaimAllowed)}\``,
    '',
    '## Blockers',
    '',
    blockers.length === 0 ? '- none' : blockers.map(blocker => `- ${blocker}`).join('\n'),
    '',
  ].join('\n'), 'utf8')

  console.log(status)
  console.log(JSON.stringify({
    activeFrameGuards: activeFrame.guards,
    resumePoint: projection.resumePoint,
    finalClaimAllowed: projection.finalClaimAllowed,
    durableStatus: durableProof.status,
    runtimeStatus: runtimeProof.status,
    blockers,
    outputs: [rel(OUT_JSON), rel(OUT_MD)],
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
