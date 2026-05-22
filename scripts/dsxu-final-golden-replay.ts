import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  compileDSXUExecutionContract,
  validateDSXUExecutionContract,
  type DSXUExecutionContractInput,
  type DSXUExecutionTaskType,
  type DSXUExecutionWorkflow,
} from '../src/dsxu/engine/action-contract'
import { buildDefaultDSXUFeatureDeletionTaskPack } from '../src/dsxu/engine/feature-deletion-benchmark'

type GoldenCase = {
  id: string
  bucket: string
  input: DSXUExecutionContractInput
  expected: {
    taskType: DSXUExecutionTaskType
    workflow: DSXUExecutionWorkflow
    claimPolicy?: 'no_claim' | 'partial_claim' | 'verified_claim'
    minTools?: number
    maxTools?: number
  }
}

const CN = {
  continueTask: '\u7ee7\u7eed\u957f\u4efb\u52a1\uff0c\u6309\u8d26\u672c\u6062\u590d\uff0c\u4fee\u6539\u4ee3\u7801\u5e76\u9a8c\u8bc1',
  benchmark: '\u8fd0\u884c\u57fa\u51c6\u8bc4\u4f30\uff0c\u8f93\u51fa\u8bc1\u636e\u4eea\u8868\u76d8\u548c\u5931\u8d25\u8bc1\u660e',
  review: '\u5ba1\u6838\u53d1\u5e03\u58f0\u660e\uff0c\u6743\u9650\uff0c\u5b89\u5168\u548c\u79d8\u94a5\u98ce\u9669',
  refactor: '\u591a\u6587\u4ef6\u91cd\u6784\uff0c\u4f7f\u7528 LSP \u67e5\u5f15\u7528\u5e76\u8dd1\u6d4b\u8bd5',
  debug: '\u4fee\u590d\u5931\u8d25\u6d4b\u8bd5\u5e76\u8fdb\u5165\u6062\u590d\u95ed\u73af',
  search: '\u641c\u7d22\u5f15\u7528\u5e76\u5b9a\u4f4d\u4e3b\u94fe\u5165\u53e3',
  explain: '\u53ea\u5206\u6790\u8fd9\u4e2a\u6a21\u5757\uff0c\u4e0d\u8981\u4fee\u6539\u4ee3\u7801',
  edit: '\u5b9e\u73b0\u4e00\u4e2a\u5c0f\u529f\u80fd\u5e76\u8dd1\u53d7\u5f71\u54cd\u6d4b\u8bd5',
}

