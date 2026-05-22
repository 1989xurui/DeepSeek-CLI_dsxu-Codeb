import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  buildLocalizedFeedbackEnvelope,
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
  const failedVerification: VerifySummary = {
    passed: false,
    score: 58,
    findings: [
      {
        severity: 'P1',
        title: 'tool result backflow breaks cache locality',
        detail: 'large read output is repeatedly returned to the dynamic prompt tail',
        suggestion: 'store the long output as artifact and keep a bounded preview in the next turn',
      },
      {
        severity: 'P2',
        title: 'missing focused verification rerun',
        detail: 'final report attempted to summarize before rerunning the owner test',
        suggestion: 'run the owner-scoped focused test before claim generation',
      },
    ],
    timestamp: 1,
  }
  const envelope = buildLocalizedFeedbackEnvelope({
    verification: failedVerification,
    command: 'bun test src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts',
    failedAttemptsSinceProgress: 2,
    localizedFiles: [
      'src/dsxu/engine/route-cache-dynamic-tail.ts',
      'src/dsxu/engine/prompt-prefix-cache-builder.ts',
    ],
    nextAction: 'artifact the large tool result, rebuild source capsule, then rerun focused verification',
    evidence: ['v10:M1', 'owner:VerificationKernel / Recovery / GearBox'],
  })
  let ledger = createProgressLedger('v10-localized-feedback', 'session-v10-localized-feedback', 'running')
  ledger = recordVerificationRecoveryDecision(ledger, projectVerificationRecoveryDecision({
    verification: failedVerification,
    onFailure: 'block',
    failedAttemptsSinceProgress: 2,
    command: 'bun test src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts',
    localizedFiles: envelope.localizedFiles,
    evidence: ['v10:M1'],
  }))
  const feedbackEvent = ledger.events?.find(event => event.summary.includes('Localized feedback envelope ready'))
  const blockers = [
    envelope.status !== 'ready' ? `envelope:${envelope.status}` : '',
    envelope.feedbackLines.length === 0 ? 'missing feedback lines' : '',
    envelope.feedbackLines.length > 7 ? `too many feedback lines:${envelope.feedbackLines.length}` : '',
    feedbackEvent ? '' : 'missing ledger feedback event',
    feedbackEvent?.metadata?.finalClaimAllowed === false ? '' : 'feedback event did not block final claim',
  ].filter(Boolean)
  const report = {
    schemaVersion: 'dsxu.final-localized-feedback.v10',
    generatedAt: new Date().toISOString(),
    owner: 'VerificationKernel / Recovery / GearBox',
    status: blockers.length === 0
      ? 'PASS_V10_FINAL_LOCALIZED_FEEDBACK'
      : 'FAIL_V10_FINAL_LOCALIZED_FEEDBACK',
    publicClaimAllowed: false,
    envelope,
    ledgerEventCount: ledger.events?.length ?? 0,
    feedbackEvent,
    blockers,
    rule:
      'Localized feedback is a compact recovery envelope for failed verification. It is written to the existing ledger and does not create another recovery runtime.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V10_FINAL_LOCALIZED_FEEDBACK_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V10_FINAL_LOCALIZED_FEEDBACK_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final Localized Feedback',
    '',
    `Status: ${report.status}`,
    '',
    '| line | feedback |',
    '|---:|---|',
    ...envelope.feedbackLines.map((line, index) => `| ${index + 1} | ${line} |`),
    '',
    `Ledger events: ${report.ledgerEventCount}`,
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({ status: report.status, blockers, outputJson: jsonPath, outputMd: mdPath }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
