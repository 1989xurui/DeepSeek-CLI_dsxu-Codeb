import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DsxuToolEvidencePack } from '../src/dsxu/engine/tool-evidence-pack-v1'
import {
  buildDSXUWorkStateTimeline,
  projectDSXUAgentEvidenceToWorkStateEvents,
  projectDSXUMcpSkillEvidenceToWorkStateEvents,
  projectDSXUToolEvidenceToWorkStateEvents,
} from '../src/dsxu/engine/work-state-timeline'

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_VISIBLE_STATE_ACCEPTANCE_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_VISIBLE_STATE_ACCEPTANCE_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_VISIBLE_STATE_ACCEPTANCE_${DATE}.md`)

function toolPack(input: {
  packId: string
  toolUseId: string
  toolId: string
  readWriteClass: DsxuToolEvidencePack['readWriteClass']
  permissionDecision: DsxuToolEvidencePack['permissionDecision']
  gateDecision: DsxuToolEvidencePack['gateDecision']
  executionDecision: DsxuToolEvidencePack['executionDecision']
  visibleState: DsxuToolEvidencePack['visibleState']
  resultStatus: DsxuToolEvidencePack['resultStatus']
  traceId: string
  artifactPaths?: string[]
}): DsxuToolEvidencePack {
  const lifecycle: DsxuToolEvidencePack['lifecycle'] = [
    { event: 'tool_preflight_started', at: 1, summary: `preflight ${input.toolId}` },
    {
      event: 'tool_permission_evaluated',
      at: 2,
      summary: input.permissionDecision === 'denied' ? 'permission denied' : 'permission allowed',
    },
  ]
  if (input.gateDecision === 'require_confirmation') {
    lifecycle.push({ event: 'tool_permission_wait_visible', at: 3, summary: 'confirmation visible' })
  }
  if (input.resultStatus === 'success') {
    lifecycle.push(
      { event: 'tool_execution_started', at: 4, summary: `execute ${input.toolId}` },
      { event: 'tool_execution_completed', at: 5, summary: 'tool returned success' },
    )
  }
  if (input.resultStatus === 'blocked') {
    lifecycle.push({ event: 'tool_recovery_planned', at: 4, summary: 'choose safer alternative' })
  }
  lifecycle.push({ event: 'tool_postflight_recorded', at: 6, summary: `recorded ${input.toolId}` })

  return {
    schemaVersion: 'dsxu.tool-evidence-pack.v1',
    packId: input.packId,
    queryTurnId: 'turn-visible-state-1',
    toolUseId: input.toolUseId,
    originalToolId: input.toolId,
    resolvedToolId: input.toolId,
    capabilityTags: input.toolId === 'Edit' ? ['edit'] : ['execute'],
    readWriteClass: input.readWriteClass,
    permissionDecision: input.permissionDecision,
    permissionReason: input.permissionDecision === 'denied'
      ? 'external side effect denied by Tool Gate'
      : 'scoped operation allowed by Tool Gate',
    gateDecision: input.gateDecision,
    executionDecision: input.executionDecision,
    visibleState: input.visibleState,
    resultStatus: input.resultStatus,
    failureClass: input.resultStatus === 'blocked' ? 'permission' : 'unknown',
    recoveryHint: input.resultStatus === 'blocked' ? 'choose safer alternative' : 'no recovery needed',
    artifactPaths: input.artifactPaths ?? [],
    traceId: input.traceId,
    lifecycle,
    createdAt: 1,
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  const editPack = toolPack({
    packId: 'visible-pack-edit',
    toolUseId: 'toolu-visible-edit',
    toolId: 'Edit',
    readWriteClass: 'write-local',
    permissionDecision: 'granted',
    gateDecision: 'require_confirmation',
    executionDecision: 'execute_guarded',
    visibleState: 'completed',
    resultStatus: 'success',
    traceId: 'tool-approval-visible-edit',
    artifactPaths: ['.dsxu/trace/visible-edit.json'],
  })
  const blockedPack = toolPack({
    packId: 'visible-pack-shell-blocked',
    toolUseId: 'toolu-visible-shell',
    toolId: 'Bash',
    readWriteClass: 'write-external',
    permissionDecision: 'denied',
    gateDecision: 'block',
    executionDecision: 'deny',
    visibleState: 'denied',
    resultStatus: 'blocked',
    traceId: 'tool-approval-visible-shell',
  })

  const readyTimeline = buildDSXUWorkStateTimeline({
    goal: 'Make DSXU senior coding state visible across Tool, Permission, Agent, MCP, Skill, cost, and evidence',
    plan: [
      'Anchor source truth',
      'Project Tool Gate evidence',
      'Project permission decision',
      'Project worker and registry evidence',
      'Show DeepSeek route/cost/cache and next action',
    ],
    currentStepId: 'visible-final-evidence',
    nextAction: 'continue EP-05 DeepSeek cost-quality gate after visible-state acceptance',
    events: [
      {
        id: 'visible-source-truth',
        kind: 'source_truth',
        status: 'completed',
        title: 'Source truth capsule is visible',
        owner: 'Source Truth Repair',
        evidence: ['capsule:src/dsxu/engine/work-state-timeline.ts#L1'],
      },
      ...projectDSXUToolEvidenceToWorkStateEvents([editPack]),
      {
        id: 'visible-cost-route',
        kind: 'cost',
        status: 'completed',
        title: 'DeepSeek Flash-first route and cache are visible',
        owner: 'DeepSeek Model Router / Cost Evidence',
        model: 'deepseek-v4-flash',
        routeReason: 'coding_flash_non_thinking',
        costUsd: 0.0009,
        cacheHitInputTokens: 1800,
        cacheMissInputTokens: 120,
        outputTokens: 260,
        cacheHitRatePct: 93.8,
        toolResultChars: 0,
        evidence: ['route:deepseek-v4-flash', 'cacheHitRatePct:93.8', 'toolResultChars:0'],
      },
      ...projectDSXUAgentEvidenceToWorkStateEvents([
        {
          agentId: 'visible-worker-verifier',
          status: 'completed',
          title: 'Worker verifier returned evidence envelope',
          scope: 'focused verification',
          evidence: ['summary:focused verification passed', 'path:.dsxu/trace/worker-visible.json', 'hash:visible-worker-hash'],
          artifactPaths: ['.dsxu/trace/worker-visible.json'],
        },
      ]),
      ...projectDSXUMcpSkillEvidenceToWorkStateEvents([
        {
          id: 'skill-conflict',
          registryKind: 'skill',
          decision: 'selected',
          title: 'Skill selected by DSXU priority and conflict policy',
          skillName: 'lint-fix',
          permissionBoundary: 'Tool Gate scoped mutation',
          evidence: ['priority:90', 'conflictPolicy:prefer-higher-priority'],
          artifactPaths: ['.dsxu/trace/skill-conflict.json'],
        },
        {
          id: 'mcp-adapter',
          registryKind: 'mcp',
          decision: 'registered',
          title: 'MCP adapter registered without standalone runtime',
          mcpServer: 'docs-search',
          toolName: 'MCPTool',
          permissionBoundary: 'DSXU Tool Gate only',
          evidence: ['schema:verified', 'secret:redacted'],
          artifactPaths: ['.dsxu/trace/mcp-adapter.json'],
        },
      ]),
      {
        id: 'visible-final-evidence',
        kind: 'evidence',
        status: 'completed',
        title: 'Visible-state acceptance report links all owners',
        owner: 'Evidence / Release',
        evidence: ['report:DSXU_VISIBLE_STATE_ACCEPTANCE_20260516.md'],
      },
    ],
  })

  const blockedTimeline = buildDSXUWorkStateTimeline({
    goal: 'Reject fake ready state when side-effect permission is denied',
    plan: ['Project denied permission', 'Keep next action visible'],
    nextAction: 'request owner approval or switch to read-only alternative',
    events: [
      {
        id: 'blocked-source-truth',
        kind: 'source_truth',
        status: 'completed',
        title: 'Source truth is visible',
        owner: 'Source Truth Repair',
        evidence: ['capsule:src/index.ts#L1'],
      },
      ...projectDSXUToolEvidenceToWorkStateEvents([blockedPack]),
      {
        id: 'blocked-cost',
        kind: 'cost',
        status: 'completed',
        title: 'Blocked path has no model cost claim',
        owner: 'DeepSeek Model Router / Cost Evidence',
        evidence: ['providerCall:false'],
      },
      {
        id: 'blocked-evidence',
        kind: 'evidence',
        status: 'completed',
        title: 'Blocked permission remains evidence',
        owner: 'Evidence / Release',
        evidence: ['blocked:permission-denied'],
      },
    ],
  })

  const pass =
    readyTimeline.status === 'PASS_WORK_STATE_TIMELINE_READY' &&
    blockedTimeline.status === 'NEEDS_WORK_STATE_TIMELINE_EVIDENCE' &&
    blockedTimeline.guards.includes('side-effect tool path has blocked permission state') &&
    readyTimeline.operatorSummary.some(line => line.includes('tool=Edit')) &&
    readyTimeline.operatorSummary.some(line => line.includes('permission=granted')) &&
    readyTimeline.operatorSummary.some(line => line.includes('agent=visible-worker-verifier')) &&
    readyTimeline.operatorSummary.some(line => line.includes('mcp=docs-search')) &&
    readyTimeline.operatorSummary.some(line => line.includes('skill=lint-fix'))

  const report = {
    schemaVersion: 'dsxu.visible-state-acceptance.v1',
    generatedAt: new Date().toISOString(),
    status: pass ? 'PASS_VISIBLE_STATE_ACCEPTANCE' : 'FAIL_VISIBLE_STATE_ACCEPTANCE',
    readyTimeline: {
      status: readyTimeline.status,
      guards: readyTimeline.guards,
      events: readyTimeline.events.length,
      operatorSummary: readyTimeline.operatorSummary,
      coverage: readyTimeline.coverage,
    },
    blockedTimeline: {
      status: blockedTimeline.status,
      guards: blockedTimeline.guards,
      events: blockedTimeline.events.length,
      operatorSummary: blockedTimeline.operatorSummary,
      coverage: blockedTimeline.coverage,
    },
    ownerCoverage: {
      sourceTruth: readyTimeline.coverage.hasSourceTruth,
      tool: readyTimeline.coverage.hasToolState,
      permission: readyTimeline.coverage.hasPermissionState,
      cost: readyTimeline.coverage.hasCostState,
      agent: readyTimeline.events.some(event => event.kind === 'agent' && event.agentId),
      mcp: readyTimeline.events.some(event => event.mcpServer),
      skill: readyTimeline.events.some(event => event.skillName),
      evidence: readyTimeline.coverage.hasEvidence,
    },
    releaseClaimBoundary: {
      visibleStateClaimAllowed: pass,
      liveTuiClaimAllowed: false,
      note: 'This proves the DSXU-owned projection contract and report evidence. Live TUI/window parity still requires a separate interactive acceptance run.',
    },
  }

  await mkdir(GENERATED_DIR, { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const csvRows = [
    ['case', 'status', 'guards', 'events', 'tool', 'permission', 'agent', 'mcp', 'skill'],
    [
      'ready',
      readyTimeline.status,
      readyTimeline.guards.join('; '),
      String(readyTimeline.events.length),
      String(report.ownerCoverage.tool),
      String(report.ownerCoverage.permission),
      String(report.ownerCoverage.agent),
      String(report.ownerCoverage.mcp),
      String(report.ownerCoverage.skill),
    ],
    [
      'blocked-permission',
      blockedTimeline.status,
      blockedTimeline.guards.join('; '),
      String(blockedTimeline.events.length),
      'true',
      'blocked',
      'n/a',
      'n/a',
      'n/a',
    ],
  ]
  await writeFile(OUT_CSV, csvRows.map(row => row.map(csvCell).join(',')).join('\n'), 'utf8')

  const md = [
    `# DSXU Visible State Acceptance - ${DATE}`,
    '',
    `Status: ${report.status}`,
    '',
    '## Owner Coverage',
    '',
    `- sourceTruth: ${report.ownerCoverage.sourceTruth}`,
    `- tool: ${report.ownerCoverage.tool}`,
    `- permission: ${report.ownerCoverage.permission}`,
    `- cost: ${report.ownerCoverage.cost}`,
    `- agent: ${report.ownerCoverage.agent}`,
    `- mcp: ${report.ownerCoverage.mcp}`,
    `- skill: ${report.ownerCoverage.skill}`,
    `- evidence: ${report.ownerCoverage.evidence}`,
    '',
    '## Ready Timeline',
    '',
    `- status: ${readyTimeline.status}`,
    `- events: ${readyTimeline.events.length}`,
    `- guards: ${readyTimeline.guards.length === 0 ? 'none' : readyTimeline.guards.join('; ')}`,
    '',
    '## Blocked Permission Guard',
    '',
    `- status: ${blockedTimeline.status}`,
    `- guards: ${blockedTimeline.guards.join('; ')}`,
    '',
    '## Boundary',
    '',
    '- This is DSXU-owned visible-state projection evidence, not a second runtime.',
    '- Tool, Permission, Agent, MCP, Skill, DeepSeek route/cost/cache, source truth, and final evidence share the same timeline contract.',
    '- Live TUI/window parity remains a separate acceptance run before public UI claims.',
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  if (!pass) {
    console.error(report.status)
    process.exit(1)
  }
  console.log(report.status)
  console.log(`readyEvents=${readyTimeline.events.length}`)
  console.log(`blockedGuards=${blockedTimeline.guards.join('; ')}`)
}

await main()
