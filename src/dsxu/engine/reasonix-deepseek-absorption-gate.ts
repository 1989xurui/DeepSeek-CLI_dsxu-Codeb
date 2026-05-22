import { DeepSeekAdapter } from '../../services/api/deepseek-adapter'
import { buildDSXUDeepSeekRepairAdmissionLedger } from './deepseek-cost-quality-board'
import { buildDSXUPromptPrefixCachePlan } from './prompt-prefix-cache-builder'
import { buildDsxuIdenticalToolCallStormGate } from './query-loop-gate-state-v1'
import { buildDSXUReasonixCacheHardeningProof } from './reasonix-cache-hardening'

export type DSXUReasonixMetricName =
  | 'cacheHitRatePct'
  | 'toolResultChars'
  | 'tuiRenderResizeLatencyMs'
  | 'wallClockMs'
  | 'proAdmissionCount'
  | 'artifactLogSizeBytes'

export type DSXUReasonixMetricState = 'measured' | 'required_not_yet_measured' | 'not_applicable'

export type DSXUReasonixAbsorptionMetric = {
  name: DSXUReasonixMetricName
  state: DSXUReasonixMetricState
  value?: number
  unit?: string
  evidence: string
}

export type DSXUReasonixAcceptancePacket =
  | 'RDX-CACHE-01'
  | 'RDX-CACHE-02'
  | 'RDX-CACHE-03'
  | 'RDX-CACHE-04'
  | 'RDX-CACHE-05'
  | 'RDX-TOOL-01'
  | 'RDX-TOOL-02'
  | 'RDX-TOOL-03'
  | 'RDX-TOOL-04'
  | 'RDX-TOOL-05'

export type DSXUReasonixPacketStatus =
  | 'implemented_baseline'
  | 'partial_needs_code'
  | 'needs_real_code_test'
  | 'blocked_until_real_window'

export type DSXUReasonixPacketEvidence = {
  packet: DSXUReasonixAcceptancePacket
  owner: string
  status: DSXUReasonixPacketStatus
  evidence: readonly string[]
  nextAction: string
}

export type DSXUReasonixDeepSeekAbsorptionGate = {
  schemaVersion: 'dsxu.reasonix.deepseek-absorption-gate.v1'
  status:
    | 'RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS'
    | 'RDX_ACCEPTANCE_GATE_PASS_READY_FOR_REAL_WINDOW'
    | 'RDX_ACCEPTANCE_GATE_INVALID'
  generatedAt: string
  owner: 'Evidence / DeepSeek route-cost-cache / Tool Gate'
  noNewRuntime: true
  metrics: readonly DSXUReasonixAbsorptionMetric[]
  metricCoverage: Record<DSXUReasonixMetricName, boolean>
  missingMetrics: readonly DSXUReasonixMetricName[]
  packets: readonly DSXUReasonixPacketEvidence[]
  guards: readonly string[]
  nextPackets: readonly string[]
}

export const DSXU_REASONIX_REQUIRED_METRICS: readonly DSXUReasonixMetricName[] = [
  'cacheHitRatePct',
  'toolResultChars',
  'tuiRenderResizeLatencyMs',
  'wallClockMs',
  'proAdmissionCount',
  'artifactLogSizeBytes',
]

function hasMeasuredMetric(metrics: readonly DSXUReasonixAbsorptionMetric[], name: DSXUReasonixMetricName): boolean {
  return metrics.some(metric => metric.name === name)
}

function makeMetricCoverage(metrics: readonly DSXUReasonixAbsorptionMetric[]): Record<DSXUReasonixMetricName, boolean> {
  return Object.fromEntries(
    DSXU_REASONIX_REQUIRED_METRICS.map(name => [name, hasMeasuredMetric(metrics, name)]),
  ) as Record<DSXUReasonixMetricName, boolean>
}

