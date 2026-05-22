import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  compileDSXUExecutionContract,
  validateDSXUExecutionContract,
  type DSXUExecutionContractInput,
} from '../src/dsxu/engine/action-contract'
import { compileDSXUCapabilityActivationPlan } from '../src/dsxu/engine/capability-registry'
import { compileDSXUToolView } from '../src/dsxu/engine/tool-catalog-v1'

const TOOL_POOL = [
  'Read',
  'Edit',
  'Write',
  'Bash',
  'PowerShell',
  'Grep',
  'Glob',
  'LSP',
  'GitDiff',
  'RunNativeTest',
  'Evidence',
  'Replay',
  'Todo',
  'ToolSearch',
  'Agent',
  'TaskOutput',
  'CollectEvidence',
  'FileHistory',
  'AskUser',
  'MCPDocs',
  'SkillRunner',
  'WebSearch',
  'WebFetch',
  'SwarmCoordinator',
  'LegacyToolBus',
  'TaskCreate',
  'TaskUpdate',
]

type Scenario = {
  id: string
  input: DSXUExecutionContractInput
  explicitAllowToolIds?: readonly string[]
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: 'ordinary-edit',
    input: {
      taskId: 'v8-reach-ordinary-edit',
      userRequest: 'Implement one helper, inspect references, edit code, and run affected tests.',
      sourceEvidenceCount: 2,
    },
  },
  {
    id: 'long-task-agent',
    input: {
      taskId: 'v8-reach-long-task',
      userRequest: 'Continue the long task from the ledger, split read-only investigation, patch scoped files, and verify.',
      sourceEvidenceCount: 4,
      requiresAgentEvidence: true,
    },
    explicitAllowToolIds: ['Agent', 'TaskOutput'],
  },
  {
    id: 'release-review',
    input: {
      taskId: 'v8-reach-release-review',
      userRequest: 'Review release claim, security, permission, and provider risk before public docs.',
      riskTags: ['release', 'security', 'permission'],
      publicClaimIntent: true,
      sourceEvidenceCount: 3,
    },
  },
  {
    id: 'explain-no-edit',
    input: {
      taskId: 'v8-reach-explain',
      userRequest: 'Explain this module. Do not edit or write code.',
    },
  },
]

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function main(): void {
  const rows = SCENARIOS.map((scenario, index) => {
    const contract = compileDSXUExecutionContract({
      ...scenario.input,
      now: index + 1,
    })
    const validation = validateDSXUExecutionContract(contract)
    const view = compileDSXUToolView({
      taskType: contract.taskType,
      tools: TOOL_POOL,
      explicitAllowToolIds: scenario.explicitAllowToolIds,
    })
    const activation = compileDSXUCapabilityActivationPlan({
      taskType: contract.taskType,
      taskContractAllows: scenario.explicitAllowToolIds?.includes('Agent')
        ? ['agent.serial-worker', 'agent.parallel-fanout']
        : [],
    })
    const hiddenNetworkTools = ['WebSearch', 'WebFetch'].filter(tool => view.hiddenToolIds.includes(tool))
    const hiddenExpertTools = ['MCPDocs', 'SkillRunner', 'SwarmCoordinator', 'LegacyToolBus'].filter(tool =>
      view.hiddenToolIds.includes(tool),
    )
    const blockers = [
      !validation.valid ? `invalid contract:${validation.violations.join('|') || validation.missingFields.join('|')}` : '',
      contract.owner !== 'Query Loop / PlanGraph / Tool Gate' ? `wrong owner:${contract.owner}` : '',
      contract.routeDecision.provider !== 'deepseek' ? `wrong provider:${contract.routeDecision.provider}` : '',
      view.owner !== 'Tool Gate' ? `wrong tool owner:${view.owner}` : '',
      view.guards.length > 0 ? `tool view guards:${view.guards.join('|')}` : '',
      hiddenNetworkTools.length < 2 ? 'network tools not hidden by default' : '',
      hiddenExpertTools.length < 4 ? 'expert/frozen/legacy tools not hidden by default' : '',
      activation.visibleOrchestrationModes.join('|') !== 'serial worker|parallel fanout'
        ? 'agent modes not reduced to DSXU visible modes'
        : '',
    ].filter(Boolean)

    return {
      id: scenario.id,
      status: blockers.length === 0 ? 'PASS' : 'FAIL',
      taskType: contract.taskType,
      workflow: contract.workflow,
      route: contract.routeDecision.reason,
      model: contract.routeDecision.model,
      toolViewProfile: view.profile,
      visibleToolCount: view.visibleToolCount,
      hiddenNetworkTools,
      hiddenExpertTools,
      activeCapabilities: activation.activeCapabilityIds,
      blockedCapabilities: activation.blockedCapabilityIds,
      blockers,
      evidence: [
        ...contract.evidence,
        ...view.evidence,
        ...activation.evidence,
      ],
    }
  })
  const blockers = rows.flatMap(row => row.blockers.map(blocker => `${row.id}:${blocker}`))
  const report = {
    schemaVersion: 'dsxu.v8.default-chain-reachability.v1',
    generatedAt: new Date().toISOString(),
    owner: 'Query Loop / Tool Gate / DeepSeek Route / Capability Registry',
    status: blockers.length === 0
      ? 'PASS_V8_DEFAULT_CHAIN_REACHABILITY'
      : 'FAIL_V8_DEFAULT_CHAIN_REACHABILITY',
    publicClaimAllowed: false,
    rows,
    blockers,
    rule:
      'This script verifies V8 default-chain reachability through existing DSXU owners only. It does not add a runtime, execute tools, or create public benchmark claims.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V8_DEFAULT_CHAIN_REACHABILITY_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V8_DEFAULT_CHAIN_REACHABILITY_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V8 Default Chain Reachability',
    '',
    `Status: ${report.status}`,
    '',
    '| id | status | taskType | workflow | route | visibleToolCount | blockers |',
    '|---|---|---|---|---|---:|---|',
    ...rows.map(row =>
      `| ${row.id} | ${row.status} | ${row.taskType} | ${row.workflow} | ${row.route} | ${row.visibleToolCount} | ${row.blockers.join('<br>') || 'none'} |`,
    ),
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({
    status: report.status,
    rows: rows.length,
    blockers,
    outputJson: jsonPath,
    outputMd: mdPath,
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
