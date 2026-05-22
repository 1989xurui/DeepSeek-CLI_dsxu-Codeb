import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { DeepSeekAdapter } from '../../services/api/deepseek-adapter'
import { exportTrainingTrajectoryFromRuntimeFile, type RuntimeEvidenceImportResult } from './runtime-importer'
import { scoreTrainingTrajectory, type DsxuTrainingScoreResult } from './scorer'
import { validateTrainingTrajectory, type DsxuTrainingTrajectoryValidation } from './validator'

export const LIVE_PROVIDER_CAPTURE_SCHEMA_VERSION = 'dsxu.training-live-provider-capture.v1' as const

export type LiveProviderCaptureStatus =
  | 'PASS_LIVE_PROVIDER_CAPTURE'
  | 'FAIL_LIVE_PROVIDER_CAPTURE'
  | 'SKIPPED_NO_API_KEY'

export interface LiveProviderCaptureOptions {
  outputPath: string
  tracePath: string
  apiKey?: string
  baseUrl?: string
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  requireLive?: boolean
}

export interface LiveProviderCaptureArtifact {
  schemaVersion: typeof LIVE_PROVIDER_CAPTURE_SCHEMA_VERSION
  generatedAt: string
  datasetKind: 'live_provider_capture_smoke'
  status: LiveProviderCaptureStatus
  provider: 'deepseek'
  model: string
  baseUrlHost: string
  liveProviderAttempted: boolean
  liveProviderClaimAllowed: false
  publicClaimAllowed: false
  tracePath: string
  outputPath: string
  request: {
    stream: false
    maxTokens: number
    temperature: number
    timeoutMs: number
    rawPromptStored: false
  }
  import?: {
    summary: RuntimeEvidenceImportResult['summary']
    validation: DsxuTrainingTrajectoryValidation
    score: DsxuTrainingScoreResult
    trajectory: RuntimeEvidenceImportResult['trajectory']
  }
  skipReason?: string
  error?: {
    name: string
    message: string
  }
  rule: string
}

export async function runLiveProviderCaptureSmoke(
  options: LiveProviderCaptureOptions,
): Promise<LiveProviderCaptureArtifact> {
  const outputPath = resolve(options.outputPath)
  const tracePath = resolve(options.tracePath)
  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com')
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY
  const timeoutMs = options.timeoutMs ?? 60_000

  if (!apiKey) {
    const artifact = buildBaseArtifact({
      outputPath,
      tracePath,
      model,
      baseUrl,
      timeoutMs,
      status: 'SKIPPED_NO_API_KEY',
      liveProviderAttempted: false,
      skipReason: 'DEEPSEEK_API_KEY is not set; live provider capture was skipped without fabricating evidence.',
    })
    await writeArtifact(outputPath, artifact)
    if (options.requireLive) {
      throw new Error('DEEPSEEK_API_KEY is not set; --require-live was requested')
    }
    return artifact
  }

  await mkdir(dirname(tracePath), { recursive: true })
  await rm(tracePath, { force: true })

  const restore = installTemporaryProviderEnvironment({ tracePath, fetchImpl: options.fetchImpl })
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      await DeepSeekAdapter.transformRequest(
        {
          model,
          max_tokens: 48,
          temperature: 0,
          stream: false,
          system: 'You are DSXU live provider smoke. Keep the answer short. Do not include secrets.',
          messages: [
            {
              role: 'user',
              content: 'Return a short confirmation that DSXU live provider smoke is reachable.',
            },
          ],
          metadata: {
            dsxu_route_input: {
              workflowKind: 'verification',
              role: 'verifier',
              riskLevel: 'low',
              failedVerification: false,
              retryAfterFailure: false,
            },
          },
        },
        {
          apiKey,
          baseUrl,
          signal: controller.signal,
        },
      )
    } finally {
      clearTimeout(timeout)
    }

    const imported = await importTrace(tracePath, {
      verificationPassed: true,
      outputStatus: 'success',
    })
    const artifact = buildBaseArtifact({
      outputPath,
      tracePath,
      model,
      baseUrl,
      timeoutMs,
      status: 'PASS_LIVE_PROVIDER_CAPTURE',
      liveProviderAttempted: true,
      imported,
    })
    await writeArtifact(outputPath, artifact)
    return artifact
  } catch (error) {
    const imported = await importTraceIfPresent(tracePath)
    const artifact = buildBaseArtifact({
      outputPath,
      tracePath,
      model,
      baseUrl,
      timeoutMs,
      status: 'FAIL_LIVE_PROVIDER_CAPTURE',
      liveProviderAttempted: true,
      imported,
      error: sanitizeError(error, apiKey),
    })
    await writeArtifact(outputPath, artifact)
    return artifact
  } finally {
    restore()
  }
}