function detectCurrentStablePrefixInvariant(): boolean {
  const stableSections = [
    { id: 'system_rules', content: 'DSXU Code keeps one DeepSeek-first query loop.' },
    { id: 'tool_schemas', content: 'Read(file_path), Bash(command), Edit(file_path, old_string, new_string).' },
    { id: 'permission_policy', content: 'Side effects require Tool Gate and Permission Gate evidence.' },
    { id: 'model_routing_policy', content: 'Flash first; Pro only with admission evidence.' },
    { id: 'output_contract', content: 'Return evidence, verification, cost, and next action.' },
  ]
  const first = buildDSXUPromptPrefixCachePlan({
    workflowKind: 'coding',
    stableSections,
    dynamicSections: [
      { id: 'current_request', content: 'Fix a failing unit test.' },
      { id: 'tool_result_preview', content: 'toolResultChars=2048; artifact=trace/a.log' },
    ],
  })
  const second = buildDSXUPromptPrefixCachePlan({
    workflowKind: 'coding',
    stableSections: [...stableSections].reverse(),
    dynamicSections: [
      { id: 'current_request', content: 'Review a failing unit test.' },
      { id: 'tool_result_preview', content: 'toolResultChars=0; artifact=trace/b.log' },
    ],
  })
  return first.ok && second.ok && first.stablePrefixHash === second.stablePrefixHash && first.dynamicTailHash !== second.dynamicTailHash
}

function detectsXmlToolExtractionBaseline(): boolean {
  const calls = DeepSeekAdapter.extractToolUsesFromText(
    '<Read><path>src/index.ts</path></Read>\n<Bash><command>bun test src/dsxu/engine/__tests__/x.test.ts</command></Bash>',
  )
  return calls.length === 2 && calls[0]?.name === 'Read' && calls[1]?.name === 'Bash'
}

function detectsReasoningContentScavengeReady(): boolean {
  const rawJsonCalls = DeepSeekAdapter.extractToolUsesFromText(
    '{"name":"Read","arguments":{"file_path":"src/dsxu/engine/reasonix-deepseek-absorption-gate.ts"}}',
  )
  const openAiStyleCalls = DeepSeekAdapter.extractToolUsesFromText(
    '{"type":"function","function":{"name":"Bash","arguments":"{\\"command\\":\\"bun test\\"}"}}',
  )
  return rawJsonCalls[0]?.name === 'Read' &&
    rawJsonCalls[0]?.input.file_path === 'src/dsxu/engine/reasonix-deepseek-absorption-gate.ts' &&
    openAiStyleCalls[0]?.name === 'Bash' &&
    openAiStyleCalls[0]?.input.command === 'bun test'
}

function detectsTruncatedJsonRepairReady(): boolean {
  const [call] = DeepSeekAdapter.extractToolUsesFromText(
    '<tool_call name="Bash">{"command":"bun test src/dsxu/engine/__tests__/reasonix-deepseek-absorption-gate.test.ts</tool_call>',
  )
  return call?.name === 'Bash' &&
    call.input.command === 'bun test src/dsxu/engine/__tests__/reasonix-deepseek-absorption-gate.test.ts'
}

function detectsSchemaFlattenEmissionReady(): boolean {
  const schema = {
    type: 'object',
    required: ['file', 'patch'],
    properties: {
      file: { type: 'string' },
      patch: {
        type: 'object',
        required: ['range'],
        properties: {
          range: {
            type: 'object',
            required: ['startLine'],
            properties: {
              startLine: { type: 'number' },
              endLine: { type: 'number' },
            },
          },
          replacement: { type: 'string' },
        },
      },
    },
  }
  const plans = DeepSeekAdapter.buildDeepSeekToolSchemaPlans([
    { name: 'EditComplex', input_schema: schema },
  ])
  const flattened = DeepSeekAdapter.getDeepSeekToolParameters({ name: 'EditComplex', input_schema: schema }, plans)
  const nested = DeepSeekAdapter.nestDeepSeekToolArguments('EditComplex', {
    file: 'src/query.ts',
    patch__range__startLine: 10,
    patch__range__endLine: 12,
    patch__replacement: 'after',
  }, plans)
  const required = flattened.required
  return plans.get('EditComplex')?.shouldFlatten === true &&
    Array.isArray(required) &&
    required.includes('file') &&
    required.includes('patch__range__startLine') &&
    !required.includes('patch__range__endLine') &&
    (nested.patch as { range?: { startLine?: number; endLine?: number } })?.range?.startLine === 10 &&
    (nested.patch as { range?: { startLine?: number; endLine?: number } })?.range?.endLine === 12
}

