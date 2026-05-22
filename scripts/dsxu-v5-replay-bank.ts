import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import {
  buildV5ReplayBank,
  type V5ReplayBank,
  type V5ReplayTraceEvidence,
} from '../src/dsxu/engine/real-task-replay-suite-v1'

type V4HitRateCase = {
  id: string
  suite: string
  category: string
  title: string
  finalPass: boolean
  rawBaselinePass: boolean
  recoveryAfterBaselineFailure: boolean
  routeModels: string[]
  proAdmissionCount: number
  failureRecoveryEvents: number
  toolUseCount: number
  rawTranscriptPath: string
  finalTestStdoutPath: string
  finalTestStderrPath: string
  evidenceOk: boolean
  evidenceMissing: string[]
}

type V4HitRatePack = {
  schemaVersion: string
  generatedAt: string
  status: string
  caseCount: number
  cases: V4HitRateCase[]
}

type NativeV5ReplayCase = {
  id: string
  layer: V5ReplayTraceEvidence['layer']
  category: string
  title: string
  rawTracePath: string
  finalPass: boolean
  recoveryPath: boolean
  evidenceOk: boolean
}

type NativeV5ReplayPack = {
  schemaVersion: 'dsxu.v5.native-replay-subset.v1'
  generatedAt: string
  status: string
  caseCount: number
  claimBoundary: string
  cases: NativeV5ReplayCase[]
}

type TraceSignals = {
  route: boolean
  visibleTools: boolean
  toolEvents: boolean
  sourceEvidence: boolean
  resultEventSeen: boolean
  nativeExecutionContract: boolean
  nativePromptHash: boolean
  nativeEditProof: boolean
  executionContractModel: string
  routeModelConsistent: boolean
  traceHash: string
  model: string
  toolCount: number
}

type V5ReplayCaseAudit = {
  caseId: string
  layer: V5ReplayTraceEvidence['layer']
  sourceSuite: string
  sourceCategory: string
  rawTracePath: string
  traceHash: string
  nativeV5Ready: boolean
  projectedFromPreviousEvidence: boolean
  missingNativeFields: string[]
  missingStandardFields: string[]
}

