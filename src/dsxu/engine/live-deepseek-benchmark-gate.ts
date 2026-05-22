import { evaluateLiveProviderGate } from '../integration/harness/live-provider-gate-v1-harness'

export type V18LiveBenchmarkStatus = 'ready' | 'blocked'

export type V18LiveBenchmarkGate = {
  status: V18LiveBenchmarkStatus
  evidenceMode: 'config_probe_only'
  releaseEvidence: false
  provider: 'deepseek'
  requiredEnv: string[]
  reason?: string
  scenarios: string[]
}

export function getV18LiveDeepSeekBenchmarkGate(
  env: Record<string, string | undefined> = process.env,
): V18LiveBenchmarkGate {
  const providerGate = evaluateLiveProviderGate({ env })
  const hasKey = providerGate.ok
  return {
    status: hasKey ? 'ready' : 'blocked',
    evidenceMode: 'config_probe_only',
    releaseEvidence: false,
    provider: 'deepseek',
    requiredEnv: [
      'DSXU_API_KEY',
      'DEEPSEEK_API_KEY',
      'DSXU_DEEPSEEK_API_KEY',
      'LITELLM_BASE_URL',
      'DSXU_MODEL_GATEWAY',
    ],
    reason: hasKey
      ? undefined
      : 'No DeepSeek/DSXU/LiteLLM provider credential is available, so live model benchmark must not be reported as run.',
    scenarios: ['bugfix', 'feature', 'review', 'repo_understanding', 'recovery'],
  }
}