function detectsStormGateBaseline(): boolean {
  const storm = buildDsxuIdenticalToolCallStormGate({
    threshold: 3,
    calls: [
      { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
      { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
      { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
    ],
  })
  const rereadAfterMutation = buildDsxuIdenticalToolCallStormGate({
    threshold: 3,
    calls: [
      { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
      { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
      {
        toolName: 'Edit',
        input: { file_path: 'src/query.ts', old_string: 'before', new_string: 'after' },
        readWriteClass: 'write-local',
      },
      { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
      { toolName: 'Read', input: { file_path: 'src/query.ts' }, readWriteClass: 'read-only' },
    ],
  })
  return storm.gateState?.gateId === 'dsxu_identical_tool_call_storm_gate' &&
    storm.signals.includes('identical_tool_call_storm') &&
    rereadAfterMutation.gateState === null &&
    rereadAfterMutation.signals.includes('mutating_tool_reset_read_window')
}

function detectsRepairSignalAdmissionLedgerBaseline(): boolean {
  const ledger = buildDSXUDeepSeekRepairAdmissionLedger({
    priorFlashAttempted: true,
    threshold: 3,
    signals: [
      {
        kind: 'json_tool_scavenged',
        severity: 'recoverable',
        turnId: 'flash-turn-1',
        evidence: 'bounded scavenge recovered DeepSeek tool call',
      },
      {
        kind: 'truncated_json_repaired',
        severity: 'recoverable',
        turnId: 'flash-turn-1',
        evidence: 'recoverable truncated JSON was repaired',
      },
      {
        kind: 'identical_tool_call_storm',
        severity: 'blocking',
        turnId: 'flash-turn-2',
        evidence: 'identical tool+args storm blocked repeated read-only loop',
      },
    ],
  })
  const blocked = buildDSXUDeepSeekRepairAdmissionLedger({
    priorFlashAttempted: false,
    threshold: 3,
    signals: [
      {
        kind: 'identical_tool_call_storm',
        severity: 'blocking',
        turnId: 'turn-1',
        evidence: 'storm before Flash baseline',
      },
      {
        kind: 'schema_validation_failed',
        severity: 'blocking',
        turnId: 'turn-1',
        evidence: 'schema failed before Flash baseline',
      },
    ],
  })
  return ledger.status === 'PRO_ADMISSION_READY' &&
    ledger.proAdmissionAllowed &&
    ledger.proAdmissionCount === 1 &&
    blocked.status === 'PRO_ADMISSION_BLOCKED' &&
    !blocked.proAdmissionAllowed
}

function defaultMetrics(): DSXUReasonixAbsorptionMetric[] {
  return [
    {
      name: 'cacheHitRatePct',
      state: 'measured',
      value: 66.8,
      unit: 'percent',
      evidence: 'public challenge ablation: cacheHitRatePct 45.5->66.8',
    },
    {
      name: 'toolResultChars',
      state: 'measured',
      value: 0,
      unit: 'chars',
      evidence: 'public challenge ablation: toolResultChars 316381->0',
    },
    {
      name: 'tuiRenderResizeLatencyMs',
      state: 'required_not_yet_measured',
      evidence: 'RDX-F real window + PTY resize harness required before experience claim',
    },
    {
      name: 'wallClockMs',
      state: 'required_not_yet_measured',
      evidence: 'RDX-B/RDX-C focused benchmark must compare before/after wall-clock',
    },
    {
      name: 'proAdmissionCount',
      state: 'measured',
      value: 0,
      unit: 'count',
      evidence: 'current RDX-A gate makes no Pro admission; future RDX-D must add ledger evidence',
    },
    {
      name: 'artifactLogSizeBytes',
      state: 'required_not_yet_measured',
      evidence: 'RDX-F release/evidence scan must measure artifact/log size and retention',
    },
  ]
}

export function buildDSXUReasonixDeepSeekAbsorptionGate(input?: {
  generatedAt?: string
  metrics?: readonly DSXUReasonixAbsorptionMetric[]
}): DSXUReasonixDeepSeekAbsorptionGate {
  const metrics = [...(input?.metrics ?? defaultMetrics())]
  const metricCoverage = makeMetricCoverage(metrics)
  const missingMetrics = DSXU_REASONIX_REQUIRED_METRICS.filter(name => !metricCoverage[name])
  const stablePrefixReady = detectCurrentStablePrefixInvariant()
  const xmlExtractionReady = detectsXmlToolExtractionBaseline()
  const reasoningScavengeReady = detectsReasoningContentScavengeReady()
  const truncatedJsonRepairReady = detectsTruncatedJsonRepairReady()
  const stormGateBaseline = detectsStormGateBaseline()
  const repairSignalAdmissionReady = detectsRepairSignalAdmissionLedgerBaseline()
  const cacheHardeningProof = buildDSXUReasonixCacheHardeningProof()
  const schemaFlattenEmissionReady = detectsSchemaFlattenEmissionReady()

  const packets: DSXUReasonixPacketEvidence[] = [
    {
      packet: 'RDX-CACHE-01',
      owner: 'prompt-prefix-cache-builder / query-loop evidence',
      status: stablePrefixReady ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: stablePrefixReady
        ? ['stablePrefixHash stays fixed when dynamic task state changes', 'dynamicTailHash changes as expected']
        : ['stable prefix invariant is not proven'],
      nextAction: stablePrefixReady
        ? 'promote this baseline into drift-reason contract during RDX-E'
        : 'repair stable/dynamic boundary before tool repair absorption',
    },
    {
      packet: 'RDX-CACHE-02',
      owner: 'Context / recovery / compact owner',
      status: cacheHardeningProof.contextPressureOk ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: cacheHardeningProof.contextPressureOk
        ? ['70/85/95/99 context pressure matrix preserves source truth reread and cache-safe recovery actions']
        : ['context-ratio gate does not yet prove source truth retention across pressure bands'],
      nextAction: cacheHardeningProof.contextPressureOk
        ? 'carry context pressure proof into RDX-F live window and release evidence'
        : 'repair 70/85/95/99 context pressure matrix with source truth retention',
    },
    {
      packet: 'RDX-CACHE-03',
      owner: 'DeepSeek adapter / history healing',
      status: cacheHardeningProof.thinkingHistoryOk ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: cacheHardeningProof.thinkingHistoryOk
        ? ['thinking-mode history backfills empty reasoning_content only when thinking is enabled; non-thinking stable prefix stays unchanged']
        : ['thinking-mode reasoning_content guard requires dedicated history-resume fixture'],
      nextAction: cacheHardeningProof.thinkingHistoryOk
        ? 'verify in RDX-F live DeepSeek request trajectory'
        : 'prove thinking-mode backfill does not dirty non-thinking stable prefix',
    },
    {
      packet: 'RDX-CACHE-04',
      owner: 'Tool result storage / microCompact',
      status: cacheHardeningProof.toolResultShrinkOk ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: cacheHardeningProof.toolResultShrinkOk
        ? ['tool result pressure now accounts for DeepSeek/CJK token density before artifact+preview replacement']
        : ['char-based tool result reductions exist; token/CJK shrink coverage must be proven'],
      nextAction: cacheHardeningProof.toolResultShrinkOk
        ? 'measure artifact/log size and cache effect during RDX-F real window'
        : 'add token-based Read/Bash/PowerShell/Web/MCP/Agent shrink fixtures',
    },
    {
      packet: 'RDX-CACHE-05',
      owner: 'DeepSeek API transport owner',
      status: cacheHardeningProof.retryBoundaryOk ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: cacheHardeningProof.retryBoundaryOk
        ? ['retry boundary allows retryable initial fetch failures but blocks mid-stream replay after partial content/tool state']
        : ['DeepSeek timeout/retry ledger is not exercised by RDX-A'],
      nextAction: cacheHardeningProof.retryBoundaryOk
        ? 'wire live retry telemetry into trajectory before public benchmark claim'
        : 'add retry policy evidence for initial fetch vs mid-stream failure',
    },
    {
      packet: 'RDX-TOOL-01',
      owner: 'Tool schema adapter / DeepSeek adapter',
      status: schemaFlattenEmissionReady ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: schemaFlattenEmissionReady
        ? ['complex tool schemas are flattened in DeepSeek tool emission path and nested back before dispatch']
        : ['schema flatten/nest is not implemented by this acceptance gate'],
      nextAction: schemaFlattenEmissionReady
        ? 'carry streaming/non-stream tool schema smoke into RDX-F real window'
        : 'implement bounded schema flatten/nest in existing tool schema path',
    },
    {
      packet: 'RDX-TOOL-02',
      owner: 'DeepSeek adapter extraction path',
      status: xmlExtractionReady && reasoningScavengeReady ? 'implemented_baseline' : 'partial_needs_code',
      evidence: [
        xmlExtractionReady ? 'existing XML/free-form DeepSeek tool extraction works' : 'XML extraction baseline failed',
        reasoningScavengeReady
          ? 'raw JSON/OpenAI-style reasoning/content tool-call scavenge is supported in bounded extraction path'
          : 'raw JSON/OpenAI-style reasoning/content tool-call scavenge is not yet supported',
      ],
      nextAction: reasoningScavengeReady
        ? 'carry bounded scavenge through RDX-B performance smoke and Tool Gate integration'
        : 'add allowedNames/maxCalls/maxInputBytes scavenge without bypassing Tool Gate',
    },
    {
      packet: 'RDX-TOOL-03',
      owner: 'DeepSeek adapter / schema validator',
      status: truncatedJsonRepairReady ? 'implemented_baseline' : 'partial_needs_code',
      evidence: [
        truncatedJsonRepairReady
          ? 'recoverable truncated JSON tool args are repaired before normalization'
          : 'truncated JSON currently falls back to a raw command string or invalid marker, so bounded repair still needs code',
      ],
      nextAction: truncatedJsonRepairReady
        ? 'add unrecoverable JSON fail-closed smoke before public claim'
        : 'repair recoverable truncated JSON and leave unrecoverable args invalid',
    },
    {
      packet: 'RDX-TOOL-04',
      owner: 'query-loop gate / Tool Gate state',
      status: stormGateBaseline ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: [
        stormGateBaseline
          ? 'identical tool+args storm gate blocks repeated read-only loops and mutating tools reset the reread window'
          : 'no identical tool+args storm gate baseline found',
      ],
      nextAction: stormGateBaseline
        ? 'carry storm repair signal into RDX-D Pro admission ledger'
        : 'add identical-call storm window and mutating-tool read reset semantics',
    },
    {
      packet: 'RDX-TOOL-05',
      owner: 'DeepSeek cost router / trajectory store',
      status: repairSignalAdmissionReady ? 'implemented_baseline' : 'needs_real_code_test',
      evidence: [
        repairSignalAdmissionReady
          ? 'repair/failure signal ledger allows Pro only after prior Flash and thresholded signals; blocks Pro without prior Flash'
          : 'failure-signal Pro admission ledger is not yet connected to repair signals',
      ],
      nextAction: repairSignalAdmissionReady
        ? 'wire ledger events into DeepSeek trajectory during live route execution'
        : 'record repair/search/storm signals before Pro admission and keep Flash-first default',
    },
  ]

  const openGaps = packets.filter(packet => packet.status !== 'implemented_baseline')
  const guards: string[] = []
  if (missingMetrics.length > 0) guards.push(`missing required metrics: ${missingMetrics.join(', ')}`)
  for (const metric of metrics) {
    if (metric.state === 'required_not_yet_measured') {
      guards.push(`${metric.name}: required measurement not yet produced`)
    }
  }
  if (openGaps.length > 0) guards.push(`open RDX packets: ${openGaps.map(packet => packet.packet).join(', ')}`)

  return {
    schemaVersion: 'dsxu.reasonix.deepseek-absorption-gate.v1',
    status:
      missingMetrics.length > 0
        ? 'RDX_ACCEPTANCE_GATE_INVALID'
        : guards.length > 0
          ? 'RDX_ACCEPTANCE_GATE_READY_WITH_OPEN_GAPS'
          : 'RDX_ACCEPTANCE_GATE_PASS_READY_FOR_REAL_WINDOW',
    generatedAt: input?.generatedAt ?? new Date().toISOString(),
    owner: 'Evidence / DeepSeek route-cost-cache / Tool Gate',
    noNewRuntime: true,
    metrics,
    metricCoverage,
    missingMetrics,
    packets,
    guards,
    nextPackets: ['RDX-B adapter repair', 'RDX-C query/tool gate', 'RDX-D route/cost admission', 'RDX-E cache hardening', 'RDX-F real window + benchmark'],
  }
}