export type V5ReplayBankIntake = {
  schemaVersion: 'dsxu.v5.replay-bank-intake.v1'
  generatedAt: string
  owner: 'Replay Bank / Evidence'
  status: 'PASS_V5_REPLAY_BANK_REQUIRED_SUBSET' | 'BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET'
  claimBoundary: string
  sourcePackPath: string
  sourcePackSchemaVersion: string
  sourcePackGeneratedAt: string
  strictNativeV5: true
  sourceCaseCount: number
  nativeV5ReadyCount: number
  projectedLegacyCaseCount: number
  bank: V5ReplayBank
  audits: V5ReplayCaseAudit[]
  blockers: string[]
  dataStillNeeded: string[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V5_REPLAY_BANK_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V5_REPLAY_BANK_${DATE}.md`)

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function bool(value: unknown): boolean {
  return value === true
}

function rel(path: string, root = ROOT): string {
  return relative(root, path).replace(/\\/g, '/')
}

function resolveFromRoot(root: string, path: string): string {
  const text = String(path ?? '').trim()
  if (!text) return ''
  return resolve(root, text)
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}

async function latestGeneratedPack(root: string): Promise<string> {
  const dir = join(root, 'docs', 'generated')
  const files = await readdir(dir)
  const candidates: Array<{ path: string; mtimeMs: number }> = []
  for (const file of files) {
    if (
      !/^DSXU_V5_NATIVE_REPLAY_SUBSET_\d+\.json$/.test(file) &&
      !/^DSXU_V4_REAL_TASK_HIT_RATE_PACK_\d+\.json$/.test(file)
    ) continue
    const path = join(dir, file)
    candidates.push({ path, mtimeMs: (await stat(path)).mtimeMs })
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)
  if (!candidates[0]) {
    throw new Error('missing DSXU_V4_REAL_TASK_HIT_RATE_PACK_*.json source pack')
  }
  return candidates[0].path
}

function parseNativeV5Pack(raw: Record<string, unknown>): NativeV5ReplayPack {
  return {
    schemaVersion: 'dsxu.v5.native-replay-subset.v1',
    generatedAt: String(raw.generatedAt ?? ''),
    status: String(raw.status ?? ''),
    caseCount: Number(raw.caseCount ?? 0),
    claimBoundary: String(raw.claimBoundary ?? ''),
    cases: arrayFrom(raw.cases).map((item, index) => {
      const row = objectFrom(item)
      return {
        id: String(row.id ?? `native-v5-${index + 1}`),
        layer: String(row.layer ?? 'L1') as V5ReplayTraceEvidence['layer'],
        category: String(row.category ?? 'native-v5'),
        title: String(row.title ?? `Native V5 replay ${index + 1}`),
        rawTracePath: String(row.rawTracePath ?? ''),
        finalPass: bool(row.finalPass),
        recoveryPath: bool(row.recoveryPath),
        evidenceOk: row.evidenceOk !== false,
      }
    }),
  }
}

function parseV4Pack(raw: Record<string, unknown>): V4HitRatePack {
  return {
    schemaVersion: String(raw.schemaVersion ?? ''),
    generatedAt: String(raw.generatedAt ?? ''),
    status: String(raw.status ?? ''),
    caseCount: Number(raw.caseCount ?? arrayFrom(raw.cases).length),
    cases: arrayFrom(raw.cases).map((value): V4HitRateCase => {
      const item = objectFrom(value)
      return {
        id: String(item.id ?? ''),
        suite: String(item.suite ?? ''),
        category: String(item.category ?? ''),
        title: String(item.title ?? item.id ?? ''),
        finalPass: bool(item.finalPass),
        rawBaselinePass: bool(item.rawBaselinePass),
        recoveryAfterBaselineFailure: bool(item.recoveryAfterBaselineFailure),
        routeModels: arrayFrom(item.routeModels).map(String),
        proAdmissionCount: Number(item.proAdmissionCount ?? 0),
        failureRecoveryEvents: Number(item.failureRecoveryEvents ?? 0),
        toolUseCount: Number(item.toolUseCount ?? 0),
        rawTranscriptPath: String(item.rawTranscriptPath ?? ''),
        finalTestStdoutPath: String(item.finalTestStdoutPath ?? ''),
        finalTestStderrPath: String(item.finalTestStderrPath ?? ''),
        evidenceOk: bool(item.evidenceOk),
        evidenceMissing: arrayFrom(item.evidenceMissing).map(String),
      }
    }),
  }
}

function mapLayer(item: V4HitRateCase): V5ReplayTraceEvidence['layer'] {
  const category = item.category.toLowerCase()
  const suite = item.suite.toLowerCase()
  if (/raw-api|workflow-lift/.test(suite) || /workflow-lift/.test(category)) return 'L2'
  if (/repo-swe|bugfix|feature|code/.test(category)) return 'L3'
  if (/terminal|visible|tui|browser/.test(category)) return 'L4'
  if (/policy|release|runtime|context|provider|cache|permission|evidence/.test(category)) return 'L5'
  return 'L1'
}

async function readTraceSignals(path: string): Promise<TraceSignals> {
  if (!path || !existsSync(path)) {
    return {
      route: false,
      visibleTools: false,
      toolEvents: false,
      sourceEvidence: false,
      resultEventSeen: false,
      nativeExecutionContract: false,
      nativePromptHash: false,
      nativeEditProof: false,
      executionContractModel: '',
      routeModelConsistent: false,
      traceHash: '',
      model: '',
      toolCount: 0,
    }
  }

  const text = await readFile(path, 'utf8')
  const traceText = text.toLowerCase()
  let route = false
  let visibleTools = false
  let toolEvents = false
  let sourceEvidence = false
  let resultEventSeen = false
  let model = ''
  let toolCount = 0
  let executionContractModel = ''

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    let event: Record<string, unknown>
    try {
      event = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (event.type === 'system') {
      model = String(event.model ?? model)
      route = route || /deepseek/.test(model)
      const tools = arrayFrom(event.tools).map(String)
      if (tools.length > 0) {
        toolCount = tools.length
        visibleTools = tools.length <= 12
      }
    }
    if (event.type === 'result') resultEventSeen = true
    if (event.type === 'dsxu.execution-contract.v5') {
      const taskContract = objectFrom(event.task_contract)
      const routeDecision = objectFrom(taskContract.routeDecision)
      executionContractModel = String(routeDecision.model ?? taskContract.model ?? executionContractModel)
    }

    const message = objectFrom(event.message)
    for (const block of arrayFrom(message.content)) {
      const item = objectFrom(block)
      const type = String(item.type ?? '')
      const name = String(item.name ?? '')
      if (type === 'tool_use') {
        toolEvents = true
        if (/^(read|grep|glob|edit|multiedit|write)$/i.test(name)) sourceEvidence = true
      }
      if (type === 'tool_result') toolEvents = true
    }
  }

  return {
    route,
    visibleTools,
    toolEvents,
    sourceEvidence,
    resultEventSeen,
    nativeExecutionContract:
      /dsxu\.execution-contract\.v5|executioncontract|execution_contract|task_contract/.test(traceText),
    nativePromptHash:
      /prompthash|prompt_hash|stableprefixhash|stable_prefix_hash|dynamictailhash|dynamic_tail_hash|cacheepoch|cache_epoch/.test(traceText),
    nativeEditProof:
      /dsxu\.edit-proof-envelope\.v5|editproof|edit_proof|proof-carrying edit|proof_carrying_edit/.test(traceText),
    executionContractModel,
    routeModelConsistent:
      Boolean(model) &&
      (!executionContractModel || executionContractModel === model),
    traceHash: sha(text),
    model,
    toolCount,
  }
}

function missingFields(caseEvidence: V5ReplayTraceEvidence): string[] {
  const fields: Array<keyof V5ReplayTraceEvidence> = [
    'executionContract',
    'route',
    'visibleTools',
    'promptHash',
    'toolEvents',
    'sourceEvidence',
    'editProof',
    'verificationResult',
    'finalAnswer',
  ]
  return fields.filter(field => caseEvidence[field] !== true)
}

export async function buildV5ReplayBankIntake(options: {
  root?: string
  sourcePackPath?: string
  generatedAt?: string
} = {}): Promise<V5ReplayBankIntake> {
  const root = options.root ?? ROOT
  const sourcePackPath = options.sourcePackPath ?? await latestGeneratedPack(root)
  const rawPack = await readJson(sourcePackPath)
  if (rawPack.schemaVersion === 'dsxu.v5.native-replay-subset.v1') {
    return buildV5ReplayBankIntakeFromNativePack({
      root,
      sourcePackPath,
      sourcePack: parseNativeV5Pack(rawPack),
      generatedAt: options.generatedAt,
    })
  }
  const sourcePack = parseV4Pack(rawPack)
  const cases: V5ReplayTraceEvidence[] = []
  const audits: V5ReplayCaseAudit[] = []
  const blockers: string[] = []

  if (sourcePack.status !== 'PASS_V4_REAL_TASK_HIT_RATE_PACK') {
    blockers.push(`source pack is not PASS: ${sourcePack.status}`)
  }

  for (const item of sourcePack.cases) {
    const rawTraceAbs = resolveFromRoot(root, item.rawTranscriptPath)
    const stdoutAbs = resolveFromRoot(root, item.finalTestStdoutPath)
    const stderrAbs = resolveFromRoot(root, item.finalTestStderrPath)
    const signals = await readTraceSignals(rawTraceAbs)
    const layer = mapLayer(item)
    const verificationResult =
      item.finalPass &&
      item.evidenceOk &&
      existsSync(stdoutAbs) &&
      existsSync(stderrAbs)
    const recoveryPath =
      item.recoveryAfterBaselineFailure ||
      item.failureRecoveryEvents > 0 ||
      item.rawBaselinePass === false
    const caseEvidence: Omit<V5ReplayTraceEvidence, 'accepted'> = {
      caseId: item.id,
      layer,
      userTask: item.title,
      executionContract: signals.nativeExecutionContract,
      route: (signals.route || item.routeModels.some(model => /deepseek/.test(model))) && signals.routeModelConsistent,
      visibleTools: signals.visibleTools,
      promptHash: signals.nativePromptHash,
      toolEvents: signals.toolEvents || item.toolUseCount > 0,
      sourceEvidence: signals.sourceEvidence && item.evidenceOk,
      editProof: signals.nativeEditProof,
      verificationResult,
      recoveryPath,
      finalAnswer: signals.resultEventSeen && item.finalPass,
      rawTracePath: existsSync(rawTraceAbs) ? rel(rawTraceAbs, root) : item.rawTranscriptPath,
    }
    const standardMissing = missingFields({ ...caseEvidence, accepted: false })
    const nativeMissing = [
      ...(!caseEvidence.executionContract ? ['executionContract'] : []),
      ...(!caseEvidence.promptHash ? ['promptHash'] : []),
      ...(!caseEvidence.editProof ? ['editProof'] : []),
    ]
    const accepted =
      standardMissing.length === 0 &&
      Boolean(caseEvidence.rawTracePath.trim())
    const replayCase: V5ReplayTraceEvidence = {
      ...caseEvidence,
      accepted,
    }
    cases.push(replayCase)
    audits.push({
      caseId: item.id,
      layer,
      sourceSuite: item.suite,
      sourceCategory: item.category,
      rawTracePath: replayCase.rawTracePath,
      traceHash: signals.traceHash,
      nativeV5Ready: nativeMissing.length === 0,
      projectedFromPreviousEvidence: nativeMissing.length > 0,
      missingNativeFields: nativeMissing,
      missingStandardFields: standardMissing,
    })
  }

  const bank = buildV5ReplayBank(cases)
  const nativeV5ReadyCount = audits.filter(item => item.nativeV5Ready).length
  const projectedLegacyCaseCount = audits.filter(item => item.projectedFromPreviousEvidence).length

  if (bank.caseCount < 20) blockers.push(`need at least 20 V5 replay cases, found ${bank.caseCount}`)
  if (bank.requiredSubsetReady !== true) {
    blockers.push('20-case V5 required subset is not ready with native V5 contract/proof/hash evidence')
  }
  if (nativeV5ReadyCount < 20) {
    blockers.push(`need 20 native V5-ready traces, found ${nativeV5ReadyCount}`)
  }

  return {
    schemaVersion: 'dsxu.v5.replay-bank-intake.v1',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    owner: 'Replay Bank / Evidence',
    status: blockers.length === 0
      ? 'PASS_V5_REPLAY_BANK_REQUIRED_SUBSET'
      : 'BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET',
    claimBoundary:
      'This intake may project older DSXU traces for diagnosis, but V5 completion requires native V5 execution contract, prompt/cache hash, edit proof, verification, recovery, final answer, and raw trace evidence per case. Projected legacy traces do not count as V5 standard completion.',
    sourcePackPath: rel(sourcePackPath, root),
    sourcePackSchemaVersion: sourcePack.schemaVersion,
    sourcePackGeneratedAt: sourcePack.generatedAt,
    strictNativeV5: true,
    sourceCaseCount: sourcePack.caseCount,
    nativeV5ReadyCount,
    projectedLegacyCaseCount,
    bank,
    audits,
    blockers,
    dataStillNeeded: [
      'Rerun at least 20 cases through the current V5 runtime so raw traces include dsxu.execution-contract.v5, prompt/cache hash evidence, and dsxu.edit-proof-envelope.v5.',
      'Expand the same native V5 replay bank to 100 accepted cases before V5 release-ready status.',
      'Collect 30 paired public comparable raw evidence cases before any public benchmark or 90% external-comparison claim.',
    ],
  }
}

async function buildV5ReplayBankIntakeFromNativePack(input: {
  root: string
  sourcePackPath: string
  sourcePack: NativeV5ReplayPack
  generatedAt?: string
}): Promise<V5ReplayBankIntake> {
  const { root, sourcePackPath, sourcePack } = input
  const cases: V5ReplayTraceEvidence[] = []
  const audits: V5ReplayCaseAudit[] = []
  const blockers: string[] = []

  if (!/^PASS/.test(sourcePack.status)) {
    blockers.push(`source native V5 pack is not PASS: ${sourcePack.status}`)
  }

  for (const item of sourcePack.cases) {
    const rawTraceAbs = resolveFromRoot(root, item.rawTracePath)
    const signals = await readTraceSignals(rawTraceAbs)
    const caseEvidence: Omit<V5ReplayTraceEvidence, 'accepted'> = {
      caseId: item.id,
      layer: item.layer,
      userTask: item.title,
      executionContract: signals.nativeExecutionContract,
      route: signals.route && signals.routeModelConsistent,
      visibleTools: signals.visibleTools,
      promptHash: signals.nativePromptHash,
      toolEvents: signals.toolEvents,
      sourceEvidence: signals.sourceEvidence && item.evidenceOk,
      editProof: signals.nativeEditProof,
      verificationResult: item.finalPass && signals.resultEventSeen,
      recoveryPath: item.recoveryPath,
      finalAnswer: signals.resultEventSeen && item.finalPass,
      rawTracePath: existsSync(rawTraceAbs) ? rel(rawTraceAbs, root) : item.rawTracePath,
    }
    const standardMissing = missingFields({ ...caseEvidence, accepted: false })
    const nativeMissing = [
      ...(!caseEvidence.executionContract ? ['executionContract'] : []),
      ...(!caseEvidence.promptHash ? ['promptHash'] : []),
      ...(!caseEvidence.editProof ? ['editProof'] : []),
    ]
    const accepted = standardMissing.length === 0 && Boolean(caseEvidence.rawTracePath.trim())
    const replayCase: V5ReplayTraceEvidence = { ...caseEvidence, accepted }
    cases.push(replayCase)
    audits.push({
      caseId: item.id,
      layer: item.layer,
      sourceSuite: 'native-v5-replay-subset',
      sourceCategory: item.category,
      rawTracePath: replayCase.rawTracePath,
      traceHash: signals.traceHash,
      nativeV5Ready: nativeMissing.length === 0,
      projectedFromPreviousEvidence: false,
      missingNativeFields: nativeMissing,
      missingStandardFields: standardMissing,
    })
  }

  const bank = buildV5ReplayBank(cases)
  const nativeV5ReadyCount = audits.filter(item => item.nativeV5Ready).length
  const projectedLegacyCaseCount = audits.filter(item => item.projectedFromPreviousEvidence).length

  if (bank.caseCount < 20) blockers.push(`need at least 20 V5 replay cases, found ${bank.caseCount}`)
  if (bank.requiredSubsetReady !== true) {
    blockers.push('20-case V5 required subset is not ready with native V5 contract/proof/hash evidence')
  }
  if (nativeV5ReadyCount < 20) {
    blockers.push(`need 20 native V5-ready traces, found ${nativeV5ReadyCount}`)
  }

  return {
    schemaVersion: 'dsxu.v5.replay-bank-intake.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    owner: 'Replay Bank / Evidence',
    status: blockers.length === 0
      ? 'PASS_V5_REPLAY_BANK_REQUIRED_SUBSET'
      : 'BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET',
    claimBoundary:
      'This intake uses native V5 internal replay traces for V5 default-chain acceptance only. It is not a public benchmark score and cannot be used as a 90% external-comparison claim without paired public raw evidence.',
    sourcePackPath: rel(sourcePackPath, root),
    sourcePackSchemaVersion: sourcePack.schemaVersion,
    sourcePackGeneratedAt: sourcePack.generatedAt,
    strictNativeV5: true,
    sourceCaseCount: sourcePack.caseCount,
    nativeV5ReadyCount,
    projectedLegacyCaseCount,
    bank,
    audits,
    blockers,
    dataStillNeeded: [
      'Expand the same native V5 replay bank to 100 accepted cases before V5 release-ready status.',
      'Collect 30 paired public comparable raw evidence cases before any public benchmark or 90% external-comparison claim.',
    ],
  }
}

function markdownTable(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  const cell = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => cell(row[column])).join(' | ')} |`),
  ].join('\n')
}

