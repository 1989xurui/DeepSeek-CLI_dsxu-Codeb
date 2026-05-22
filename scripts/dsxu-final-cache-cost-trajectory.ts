import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  checkResponseForCacheBreak,
  recordPromptState,
  resetPromptCacheBreakDetection,
  type CacheBreakReport,
} from '../src/dsxu/engine/prompt-cache-break-detection'
import type { ToolSchema } from '../src/dsxu/engine/types'

type Json = Record<string, any>

const GENERATED = join(process.cwd(), 'docs', 'generated')
const COST_QUALITY_PATH = join(GENERATED, 'DSXU_V6_COST_TO_VERIFIED_COMPLETION_20260519.json')

const READ_TOOL: ToolSchema = {
  name: 'Read',
  description: 'Read bounded source ranges',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string' },
      offset: { type: 'number' },
      limit: { type: 'number' },
    },
    required: ['file_path'],
  },
}

const GREP_TOOL: ToolSchema = {
  name: 'Grep',
  description: 'Search source text before reading ranges',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      path: { type: 'string' },
    },
    required: ['pattern'],
  },
}

const EVIDENCE_TOOL: ToolSchema = {
  name: 'CollectEvidence',
  description: 'Collect bounded evidence ids and artifact paths',
  inputSchema: {
    type: 'object',
    properties: {
      evidenceId: { type: 'string' },
    },
    required: ['evidenceId'],
  },
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function readJson(path: string): Json | undefined {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8')) as Json
}

function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function objectFrom(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}
}

function buildCacheBreakAttribution(): {
  stablePairReport: CacheBreakReport | null
  breakReport: CacheBreakReport | null
} {
  resetPromptCacheBreakDetection()
  recordPromptState({
    querySource: 'v10-final-cache-latch',
    systemPrompt: 'DSXU stable prefix: source capsule, route policy, tool schema freeze.',
    toolSchemas: [READ_TOOL, GREP_TOOL],
    model: 'deepseek-v4-flash',
    cacheStrategy: 'stable-prefix-latch',
    effortValue: 'non-thinking',
  })
  checkResponseForCacheBreak({
    querySource: 'v10-final-cache-latch',
    usage: {
      inputTokens: 30_000,
      outputTokens: 400,
      cacheReadTokens: 26_000,
      cacheCreationTokens: 0,
      cacheHit: true,
    },
  })
  recordPromptState({
    querySource: 'v10-final-cache-latch',
    systemPrompt: 'DSXU stable prefix: source capsule, route policy, tool schema freeze.',
    toolSchemas: [READ_TOOL, GREP_TOOL],
    model: 'deepseek-v4-flash',
    cacheStrategy: 'stable-prefix-latch',
    effortValue: 'non-thinking',
  })
  const stablePairReport = checkResponseForCacheBreak({
    querySource: 'v10-final-cache-latch',
    usage: {
      inputTokens: 30_000,
      outputTokens: 400,
      cacheReadTokens: 25_200,
      cacheCreationTokens: 0,
      cacheHit: true,
    },
    sinceLastAssistantMs: 60_000,
  })
  recordPromptState({
    querySource: 'v10-final-cache-latch',
    systemPrompt: 'DSXU stable prefix: source capsule, route policy, tool schema freeze. Added volatile release evidence directly into prefix.',
    toolSchemas: [READ_TOOL, GREP_TOOL, EVIDENCE_TOOL],
    model: 'deepseek-v4-pro',
    cacheStrategy: 'volatile-prefix',
    effortValue: 'max',
  })
  const breakReport = checkResponseForCacheBreak({
    querySource: 'v10-final-cache-latch',
    usage: {
      inputTokens: 30_000,
      outputTokens: 700,
      cacheReadTokens: 6_000,
      cacheCreationTokens: 9_500,
      cacheHit: true,
    },
    sinceLastAssistantMs: 60_000,
  })
  return { stablePairReport, breakReport }
}