function makeCases(): GoldenCase[] {
  const cases: GoldenCase[] = []
  const push = (item: GoldenCase) => cases.push(item)
  const editExpected = { taskType: 'single_file_edit' as const, workflow: 'plan_execute_verify' as const, minTools: 8, maxTools: 16 }
  const debugExpected = { taskType: 'debug' as const, workflow: 'recovery' as const, minTools: 12, maxTools: 24 }
  const refactorExpected = { taskType: 'multi_file_refactor' as const, workflow: 'plan_execute_verify' as const, minTools: 16, maxTools: 24 }
  const longExpected = { taskType: 'long_task' as const, workflow: 'long_task' as const, minTools: 16, maxTools: 27 }
  const reviewExpected = { taskType: 'review' as const, workflow: 'review' as const, minTools: 8, maxTools: 27 }
  const benchmarkExpected = { taskType: 'benchmark' as const, workflow: 'plan_execute_verify' as const, claimPolicy: 'no_claim' as const, minTools: 16, maxTools: 24 }

  const cnCases: readonly [string, string, GoldenCase['expected'], Partial<DSXUExecutionContractInput>][] = [
    ['cn-long-task', CN.continueTask, longExpected, { requiresAgentEvidence: true, sourceEvidenceCount: 3 }],
    ['cn-benchmark', CN.benchmark, benchmarkExpected, { benchmarkIntent: true }],
    ['cn-review', CN.review, { ...reviewExpected, claimPolicy: 'no_claim' }, { publicClaimIntent: true, riskTags: ['release'] }],
    ['cn-refactor', CN.refactor, refactorExpected, { sourceEvidenceCount: 2 }],
    ['cn-debug', CN.debug, debugExpected, { priorFailureCount: 1 }],
    ['cn-search', CN.search, { taskType: 'search', workflow: 'observe', minTools: 4, maxTools: 12 }, {}],
    ['cn-explain', CN.explain, { taskType: 'explain', workflow: 'observe', minTools: 1, maxTools: 8 }, {}],
    ['cn-edit', CN.edit, editExpected, { sourceEvidenceCount: 1 }],
    ['cn-release-security', `${CN.review}\uff0c\u4e0d\u80fd\u5199\u516c\u5f00\u5938\u5927\u58f0\u660e`, { ...reviewExpected, claimPolicy: 'no_claim' }, { publicClaimIntent: true, riskTags: ['security'] }],
    ['cn-cost-route', '\u5ba1\u6838\u6210\u672c\u8def\u7531\u548c Pro \u51c6\u5165\u8bc1\u636e', reviewExpected, { sourceEvidenceCount: 2 }],
    ['cn-tool-permission', '\u5ba1\u8ba1\u5de5\u5177\u6743\u9650\u8def\u5f84\u8bc1\u636e', reviewExpected, { sourceEvidenceCount: 2 }],
    ['cn-no-edit-analysis', '\u53ea\u5206\u6790\u4e0d\u5199\u4ee3\u7801\uff0c\u8bf4\u660e\u4e3b\u94fe\u903b\u8f91', { taskType: 'explain', workflow: 'observe', minTools: 1, maxTools: 8 }, {}],
  ]
  for (const [id, request, expected, extra] of cnCases) {
    push({ id, bucket: 'chinese-intent', input: { taskId: id, userRequest: request, ...extra }, expected })
  }

  for (let i = 1; i <= 6; i++) {
    push({
      id: `no-edit-${i}`,
      bucket: 'no-edit',
      input: { taskId: `no-edit-${i}`, userRequest: `Explain subsystem ${i}. Do not edit or write code.` },
      expected: { taskType: 'explain', workflow: 'observe', minTools: 1, maxTools: 8 },
    })
  }
  for (let i = 1; i <= 8; i++) {
    push({
      id: `single-file-edit-${i}`,
      bucket: 'single-file-edit',
      input: { taskId: `single-file-edit-${i}`, userRequest: `Implement feature branch ${i} and run affected tests.`, sourceEvidenceCount: 1 },
      expected: editExpected,
    })
  }
  for (let i = 1; i <= 8; i++) {
    push({
      id: `debug-repair-${i}`,
      bucket: 'debug-repair',
      input: { taskId: `debug-repair-${i}`, userRequest: `Debug failing command ${i}, repair, and rerun verification.`, priorFailureCount: i % 3 },
      expected: debugExpected,
    })
  }
  for (let i = 1; i <= 8; i++) {
    push({
      id: `multi-file-refactor-${i}`,
      bucket: 'multi-file-refactor',
      input: {
        taskId: `multi-file-refactor-${i}`,
        userRequest: `Refactor architecture module boundary ${i} across multiple files with references.`,
        workspaceSignals: { changedFiles: [`src/domain/${i}/a.ts`, `src/domain/${i}/b.ts`, `src/domain/${i}/test.ts`] },
        sourceEvidenceCount: 2,
      },
      expected: refactorExpected,
    })
  }
  for (let i = 1; i <= 8; i++) {
    push({
      id: `long-task-${i}`,
      bucket: 'long-task',
      input: { taskId: `long-task-${i}`, userRequest: `Continue long task checkpoint ${i} with ledger recovery and verification.`, requiresAgentEvidence: true, sourceEvidenceCount: 3 },
      expected: longExpected,
    })
  }
  for (let i = 1; i <= 6; i++) {
    push({
      id: `agent-evidence-${i}`,
      bucket: 'agent-evidence',
      input: { taskId: `agent-evidence-${i}`, userRequest: `Continue complex multi-step agent evidence handoff ${i} and report compact envelope.`, requiresAgentEvidence: true, sourceEvidenceCount: 3 },
      expected: longExpected,
    })
  }
  for (let i = 1; i <= 6; i++) {
    push({
      id: `benchmark-evidence-${i}`,
      bucket: 'benchmark-evidence',
      input: { taskId: `benchmark-evidence-${i}`, userRequest: `Run benchmark replay ${i} and output evidence dashboard.`, benchmarkIntent: true, sourceEvidenceCount: 2 },
      expected: benchmarkExpected,
    })
  }
  for (let i = 1; i <= 6; i++) {
    push({
      id: `permission-release-${i}`,
      bucket: 'permission-security-release',
      input: { taskId: `permission-release-${i}`, userRequest: `Review release claim security permission risk ${i}.`, publicClaimIntent: true, riskTags: ['release', 'security', 'permission'], sourceEvidenceCount: 2 },
      expected: { ...reviewExpected, claimPolicy: 'no_claim', minTools: 18, maxTools: 27 },
    })
  }
  for (let i = 1; i <= 4; i++) {
    push({
      id: `ecosystem-boundary-${i}`,
      bucket: 'ecosystem-boundary',
      input: { taskId: `ecosystem-boundary-${i}`, userRequest: `Search MCP skill adapter boundary ${i} and list references without creating runtime.` },
      expected: { taskType: 'search', workflow: 'observe', minTools: 4, maxTools: 27 },
    })
  }
  for (const item of buildDefaultDSXUFeatureDeletionTaskPack('2026-05-20T00:00:00.000Z').cases) {
    const expected =
      item.expectedToolProfile === 'debug'
        ? debugExpected
        : item.expectedToolProfile === 'multi_file_refactor'
          ? refactorExpected
          : reviewExpected
    push({
      id: item.id,
      bucket: 'feature-deletion',
      input: {
        taskId: item.id,
        userRequest: `${
          item.expectedToolProfile === 'review'
            ? 'Review'
            : item.expectedToolProfile === 'multi_file_refactor'
              ? 'Refactor multi-file'
              : 'Debug'
        } deleted capability ${item.deletedCapability} and run evidence.`,
        sourceEvidenceCount: item.fixtureFiles.length,
        benchmarkIntent: true,
      },
      expected,
    })
  }
  return cases
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function main(): void {
  const cases = makeCases()
  const rows = cases.map((item, index) => {
    const contract = compileDSXUExecutionContract({ ...item.input, now: index + 1 })
    const validation = validateDSXUExecutionContract(contract)
    const blockers = [
      !validation.valid ? `invalid:${validation.violations.join('|') || validation.missingFields.join('|')}` : '',
      contract.taskType !== item.expected.taskType ? `taskType:${contract.taskType}!=${item.expected.taskType}` : '',
      contract.workflow !== item.expected.workflow ? `workflow:${contract.workflow}!=${item.expected.workflow}` : '',
      item.expected.claimPolicy && contract.claimPolicy !== item.expected.claimPolicy
        ? `claimPolicy:${contract.claimPolicy}!=${item.expected.claimPolicy}`
        : '',
      item.expected.minTools !== undefined && contract.visibleTools.length < item.expected.minTools
        ? `visibleTools:${contract.visibleTools.length}<${item.expected.minTools}`
        : '',
      item.expected.maxTools !== undefined && contract.visibleTools.length > item.expected.maxTools
        ? `visibleTools:${contract.visibleTools.length}>${item.expected.maxTools}`
        : '',
      contract.routeDecision.provider !== 'deepseek' ? `provider:${contract.routeDecision.provider}` : '',
      contract.owner !== 'Query Loop / PlanGraph / Tool Gate' ? `owner:${contract.owner}` : '',
    ].filter(Boolean)
    return {
      id: item.id,
      bucket: item.bucket,
      status: blockers.length === 0 ? 'PASS' : 'FAIL',
      taskType: contract.taskType,
      workflow: contract.workflow,
      routeReason: contract.routeDecision.reason,
      model: contract.routeDecision.model,
      claimPolicy: contract.claimPolicy,
      visibleToolCount: contract.visibleTools.length,
      blockers,
    }
  })
  const blockers = rows.flatMap(row => row.blockers.map(blocker => `${row.id}:${blocker}`))
  const bucketSummary = Object.values(rows.reduce<Record<string, { bucket: string; total: number; pass: number; fail: number }>>((acc, row) => {
    acc[row.bucket] ??= { bucket: row.bucket, total: 0, pass: 0, fail: 0 }
    acc[row.bucket].total += 1
    acc[row.bucket][row.status === 'PASS' ? 'pass' : 'fail'] += 1
    return acc
  }, {}))
  const report = {
    schemaVersion: 'dsxu.final-golden-replay.v10',
    generatedAt: new Date().toISOString(),
    owner: 'Query Loop / Tool Gate / DeepSeek Route / Evidence',
    status: blockers.length === 0 ? 'PASS_V10_FINAL_GOLDEN_REPLAY' : 'FAIL_V10_FINAL_GOLDEN_REPLAY',
    publicClaimAllowed: false,
    caseCount: rows.length,
    bucketSummary,
    rows,
    blockers,
    rule:
      'Golden replay is an internal deterministic DSXU contract suite. It verifies routing and tool-window shape, not model quality or public benchmark rank.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V10_FINAL_GOLDEN_REPLAY_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V10_FINAL_GOLDEN_REPLAY_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final Golden Replay',
    '',
    `Status: ${report.status}`,
    '',
    `Cases: ${rows.length}`,
    '',
    '| bucket | total | pass | fail |',
    '|---|---:|---:|---:|',
    ...bucketSummary.map(row => `| ${row.bucket} | ${row.total} | ${row.pass} | ${row.fail} |`),
    '',
    '| id | bucket | status | taskType | workflow | route | tools | blockers |',
    '|---|---|---|---|---|---|---:|---|',
    ...rows.map(row =>
      `| ${row.id} | ${row.bucket} | ${row.status} | ${row.taskType} | ${row.workflow} | ${row.routeReason} | ${row.visibleToolCount} | ${row.blockers.join('<br>') || 'none'} |`,
    ),
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({ status: report.status, cases: rows.length, blockers, outputJson: jsonPath, outputMd: mdPath }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