function toMarkdown(intake: V5ReplayBankIntake): string {
  return [
    '# DSXU V5 Replay Bank Strict Intake - 2026-05-19',
    '',
    `Status: \`${intake.status}\``,
    '',
    intake.claimBoundary,
    '',
    '## Summary',
    '',
    markdownTable([{
      sourceCases: intake.sourceCaseCount,
      bankCases: intake.bank.caseCount,
      accepted: intake.bank.acceptedCount,
      nativeV5Ready: intake.nativeV5ReadyCount,
      projectedLegacy: intake.projectedLegacyCaseCount,
      requiredSubsetReady: intake.bank.requiredSubsetReady,
      fullReleaseReady: intake.bank.fullReleaseReady,
      rawTraceSavedPct: intake.bank.rawTraceSavedPct,
    }], [
      'sourceCases',
      'bankCases',
      'accepted',
      'nativeV5Ready',
      'projectedLegacy',
      'requiredSubsetReady',
      'fullReleaseReady',
      'rawTraceSavedPct',
    ]),
    '',
    '## Source',
    '',
    `- sourcePackPath: \`${intake.sourcePackPath}\``,
    `- sourcePackSchemaVersion: \`${intake.sourcePackSchemaVersion}\``,
    '',
    '## Case Audit',
    '',
    markdownTable(intake.audits.map(item => ({
      caseId: item.caseId,
      layer: item.layer,
      sourceSuite: item.sourceSuite,
      sourceCategory: item.sourceCategory,
      nativeV5Ready: item.nativeV5Ready,
      missingNativeFields: item.missingNativeFields.join('; '),
      missingStandardFields: item.missingStandardFields.join('; '),
    })), [
      'caseId',
      'layer',
      'sourceSuite',
      'sourceCategory',
      'nativeV5Ready',
      'missingNativeFields',
      'missingStandardFields',
    ]),
    '',
    '## Blockers',
    '',
    ...(intake.blockers.length > 0 ? intake.blockers.map(item => `- ${item}`) : ['- none']),
    '',
    '## Data Still Needed',
    '',
    ...intake.dataStillNeeded.map(item => `- ${item}`),
    '',
    `Evidence hash: \`${sha(JSON.stringify(intake.audits.map(item => [item.caseId, item.traceHash, item.missingNativeFields]))).slice(0, 16)}\``,
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  const intake = await buildV5ReplayBankIntake()
  await mkdir(GENERATED_DIR, { recursive: true })
  await Promise.all([
    writeFile(OUT_JSON, `${JSON.stringify(intake, null, 2)}\n`, 'utf8'),
    writeFile(OUT_MD, toMarkdown(intake), 'utf8'),
  ])
  console.log(JSON.stringify({
    status: intake.status,
    sourceCaseCount: intake.sourceCaseCount,
    bankCaseCount: intake.bank.caseCount,
    acceptedCount: intake.bank.acceptedCount,
    nativeV5ReadyCount: intake.nativeV5ReadyCount,
    projectedLegacyCaseCount: intake.projectedLegacyCaseCount,
    requiredSubsetReady: intake.bank.requiredSubsetReady,
    fullReleaseReady: intake.bank.fullReleaseReady,
    blockers: intake.blockers,
    outputJson: rel(OUT_JSON),
    outputMd: rel(OUT_MD),
  }, null, 2))
  if (intake.status !== 'PASS_V5_REPLAY_BANK_REQUIRED_SUBSET') process.exitCode = 1
}

if (import.meta.main && basename(process.argv[1] ?? '') === 'dsxu-v5-replay-bank.ts') {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
