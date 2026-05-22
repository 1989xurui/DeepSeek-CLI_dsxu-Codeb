import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  buildDsxuTrustPanelLines,
  compactDsxuTrustLine,
} from '../src/components/PromptInput/PromptInputFooter'
import type { DsxuTrustState } from '../src/state/AppStateStore'

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V6_TUI_SNAPSHOT_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_TUI_SNAPSHOT_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/[\\/]+/g, '/')
}

function sampleTrustState(): DsxuTrustState {
  return {
    schemaVersion: 'dsxu.trust-state.v1',
    updatedAt: Date.now(),
    route: {
      model: 'deepseek-v4-flash',
      reason: 'v6-tui-snapshot',
      workflowKind: 'coding',
      role: 'coder',
      estimatedCostUsd: 0.0003,
      cacheHitRatePct: 93,
    },
    verification: {
      state: 'pass',
      reason: 'focused verification passed',
      command: 'bun test src/components/__tests__/tui-trust-surface.test.tsx',
    },
    recovery: {
      state: 'verified_passed_ready_final',
      requiredAction: 'final_answer',
      canClaimComplete: true,
      reason: 'verification proof is attached',
    },
    finalClaim: {
      allowed: true,
      gateId: 'dsxu_v6_tui_trust_surface',
      nextAction: 'visible_final_answer_or_next_user_task',
    },
    ledger: {
      state: 'verify',
      taskId: 'v6-tui-trust',
      eventCount: 8,
      isResumable: true,
      isCompleted: false,
      resumePoint: 'verify',
      nextAction: 'verify',
      activeFrame: {
        status: 'ready',
        phase: 'verify',
        risk: 'medium',
        confirmedFactCount: 3,
        openObligationCount: 1,
        nextAllowedActions: ['record_evidence', 'final_gate'],
        guardCount: 0,
      },
    },
    agent: {
      activeCount: 1,
      runningCount: 1,
      completedCount: 0,
      failedCount: 0,
      incompleteEvidence: false,
      scopes: ['verification'],
      verification: 'worker evidence envelope cited',
      risk: 'compact',
    },
    proof: {
      contract: {
        status: 'ready',
        taskType: 'single_file_edit',
        workflow: 'plan_execute_verify',
        risk: 'medium',
        model: 'deepseek-v4-flash',
        visibleToolCount: 6,
        verificationLevel: 'affected_tests',
        guardCount: 0,
      },
      tool: {
        status: 'ready',
        readyConsumers: 5,
        requiredConsumers: 5,
        missingConsumers: [],
        outputChars: 256,
        boundary: 'dsxu.tool-call-result.v1',
      },
      runtime: {
        status: 'ready',
        presentKinds: 6,
        requiredKinds: 6,
        missingKinds: [],
      },
    },
    health: {
      status: 'ok',
      reason: 'trust surface evidence visible',
    },
  }
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const width = 80
  const lines = buildDsxuTrustPanelLines(sampleTrustState())
  const renderedLines = lines.map(line => ({
    ...line,
    renderedText: compactDsxuTrustLine(line.text, width),
    rawLength: line.text.length,
    renderedLength: compactDsxuTrustLine(line.text, width).length,
  }))
  const combinedText = renderedLines.map(line => line.renderedText).join('\n')
  const blockers = [
    renderedLines.some(line => line.renderedLength > width)
      ? 'trust line exceeds terminal width'
      : '',
    /[\u3400-\u9fff]/.test(combinedText)
      ? 'default trust surface contains CJK state field'
      : '',
    !combinedText.includes('task:verify') || !combinedText.includes('open:1')
      ? 'ledger phase/open obligations not visible'
      : '',
    !combinedText.includes('DSXU: Flash') || !combinedText.includes('check:pass')
      ? 'route or verification state missing'
      : '',
    !combinedText.includes('$0.0003') || !combinedText.includes('cache:93%')
      ? 'cost/cache compact evidence missing'
      : '',
    !combinedText.includes('agent:1')
      ? 'agent evidence compact state missing'
      : '',
  ].filter(Boolean)
  const noVerify = buildDsxuTrustPanelLines({
    ...sampleTrustState(),
    verification: {
      state: 'not_run',
      reason: 'no verification evidence',
    },
    recovery: {
      state: 'edit_applied_needs_verification',
      requiredAction: 'verify',
      canClaimComplete: false,
      reason: 'verification required',
    },
    finalClaim: {
      allowed: false,
      gateId: 'dsxu_unverified_mutation_final_gate',
      nextAction: 'verify',
    },
  }).map(line => compactDsxuTrustLine(line.text, width)).join('\n')
  if (!noVerify.includes('claim:block') || noVerify.includes('check:pass')) {
    blockers.push('no-verify state can still look complete')
  }

  const status = blockers.length === 0
    ? 'PASS_V6_TUI_TRUST_SURFACE'
    : 'NEEDS_V6_TUI_TRUST_SURFACE_REPAIR'
  const report = {
    schemaVersion: 'dsxu.v6.tui-trust-surface.v1',
    generatedAt: new Date().toISOString(),
    status,
    width,
    blockers,
    renderedLines,
    noVerifyRendered: noVerify,
  }
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, [
    '# DSXU V6 TUI Trust Snapshot',
    '',
    `- status: \`${status}\``,
    `- width: \`${width}\``,
    '',
    '## Rendered Lines',
    '',
    ...renderedLines.map(line => `- \`${line.renderedText}\``),
    '',
    '## No-Verify State',
    '',
    '```text',
    noVerify,
    '```',
    '',
    '## Blockers',
    '',
    blockers.length === 0 ? '- none' : blockers.map(blocker => `- ${blocker}`).join('\n'),
    '',
  ].join('\n'), 'utf8')

  console.log(status)
  console.log(JSON.stringify({
    width,
    blockers,
    lineCount: renderedLines.length,
    outputs: [rel(OUT_JSON), rel(OUT_MD)],
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
