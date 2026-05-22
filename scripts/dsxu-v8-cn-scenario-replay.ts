import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  compileDSXUExecutionContract,
  validateDSXUExecutionContract,
  type DSXUExecutionContractInput,
  type DSXUExecutionTaskType,
  type DSXUExecutionWorkflow,
} from '../src/dsxu/engine/action-contract'

type CNReplayCase = {
  id: string
  input: DSXUExecutionContractInput
  expected: {
    taskType: DSXUExecutionTaskType
    workflow: DSXUExecutionWorkflow
    claimPolicy?: 'no_claim' | 'partial_claim' | 'verified_claim'
    minVisibleTools?: number
    maxVisibleTools?: number
    mustIncludeTools?: readonly string[]
    mustExcludeTools?: readonly string[]
  }
}

const CASES: readonly CNReplayCase[] = [
  {
    id: 'cn-long-task-ledger',
    input: {
      taskId: 'cn-long-task-ledger',
      userRequest: '继续上一个长期任务，按账本恢复，修改代码并运行测试验证',
      sourceEvidenceCount: 3,
    },
    expected: {
      taskType: 'long_task',
      workflow: 'long_task',
      minVisibleTools: 16,
      mustIncludeTools: ['Read', 'Grep', 'Todo', 'Agent', 'Bash'],
    },
  },
  {
    id: 'cn-benchmark-evidence',
    input: {
      taskId: 'cn-benchmark-evidence',
      userRequest: '运行基准评估，输出证据仪表盘和通过失败证明',
      benchmarkIntent: true,
    },
    expected: {
      taskType: 'benchmark',
      workflow: 'plan_execute_verify',
      claimPolicy: 'no_claim',
      minVisibleTools: 18,
    },
  },
  {
    id: 'cn-release-security',
    input: {
      taskId: 'cn-release-security',
      userRequest: '审核发布声明、权限、安全和秘钥风险',
      sourceEvidenceCount: 1,
    },
    expected: {
      taskType: 'review',
      workflow: 'review',
      claimPolicy: 'no_claim',
      minVisibleTools: 18,
    },
  },
  {
    id: 'cn-multi-file-refactor',
    input: {
      taskId: 'cn-multi-file-refactor',
      userRequest: '多文件重构，使用 LSP 查引用并跑测试',
      sourceEvidenceCount: 2,
    },
    expected: {
      taskType: 'multi_file_refactor',
      workflow: 'plan_execute_verify',
      minVisibleTools: 16,
      mustIncludeTools: ['Read', 'Grep', 'LSP', 'Edit', 'RunNativeTest'],
    },
  },
  {
    id: 'cn-explain-no-edit',
    input: {
      taskId: 'cn-explain-no-edit',
      userRequest: '解释一下这个文件的逻辑，不要修改代码',
    },
    expected: {
      taskType: 'explain',
      workflow: 'observe',
      maxVisibleTools: 8,
      mustExcludeTools: ['Edit', 'Write'],
    },
  },
]

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function main(): void {
  const rows = CASES.map((item, index) => {
    const contract = compileDSXUExecutionContract({
      ...item.input,
      now: index + 1,
    })
    const validation = validateDSXUExecutionContract(contract)
    const blockers = [
      !validation.valid ? `invalid:${validation.violations.join('|') || validation.missingFields.join('|')}` : '',
      contract.taskType !== item.expected.taskType ? `taskType:${contract.taskType}!=${item.expected.taskType}` : '',
      contract.workflow !== item.expected.workflow ? `workflow:${contract.workflow}!=${item.expected.workflow}` : '',
      item.expected.claimPolicy && contract.claimPolicy !== item.expected.claimPolicy
        ? `claimPolicy:${contract.claimPolicy}!=${item.expected.claimPolicy}`
        : '',
      item.expected.minVisibleTools !== undefined && contract.visibleTools.length < item.expected.minVisibleTools
        ? `visibleTools:${contract.visibleTools.length}<${item.expected.minVisibleTools}`
        : '',
      item.expected.maxVisibleTools !== undefined && contract.visibleTools.length > item.expected.maxVisibleTools
        ? `visibleTools:${contract.visibleTools.length}>${item.expected.maxVisibleTools}`
        : '',
      ...(item.expected.mustIncludeTools ?? []).map(tool =>
        contract.visibleTools.includes(tool) ? '' : `missingTool:${tool}`,
      ),
      ...(item.expected.mustExcludeTools ?? []).map(tool =>
        contract.visibleTools.includes(tool) ? `unexpectedTool:${tool}` : '',
      ),
    ].filter(Boolean)

    return {
      id: item.id,
      status: blockers.length === 0 ? 'PASS' : 'FAIL',
      taskType: contract.taskType,
      workflow: contract.workflow,
      route: contract.routeDecision.reason,
      model: contract.routeDecision.model,
      visibleTools: contract.visibleTools,
      claimPolicy: contract.claimPolicy,
      blockers,
      evidence: contract.evidence,
    }
  })
  const blockers = rows.flatMap(row => row.blockers.map(blocker => `${row.id}:${blocker}`))
  const report = {
    schemaVersion: 'dsxu.v8.cn-scenario-replay.v1',
    generatedAt: new Date().toISOString(),
    owner: 'Query Loop / Chinese Intent / Tool Window',
    status: blockers.length === 0 ? 'PASS_V8_CN_SCENARIO_REPLAY' : 'FAIL_V8_CN_SCENARIO_REPLAY',
    publicClaimAllowed: false,
    rows,
    blockers,
    rule: 'Chinese scenario replay is internal DSXU contract evidence. It proves classification, route, claim boundary, and tool-window shape, not public benchmark quality.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V8_CN_SCENARIO_REPLAY_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V8_CN_SCENARIO_REPLAY_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V8 Chinese Scenario Replay',
    '',
    `Status: ${report.status}`,
    '',
    '| id | status | taskType | workflow | route | visibleTools | blockers |',
    '|---|---|---|---|---|---:|---|',
    ...rows.map(row =>
      `| ${row.id} | ${row.status} | ${row.taskType} | ${row.workflow} | ${row.route} | ${row.visibleTools.length} | ${row.blockers.join('<br>') || 'none'} |`,
    ),
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({
    status: report.status,
    cases: rows.length,
    blockers,
    outputJson: jsonPath,
    outputMd: mdPath,
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