async function importTrace(
  tracePath: string,
  input: { verificationPassed: boolean; outputStatus: 'success' | 'failed' },
): Promise<LiveProviderCaptureArtifact['import']> {
  const result = await exportTrainingTrajectoryFromRuntimeFile(tracePath, {
    taskId: 'live-provider-capture-smoke',
    category: 'live-provider-capture',
    intent: 'Capture a redacted DeepSeek live provider smoke trajectory through the DSXU DeepSeek adapter.',
    verificationCommands: ['DeepSeekAdapter live chat completion smoke'],
    verificationPassed: input.verificationPassed,
    claimBound: input.verificationPassed,
    outputStatus: input.outputStatus,
  })
  const validation = validateTrainingTrajectory(result.trajectory)
  const score = scoreTrainingTrajectory(result.trajectory)
  return {
    summary: result.summary,
    validation,
    score,
    trajectory: result.trajectory,
  }
}

async function importTraceIfPresent(tracePath: string): Promise<LiveProviderCaptureArtifact['import'] | undefined> {
  if (!existsSync(tracePath)) return undefined
  const text = await readFile(tracePath, 'utf8')
  if (text.trim().length === 0) return undefined
  return importTrace(tracePath, {
    verificationPassed: false,
    outputStatus: 'failed',
  })
}

function buildBaseArtifact(input: {
  outputPath: string
  tracePath: string
  model: string
  baseUrl: string
  timeoutMs: number
  status: LiveProviderCaptureStatus
  liveProviderAttempted: boolean
  imported?: LiveProviderCaptureArtifact['import']
  skipReason?: string
  error?: LiveProviderCaptureArtifact['error']
}): LiveProviderCaptureArtifact {
  return {
    schemaVersion: LIVE_PROVIDER_CAPTURE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    datasetKind: 'live_provider_capture_smoke',
    status: input.status,
    provider: 'deepseek',
    model: input.model,
    baseUrlHost: safeHost(input.baseUrl),
    liveProviderAttempted: input.liveProviderAttempted,
    liveProviderClaimAllowed: false,
    publicClaimAllowed: false,
    tracePath: input.tracePath,
    outputPath: input.outputPath,
    request: {
      stream: false,
      maxTokens: 48,
      temperature: 0,
      timeoutMs: input.timeoutMs,
      rawPromptStored: false,
    },
    ...(input.imported ? { import: input.imported } : {}),
    ...(input.skipReason ? { skipReason: input.skipReason } : {}),
    ...(input.error ? { error: input.error } : {}),
    rule: 'This artifact proves only a redacted DeepSeek live provider smoke attempt. It is not a public benchmark score, not a SWE-bench result, and not evidence of model superiority.',
  }
}

function installTemporaryProviderEnvironment(input: {
  tracePath: string
  fetchImpl?: typeof fetch
}): () => void {
  const oldTracePath = process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE
  const oldFetch = globalThis.fetch
  process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE = input.tracePath
  if (input.fetchImpl) {
    globalThis.fetch = input.fetchImpl
  }
  return () => {
    if (oldTracePath === undefined) {
      delete process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE
    } else {
      process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE = oldTracePath
    }
    if (input.fetchImpl) {
      globalThis.fetch = oldFetch
    }
  }
}

async function writeArtifact(path: string, artifact: LiveProviderCaptureArtifact): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function safeHost(value: string): string {
  try {
    return new URL(value).host
  } catch {
    return 'invalid-base-url'
  }
}

function sanitizeError(value: unknown, apiKey: string): { name: string; message: string } {
  const name = value instanceof Error ? value.name : 'Error'
  const rawMessage = value instanceof Error ? value.message : String(value)
  return {
    name,
    message: rawMessage.replaceAll(apiKey, '[REDACTED_API_KEY]'),
  }
}
