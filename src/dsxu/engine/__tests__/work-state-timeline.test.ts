import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDSXUWorkStateTimeline,
  buildDSXURuntimeStateCard,
  buildDSXUTaskEvidencePacket,
  buildDSXULongTaskWorkStateProjection,
  projectDSXUAgentEvidenceToWorkStateEvents,
  projectDSXUMcpSkillEvidenceToWorkStateEvents,
  projectDSXUToolCallResultToWorkStateEvent,
  projectDSXUToolResultContractBoardToWorkStateEvents,
  projectDSXURuntimeEventConsumptionProofToWorkStateEvents,
  projectDSXULongTaskLedgerToWorkStateEvents,
  projectDSXUPlanTemplateToWorkStateEvents,
  projectDSXUToolEvidenceToWorkStateEvents,
  summarizeDSXUWorkStateTimeline,
} from '../work-state-timeline'
import {
  appendLedgerEvent,
  createProgressLedger,
  decideStallRecovery,
  buildRuntimeEventSchemaConsumptionProof,
  recordStallDecision,
} from '../progress-ledger'
import {
  buildToolResultContractConsumptionBoard,
  normalizeProviderToolResultBlock,
} from '../tool-protocol'
import type { DsxuToolEvidencePack } from '../tool-evidence-pack-v1'

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('DSXU senior work-state timeline', () => {
  test('turns a real coding loop into a visible operator contract', () => {
    const timeline = buildDSXUWorkStateTimeline({
      goal: 'Fix checkout total without losing the original task goal',
      plan: [
        'Read source truth and failing tests',
        'Patch the smallest correct owner',
        'Run focused verification',
        'Report cost, risk, evidence, and next action',
      ],
      currentStepId: 'verify-focused-test',
      nextAction: 'prepare final patch report with focused test evidence',
      events: [
        {
          id: 'read-cart-source',
          kind: 'source_truth',
          status: 'completed',
          title: 'Read cart source and regression test',
          owner: 'Source Truth Repair',
          evidence: ['src/cart.ts', 'src/cart.test.ts'],
        },
        {
          id: 'apply-patch',
          kind: 'tool',
          status: 'completed',
          title: 'Applied source patch through Tool Gate',
          owner: 'Tool Gate',
          risk: 'medium',
          evidence: ['tool-trace:apply-patch'],
        },
        {
          id: 'permission-visible',
          kind: 'permission',
          status: 'completed',
          title: 'Write permission was visible and allowed',
          owner: 'Permission Gate',
          evidence: ['permission:allow:file-edit'],
        },
        {
          id: 'failed-first-test',
          kind: 'failure',
          status: 'failed',
          title: 'Initial focused test failed before patch',
          owner: 'Recovery',
          evidence: ['bun test cart.test.ts:failed'],
        },
        {
          id: 'recover-and-rerun',
          kind: 'recovery',
          status: 'completed',
          title: 'Reread failing assertion and reran focused test',
          owner: 'Recovery',
          evidence: ['bun test cart.test.ts:passed'],
        },
        {
          id: 'flash-cost',
          kind: 'cost',
          status: 'completed',
          title: 'Flash-first route and cache/cost evidence',
          owner: 'DeepSeek Model Router / Cost Evidence',
          model: 'deepseek-v4-flash',
          routeReason: 'coding_flash_non_thinking',
          costUsd: 0.0042,
          cacheHitInputTokens: 9000,
          cacheMissInputTokens: 1000,
          outputTokens: 800,
          cacheHitRatePct: 90,
          toolResultChars: 0,
          capsuleId: 'source-truth-capsule#L12',
          evidence: ['route-trace:flash-cost'],
        },
        {
          id: 'final-evidence',
          kind: 'evidence',
          status: 'completed',
          title: 'Final report links patch, test, risk, and cost',
          owner: 'Evidence',
          evidence: ['final-report.json'],
        },
      ],
    })

    expect(timeline.status).toBe('PASS_WORK_STATE_TIMELINE_READY')
    expect(timeline.guards).toEqual([])
    expect(timeline.coverage.hasSourceTruth).toBe(true)
    expect(timeline.coverage.hasPermissionState).toBe(true)
    expect(timeline.coverage.hasRecoveryForFailure).toBe(true)
    expect(timeline.coverage.hasCostState).toBe(true)
    expect(timeline.operatorSummary.join('\n')).toContain('model=deepseek-v4-flash')
    expect(timeline.operatorSummary.join('\n')).toContain('cache_hit_rate=90.0%')
    expect(timeline.operatorSummary.join('\n')).toContain('tool_result_chars=0')
    expect(timeline.operatorSummary.join('\n')).toContain('capsule=source-truth-capsule#L12')
    expect(timeline.operatorSummary.join('\n')).toContain('Next: prepare final patch report')
  })

  test('blocks fake completion when failure or side-effect permission is invisible', () => {
    const timeline = buildDSXUWorkStateTimeline({
      goal: 'Patch a risky shell workflow',
      plan: ['Run command', 'Report pass'],
      nextAction: '',
      events: [
        {
          id: 'run-shell',
          kind: 'tool',
          status: 'failed',
          title: 'Shell command failed',
          owner: 'Tool Gate',
          risk: 'high',
          evidence: ['tool-trace:shell-failed'],
        },
        {
          id: 'failure',
          kind: 'failure',
          status: 'failed',
          title: 'Command exited non-zero',
          owner: 'Recovery',
          evidence: ['exit=1'],
        },
      ],
    })

    expect(timeline.status).toBe('NEEDS_WORK_STATE_TIMELINE_EVIDENCE')
    expect(timeline.guards).toContain('missing source-truth read state')
    expect(timeline.guards).toContain('side-effect tool path lacks visible permission state')
    expect(timeline.guards).toContain('failure has no visible recovery path')
    expect(timeline.guards).toContain('missing model/cost/cache state')
    expect(timeline.guards).toContain('missing next action')
    expect(summarizeDSXUWorkStateTimeline(timeline)).toContain('NEEDS_WORK_STATE_TIMELINE_EVIDENCE')
  })

  test('projects tool, permission, agent, MCP, and skill evidence into one visible state timeline', () => {
    const toolEvidence: DsxuToolEvidencePack = {
      schemaVersion: 'dsxu.tool-evidence-pack.v1',
      packId: 'pack-edit-1',
      queryTurnId: 'turn-1',
      toolUseId: 'toolu-edit-1',
      originalToolId: 'Edit',
      resolvedToolId: 'Edit',
      capabilityTags: ['edit'],
      readWriteClass: 'write-local',
      permissionDecision: 'granted',
      permissionReason: 'scoped edit allowed after Tool Gate review',
      gateDecision: 'require_confirmation',
      executionDecision: 'execute_guarded',
      visibleState: 'completed',
      resultStatus: 'success',
      failureClass: 'unknown',
      recoveryHint: 'no recovery needed',
      artifactPaths: ['.dsxu/trace/tool-edit-1.json'],
      costUsage: {
        model: 'deepseek-v4-flash',
        routeReason: 'coding_flash_non_thinking',
        cacheHitInputTokens: 1200,
        cacheMissInputTokens: 80,
        outputTokens: 210,
        toolCalls: 1,
        costUsd: 0.0007,
      },
      traceId: 'tool-approval-edit-1',
      lifecycle: [
        { event: 'tool_preflight_started', at: 1, summary: 'preflight Edit' },
        { event: 'tool_permission_evaluated', at: 2, summary: 'permission allowed' },
        { event: 'tool_permission_wait_visible', at: 3, summary: 'write confirmation visible' },
        { event: 'tool_execution_started', at: 4, summary: 'execute Edit' },
        { event: 'tool_execution_completed', at: 5, summary: 'tool returned success' },
        { event: 'tool_postflight_recorded', at: 6, summary: 'recorded Edit' },
      ],
      createdAt: 1,
    }
    const events = [
      {
        id: 'source-capsule',
        kind: 'source_truth' as const,
        status: 'completed' as const,
        title: 'Source capsule anchored before edit',
        owner: 'Source Truth Repair',
        evidence: ['capsule:src/checkout.ts#L42'],
      },
      ...projectDSXUToolEvidenceToWorkStateEvents([toolEvidence]),
      {
        id: 'flash-route',
        kind: 'cost' as const,
        status: 'completed' as const,
        title: 'Flash route with cache evidence',
        owner: 'DeepSeek Model Router / Cost Evidence',
        model: 'deepseek-v4-flash',
        routeReason: 'coding_flash_non_thinking',
        costUsd: 0.0007,
        cacheHitInputTokens: 1200,
        cacheMissInputTokens: 80,
        outputTokens: 210,
        cacheHitRatePct: 93.8,
        evidence: ['route:flash', 'cacheHitRatePct:93.8'],
      },
      ...projectDSXUAgentEvidenceToWorkStateEvents([
        {
          agentId: 'worker-verifier',
          status: 'completed',
          title: 'Worker verifier returned summary evidence only',
          scope: 'focused verification',
          evidence: ['worker-summary:focused test passed', 'hash:abc123'],
          artifactPaths: ['.dsxu/trace/worker-verifier.json'],
        },
      ]),
      ...projectDSXUMcpSkillEvidenceToWorkStateEvents([
        {
          id: 'skill-lint',
          registryKind: 'skill',
          decision: 'selected',
          title: 'Lint skill selected by DSXU registry priority',
          skillName: 'lint-fix',
          permissionBoundary: 'Tool Gate scoped read/write',
          evidence: ['priority:90', 'conflict:prefer-higher-priority'],
          artifactPaths: ['.dsxu/trace/skill-lint.json'],
        },
        {
          id: 'mcp-docs',
          registryKind: 'mcp',
          decision: 'registered',
          title: 'MCP server registered as adapter boundary',
          mcpServer: 'docs-search',
          toolName: 'MCPTool',
          permissionBoundary: 'no standalone runtime; DSXU Tool Gate only',
          evidence: ['schema:verified', 'secrets:redacted'],
          artifactPaths: ['.dsxu/trace/mcp-docs.json'],
        },
      ]),
      {
        id: 'final-evidence',
        kind: 'evidence' as const,
        status: 'completed' as const,
        title: 'Final report binds state to evidence',
        owner: 'Evidence / Release',
        evidence: ['final-report:timeline-ready'],
      },
    ]

    const timeline = buildDSXUWorkStateTimeline({
      goal: 'Prove DSXU visible state is the only Tool/Permission/Agent/MCP projection',
      plan: ['Read source capsule', 'Project tool evidence', 'Project agent and registry evidence', 'Report next action'],
      currentStepId: 'final-evidence',
      nextAction: 'continue EP-05 DeepSeek cost-quality gate',
      events,
    })

    expect(timeline.status).toBe('PASS_WORK_STATE_TIMELINE_READY')
    const summary = timeline.operatorSummary.join('\n')
    expect(summary).toContain('tool=Edit')
    expect(summary).toContain('tool_use=toolu-edit-1')
    expect(summary).toContain('permission=granted')
    expect(summary).toContain('gate=require_confirmation')
    expect(summary).toContain('agent=worker-verifier')
    expect(summary).toContain('skill=lint-fix')
    expect(summary).toContain('mcp=docs-search')
    expect(summary).toContain('registry=registered')
    expect(summary).toContain('artifact=.dsxu/trace/tool-edit-1.json')
  })

  test('projects plan-execute-verify templates into work-state instead of a second coordinator runtime', () => {
    const planExecuteVerifyNodes = [
      {
        id: 'plan',
        kind: 'planner',
        deps: [],
        config: {
          phase: 'plan',
          requiredOutput: ['targetFiles', 'editIntent', 'verificationCommands'],
        },
      },
      {
        id: 'execute',
        kind: 'executor',
        deps: ['plan'],
        config: {
          phase: 'execute',
          requirePlanMatch: true,
          allowedWritesFrom: 'plan.targetFiles',
        },
      },
      {
        id: 'verify',
        kind: 'verifier',
        deps: ['execute'],
        config: {
          phase: 'verify',
          gates: ['tdd-gate', 'static-analysis', 'declared-tests'],
        },
      },
    ]
    const events = [
      ...projectDSXUPlanTemplateToWorkStateEvents({
        templateId: 'plan-execute-verify',
        title: 'Plan / execute / verify template for code-changing work',
        nodes: planExecuteVerifyNodes,
        evidence: ['source:DSXU-owned work-state PEV template fixture', 'owner:PlanGraph / Work-State'],
      }),
      {
        id: 'source-capsule',
        kind: 'source_truth' as const,
        status: 'completed' as const,
        title: 'Source capsule anchors the planned change',
        owner: 'Source Truth Repair',
        evidence: ['capsule:src/sample.ts#L1'],
      },
      {
        id: 'tool-gate',
        kind: 'tool' as const,
        status: 'planned' as const,
        title: 'Execution remains in Tool Gate',
        owner: 'Tool Gate',
        risk: 'medium' as const,
        evidence: ['tool-gate:existing-mainline'],
      },
      {
        id: 'permission-visible',
        kind: 'permission' as const,
        status: 'planned' as const,
        title: 'Side-effect permission remains visible',
        owner: 'Permission Gate',
        evidence: ['permission:planned-visible'],
      },
      {
        id: 'cost-visible',
        kind: 'cost' as const,
        status: 'planned' as const,
        title: 'DeepSeek route/cost/cache owner remains visible',
        owner: 'DeepSeek Model Router / Cost Evidence',
        evidence: ['route:flash-first'],
      },
    ]

    const timeline = buildDSXUWorkStateTimeline({
      goal: 'Expose plan-execute-verify as DSXU work-state evidence without a second runtime',
      plan: planExecuteVerifyNodes.map(node => node.id),
      nextAction: 'execute through query-loop, Tool Gate, and VerificationKernel',
      events,
    })

    expect(timeline.status).toBe('PASS_WORK_STATE_TIMELINE_READY')
    const summary = timeline.operatorSummary.join('\n')
    expect(summary).toContain('plan-execute-verify')
    expect(summary).toContain('PlanGraph / Work-State')
    expect(summary).toContain('Tool Gate')
    expect(summary).not.toContain('Real executor not yet wired')
  })

  test('keeps blocked permission and blocked registry evidence from looking ready', () => {
    const blockedToolEvidence: DsxuToolEvidencePack = {
      schemaVersion: 'dsxu.tool-evidence-pack.v1',
      packId: 'pack-shell-1',
      queryTurnId: 'turn-2',
      toolUseId: 'toolu-shell-1',
      originalToolId: 'Bash',
      resolvedToolId: 'Bash',
      capabilityTags: ['execute'],
      readWriteClass: 'write-external',
      permissionDecision: 'denied',
      permissionReason: 'external side effect denied',
      gateDecision: 'block',
      executionDecision: 'deny',
      visibleState: 'denied',
      resultStatus: 'blocked',
      failureClass: 'permission',
      recoveryHint: 'choose safer alternative or downgrade operation',
      artifactPaths: [],
      traceId: 'tool-approval-shell-1',
      lifecycle: [
        { event: 'tool_preflight_started', at: 1, summary: 'preflight Bash' },
        { event: 'tool_permission_evaluated', at: 2, summary: 'permission denied' },
        { event: 'tool_recovery_planned', at: 3, summary: 'choose safer alternative' },
        { event: 'tool_postflight_recorded', at: 4, summary: 'recorded Bash' },
      ],
      createdAt: 2,
    }

    const timeline = buildDSXUWorkStateTimeline({
      goal: 'Reject unsafe external mutation',
      plan: ['Show permission denial', 'Stop unsafe registry path'],
      nextAction: 'ask owner for explicit approval or use read-only alternative',
      events: [
        {
          id: 'source-capsule',
          kind: 'source_truth',
          status: 'completed',
          title: 'Source truth exists',
          owner: 'Source Truth Repair',
          evidence: ['capsule:src/index.ts#L1'],
        },
        ...projectDSXUToolEvidenceToWorkStateEvents([blockedToolEvidence]),
        {
          id: 'cost-visible',
          kind: 'cost',
          status: 'completed',
          title: 'No provider call was needed for blocked tool',
          owner: 'DeepSeek Model Router / Cost Evidence',
          evidence: ['providerCall:false'],
        },
        ...projectDSXUMcpSkillEvidenceToWorkStateEvents([
          {
            id: 'unsafe-mcp',
            registryKind: 'mcp',
            decision: 'blocked',
            title: 'Unsafe MCP write adapter rejected',
            mcpServer: 'unsafe-writer',
            permissionBoundary: 'blocked before runtime execution',
            evidence: ['schema:missing', 'permission:denied'],
          },
        ]),
      ],
    })

    expect(timeline.status).toBe('NEEDS_WORK_STATE_TIMELINE_EVIDENCE')
    expect(timeline.guards).toContain('side-effect tool path has blocked permission state')
    expect(timeline.operatorSummary.join('\n')).toContain('registry=blocked')
  })

  test('stays a visible-state projection rather than a second runtime', () => {
    const source = readSource('src/dsxu/engine/work-state-timeline.ts')

    expect(source).not.toContain('executeTool(')
    expect(source).not.toContain('new QueryEngine')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('Bun.spawn')
    expect(source).toContain('projectDSXUPlanTemplateToWorkStateEvents')
    expect(source).toContain('PASS_WORK_STATE_TIMELINE_READY')
    expect(source).toContain('side-effect tool path lacks visible permission state')
  })

  test('builds a small Runtime State Card that gates final claims from evidence, not model text', () => {
    const incompleteTimeline = buildDSXUWorkStateTimeline({
      goal: 'Fix checkout regression',
      plan: ['Read source', 'Patch owner', 'Verify'],
      nextAction: '',
      events: [
        {
          id: 'tool-edit',
          kind: 'tool',
          status: 'completed',
          title: 'Edit applied',
          owner: 'Tool Gate',
          risk: 'medium',
          evidence: ['tool:edit'],
        },
      ],
    })
    const card = buildDSXURuntimeStateCard({
      timeline: incompleteTimeline,
      state: 'edit',
      taskId: 'task-1',
      turnId: 'turn-1',
    })

    expect(card.schemaVersion).toBe('dsxu.runtime-state-card.v1')
    expect(card.allowedNext.length).toBeLessThanOrEqual(3)
    expect(card.allowedNext).toContain('read_source_truth')
    expect(card.blockedActions).toContain('claim_pass_or_done')
    expect(card.blockedActions).toContain('edit_without_source_truth')
    expect(card.finalClaimAllowed).toBe(false)
    expect(card.evidenceRequired.join('\n')).toContain('missing source-truth read state')
    expect(card.recoveryIfFails).toBe('ask-human')

    const completeTimeline = buildDSXUWorkStateTimeline({
      goal: 'Fix checkout regression',
      plan: ['Read source', 'Patch owner', 'Verify'],
      nextAction: 'emit final answer with evidence',
      events: [
        {
          id: 'source',
          kind: 'source_truth',
          status: 'completed',
          title: 'Source truth read',
          owner: 'Source Truth Repair',
          evidence: ['src/checkout.ts'],
        },
        {
          id: 'tool-edit',
          kind: 'tool',
          status: 'completed',
          title: 'Edit applied',
          owner: 'Tool Gate',
          risk: 'medium',
          evidence: ['tool:edit'],
        },
        {
          id: 'permission',
          kind: 'permission',
          status: 'completed',
          title: 'Edit permission visible',
          owner: 'Permission Gate',
          evidence: ['permission:allow'],
        },
        {
          id: 'tool',
          kind: 'tool',
          status: 'completed',
          title: 'Read-only verification tool completed',
          owner: 'Tool Gate',
          risk: 'low',
          evidence: ['tool:verify'],
        },
        {
          id: 'cost',
          kind: 'cost',
          status: 'completed',
          title: 'Flash route visible',
          owner: 'DeepSeek Model Router / Cost Evidence',
          model: 'deepseek-v4-flash',
          evidence: ['route:flash'],
        },
        {
          id: 'evidence',
          kind: 'evidence',
          status: 'completed',
          title: 'Focused test evidence attached',
          owner: 'Evidence',
          evidence: ['bun test checkout.test.ts:pass'],
        },
      ],
    })
    const finalCard = buildDSXURuntimeStateCard({
      timeline: completeTimeline,
      state: 'final',
    })
    expect(finalCard.finalClaimAllowed).toBe(true)
    expect(finalCard.allowedNext).toEqual(['emit_final_answer'])
  })

  test('projects canonical ToolCallResult and task evidence packets without a second tool runtime', () => {
    const toolEvent = projectDSXUToolCallResultToWorkStateEvent({
      callId: 'toolu-1',
      toolName: 'Bash',
      taskId: 'task-1',
      turnId: 'turn-2',
      result: {
        ok: false,
        outputText: 'permission denied',
        events: [
          {
            type: 'tool_call_failed',
            callId: 'toolu-1',
            toolName: 'Bash',
            timestamp: 1,
            data: { reason: 'permission denied' },
          },
        ],
        error: {
          type: 'PERMISSION_DENIED',
          message: 'permission denied',
          retryable: false,
        },
        metadata: {
          duration: 12,
          executorKind: 'dsxu_native',
          usedBridge: false,
        },
      },
    })
    expect(toolEvent.status).toBe('blocked')
    expect(toolEvent.taskId).toBe('task-1')
    expect(toolEvent.evidence?.join('\n')).toContain('executor:dsxu_native')

    const timeline = buildDSXUWorkStateTimeline({
      goal: 'Package task evidence',
      plan: ['Read', 'Edit', 'Verify'],
      nextAction: 'show Data Still Needed',
      requiresPermissionVisibility: false,
      events: [
        {
          id: 'source',
          kind: 'source_truth',
          status: 'completed',
          title: 'Read source',
          owner: 'Source Truth Repair',
          evidence: ['src/a.ts'],
        },
        {
          id: 'tool',
          kind: 'tool',
          status: 'completed',
          title: 'Read-only verification tool completed',
          owner: 'Tool Gate',
          risk: 'low',
          evidence: ['tool:verify'],
        },
        {
          id: 'cost',
          kind: 'cost',
          status: 'completed',
          title: 'Flash route',
          owner: 'DeepSeek Model Router / Cost Evidence',
          model: 'deepseek-v4-flash',
          costUsd: 0.001,
          cacheHitRatePct: 80,
          toolResultChars: 120,
          evidence: ['route:flash'],
        },
        {
          id: 'evidence',
          kind: 'evidence',
          status: 'completed',
          title: 'Focused verification',
          owner: 'Evidence',
          evidence: ['bun test:pass'],
        },
      ],
    })
    const packet = buildDSXUTaskEvidencePacket({
      timeline,
      modifiedFiles: ['src/a.ts'],
      checks: ['bun test src/a.test.ts'],
      results: ['pass'],
      rollback: 'restore previous content hash if focused verification fails',
    })
    expect(packet.schemaVersion).toBe('dsxu.task-evidence-packet.v1')
    expect(packet.finalClaimAllowed).toBe(true)
    expect(packet.modelCostCache.join('\n')).toContain('cacheHitRatePct:80')
    expect(packet.modifiedFiles).toEqual(['src/a.ts'])
  })

  test('projects long-task ledger and stall recovery into work-state, TUI preview, and final report evidence', () => {
    let ledger = createProgressLedger('task-ledger-projection', 'session-ledger', 'verify')
    ledger = appendLedgerEvent(ledger, {
      kind: 'verification',
      owner: 'VerificationKernel',
      summary: 'Focused test failed twice',
      evidence: ['bun test checkout.test.ts:fail'],
      metadata: { ok: false },
    })
    const decision = decideStallRecovery({
      signals: [
        {
          kind: 'repeated_verification_failure',
          count: 2,
          severity: 'high',
          evidence: ['same assertion failed twice'],
        },
      ],
    })
    ledger = recordStallDecision(ledger, decision)

    const events = projectDSXULongTaskLedgerToWorkStateEvents(ledger)
    expect(events.some(event => event.kind === 'recovery')).toBe(true)
    expect(events.map(event => event.evidence?.join('\n')).join('\n')).toContain('runtimeEvent:dsxu.runtime-event.v1')

    const projection = buildDSXULongTaskWorkStateProjection({
      ledger,
      goal: 'Recover checkout regression without hiding the failure',
      plan: ['Read failing assertion', 'Replan patch', 'Rerun focused test'],
    })

    expect(projection.projection.schemaVersion).toBe('dsxu.long-task-work-state-projection.v1')
    expect(projection.projection.hasStallDecision).toBe(true)
    expect(projection.projection.tuiPreview.join('\n')).toContain('Focused test failed twice')
    expect(projection.timeline.status).toBe('PASS_WORK_STATE_TIMELINE_READY')
    expect(projection.stateCard.finalClaimAllowed).toBe(false)
    expect(projection.taskEvidencePacket.finalClaimAllowed).toBe(false)
    expect(projection.taskEvidencePacket.risks).toContain('stall:repeated_verification_failure')
  })

  test('projects tool-result and runtime-event consumption proofs into the same visible work-state timeline', () => {
    const toolResult = normalizeProviderToolResultBlock(
      {
        tool_use_id: 'toolu-contract',
        content: 'bounded preview with artifact path',
      },
      'Bash',
      Date.now(),
    )
    const toolContractBoard = buildToolResultContractConsumptionBoard({
      result: toolResult,
      boundaryKind: 'provider_message',
      requiredConsumers: ['work-state', 'ledger', 'release-evidence'],
      consumers: [
        {
          consumer: 'work-state',
          owner: 'Work-State',
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          usesCanonicalResult: true,
          evidenceIds: ['work-state:tool-result-contract'],
        },
        {
          consumer: 'ledger',
          owner: 'Progress Ledger',
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          usesCanonicalResult: true,
          evidenceIds: ['ledger:tool-result-contract'],
        },
        {
          consumer: 'release-evidence',
          owner: 'Evidence / Release Claim Binder',
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          usesCanonicalResult: true,
          evidenceIds: ['release:tool-result-contract'],
        },
      ],
    })

    let ledger = createProgressLedger('task-visible-proof', 'session-visible-proof', 'verify')
    ledger = appendLedgerEvent(ledger, {
      kind: 'goal',
      owner: 'Query Loop',
      summary: 'Goal accepted',
      evidence: ['goal:visible-proof'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'plan',
      owner: 'PlanGraph',
      summary: 'Plan accepted',
      evidence: ['plan:visible-proof'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'tool',
      owner: 'Tool Gate',
      summary: 'Tool result normalized',
      evidence: ['tool:canonical-result'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'verification',
      owner: 'VerificationKernel',
      summary: 'Focused verification passed',
      evidence: ['verify:focused-pass'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'recovery',
      owner: 'Recovery / GearBox',
      summary: 'No recovery needed',
      evidence: ['recovery:none'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'evidence',
      owner: 'Evidence / Release Claim Binder',
      summary: 'Evidence attached',
      evidence: ['evidence:attached'],
    })
    const runtimeProof = buildRuntimeEventSchemaConsumptionProof({
      events: ledger.events ?? [],
    })

    const events = [
      ...projectDSXUToolResultContractBoardToWorkStateEvents(toolContractBoard),
      ...projectDSXURuntimeEventConsumptionProofToWorkStateEvents(runtimeProof),
    ]
    const timeline = buildDSXUWorkStateTimeline({
      goal: 'Expose DSXU contract proofs in visible state',
      plan: ['Normalize tool result', 'Project runtime event proof', 'Attach final evidence'],
      events: [
        {
          id: 'source',
          kind: 'source_truth',
          status: 'completed',
          title: 'Source owner checked',
          owner: 'Source Truth Repair',
          evidence: ['source:owner'],
        },
        ...events,
        {
          id: 'tool',
          kind: 'tool',
          status: 'completed',
          title: 'Tool path consumed canonical result',
          owner: 'Tool Gate',
          evidence: ['tool:canonical-result'],
        },
        {
          id: 'cost',
          kind: 'cost',
          status: 'completed',
          title: 'Flash route cost/cache attached',
          owner: 'DeepSeek Model Router / Cost Evidence',
          model: 'deepseek-v4-flash',
          costUsd: 0.001,
          cacheHitRatePct: 70,
          evidence: ['route:flash', 'cache:stable-prefix'],
        },
      ],
      nextAction: 'final report may cite contract proof evidence',
      requiresPermissionVisibility: false,
    })

    expect(events.map(event => event.title)).toEqual([
      'Tool Result Contract consumption',
      'Runtime Event Schema consumption',
    ])
    expect(timeline.status).toBe('PASS_WORK_STATE_TIMELINE_READY')
    expect(timeline.operatorSummary.join('\n')).toContain(
      'Tool Result Contract consumption',
    )
    expect(timeline.operatorSummary.join('\n')).toContain(
      'Runtime Event Schema consumption',
    )
    expect(timeline.events.map(event => event.evidence?.join('\n')).join('\n')).toContain(
      'status:PASS_TOOL_RESULT_CONTRACT_CONSUMPTION',
    )
  })
})