function main(): void {
  const costReport = readJson(COST_QUALITY_PATH)
  const board = objectFrom(costReport?.board)
  const { stablePairReport, breakReport } = buildCacheBreakAttribution()
  const cacheBreakAttribution = {
    stablePairNoBreak: stablePairReport === null,
    breakDetected: Boolean(breakReport),
    reason: breakReport?.reason ?? 'none',
    tokenDrop: breakReport?.tokenDrop ?? 0,
    changes: breakReport?.changes ?? null,
  }
  const blockers = [
    costReport?.status !== 'PASS_V6_COST_TO_VERIFIED_COMPLETION_REPORT'
      ? `costQuality:${costReport?.status ?? 'MISSING'}`
      : '',
    board.status !== 'PASS_DEEPSEEK_COST_QUALITY_ACCEPTANCE'
      ? `costBoard:${board.status ?? 'MISSING'}`
      : '',
    !cacheBreakAttribution.stablePairNoBreak ? 'stable prompt pair produced false cache break' : '',
    !cacheBreakAttribution.breakDetected ? 'cache break attribution did not detect deliberate route/tool/prefix change' : '',
    !String(cacheBreakAttribution.reason).includes('model changed') ? `cache break reason missing model attribution:${cacheBreakAttribution.reason}` : '',
  ].filter(Boolean)
  const report = {
    schemaVersion: 'dsxu.final-cache-cost-trajectory.v10',
    generatedAt: new Date().toISOString(),
    owner: 'DeepSeek route/cost/cache / Evidence',
    status: blockers.length === 0
      ? 'PASS_V10_FINAL_CACHE_COST_TRAJECTORY'
      : 'FAIL_V10_FINAL_CACHE_COST_TRAJECTORY',
    publicClaimAllowed: false,
    cacheBreakAttribution,
    costQuality: {
      sourcePath: COST_QUALITY_PATH,
      status: costReport?.status ?? 'MISSING',
      boardStatus: board.status ?? 'MISSING',
      scenarioCount: n(board.scenarioCount),
      flashTurnRatioPct: n(board.flashTurnRatioPct),
      proTurnRatioPct: n(board.proTurnRatioPct),
      cacheHitRatePct: n(board.cacheHitRatePct),
      totalCostUsd: n(board.totalCostUsd),
      proOnlyCostUsd: n(board.proOnlyCostUsd),
      savingsVsProOnlyPct: n(board.savingsVsProOnlyPct),
      public90ClaimAllowed: board.public90ClaimAllowed === true,
    },
    trajectoryGovernance: {
      routeLatchEvidence: cacheBreakAttribution.breakDetected,
      cacheBreakEvidence: cacheBreakAttribution.breakDetected,
      costToVerifiedEvidence: costReport?.status === 'PASS_V6_COST_TO_VERIFIED_COMPLETION_REPORT',
      publicClaimAllowed: false,
    },
    blockers,
    rule:
      'Cache/cost/trajectory evidence is internal release evidence. It may support cost-aware positioning, but not public model-quality or 90% parity claims.',
  }
  const jsonPath = join(GENERATED, 'DSXU_V10_FINAL_CACHE_COST_TRAJECTORY_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V10_FINAL_CACHE_COST_TRAJECTORY_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final Cache Cost Trajectory',
    '',
    `Status: ${report.status}`,
    '',
    `Cache break reason: ${cacheBreakAttribution.reason}`,
    '',
    `Cache token drop: ${cacheBreakAttribution.tokenDrop}`,
    '',
    `Cost board: ${report.costQuality.status}`,
    '',
    `Cache hit rate: ${report.costQuality.cacheHitRatePct}%`,
    '',
    `Flash turns: ${report.costQuality.flashTurnRatioPct}%; Pro turns: ${report.costQuality.proTurnRatioPct}%`,
    '',
    `Savings vs pro-only: ${report.costQuality.savingsVsProOnlyPct}%`,
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
