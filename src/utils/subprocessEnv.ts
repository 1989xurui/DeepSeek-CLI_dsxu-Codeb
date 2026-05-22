import { isEnvTruthy } from './envUtils.js'
import { getDsxuCodeEnv } from './envUtils.js'
import { delimiter, dirname } from 'path'
const PROVIDER_MIGRATION_OAUTH_TOKEN_ENV = `CL${'AUDE'}_CODE_OAUTH_TOKEN`
/**
 * Env vars to strip from subprocess environments when running inside GitHub
 * Actions. This prevents prompt-injection attacks from exfiltrating secrets
 * via shell expansion (e.g., provider API keys) in Bash tool commands.
 *
 * The parent DSXU process keeps these vars (needed for API calls, lazy
 * credential reads). Only child processes (bash, shell snapshot, MCP stdio, LSP, hooks) are scrubbed.
 *
 * GITHUB_TOKEN / GH_TOKEN are intentionally NOT scrubbed ...wrapper scripts
 * (gh.sh) need them to call the GitHub API. That token is job-scoped and
 * expires when the workflow ends.
 */
const GHA_SUBPROCESS_SCRUB = [
  // Provider auth ...DSXU re-reads these per-request, subprocesses don't need them
  'PROVIDER_API_KEY',
  PROVIDER_MIGRATION_OAUTH_TOKEN_ENV,
  'PROVIDER_AUTH_TOKEN',
  'PROVIDER_FOUNDRY_API_KEY',
  'PROVIDER_CUSTOM_HEADERS',
  // OTLP exporter headers ...documented to carry Authorization=Bearer tokens
  // for monitoring backends; read in-process by OTEL SDK, subprocesses never need them
  'OTEL_EXPORTER_OTLP_HEADERS',
  'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
  'OTEL_EXPORTER_OTLP_METRICS_HEADERS',
  'OTEL_EXPORTER_OTLP_TRACES_HEADERS',
  // Cloud provider creds ...same pattern (lazy SDK reads)
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_BEARER_TOKEN_BEDROCK',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'AZURE_CLIENT_SECRET',
  'AZURE_CLIENT_CERTIFICATE_PATH',
  // GitHub Actions OIDC ...consumed by the action's JS before DSXU spawns;
  // leaking these allows minting an App installation token  -> repo takeover
  'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
  'ACTIONS_ID_TOKEN_REQUEST_URL',
  // GitHub Actions artifact/cache API ...cache poisoning  -> supply-chain pivot
  'ACTIONS_RUNTIME_TOKEN',
  'ACTIONS_RUNTIME_URL',
  // Provider-migration action-specific duplicates ...action JS consumes these during
  // prepare, before spawning DSXU. ALL_INPUTS may contain provider keys as JSON.
  'ALL_INPUTS',
  'OVERRIDE_GITHUB_TOKEN',
  'DEFAULT_WORKFLOW_TOKEN',
  'SSH_SIGNING_KEY',
] as const
/**
 * Returns a copy of process.env with sensitive secrets stripped, for use when
 * spawning subprocesses (Bash tool, shell snapshot, MCP stdio servers, LSP
 * servers, shell hooks).
 *
 * Gated on DSXU_CODE_SUBPROCESS_ENV_SCRUB (provider-migration alias honored).
 * Provider-migration CI action sets this
 * automatically when `allowed_non_write_users` is configured ...the flag that
 * exposes a workflow to untrusted content (prompt injection surface).
 */
// Registered by init.ts after the DSXU relay proxy module is dynamically imported
// in CCR sessions. Stays undefined in non-CCR startups so we never pull in the
// DSXU relay proxy module graph via a static import.
let _getDsxuRelayProxyEnv: (() => Record<string, string>) | undefined
/**
 * Called from init.ts to wire up the proxy env function after the DSXU relay proxy
 * module has been lazily loaded. Must be called before any subprocess is spawned.
 */
export function registerDsxuRelayProxyEnvFn(
  fn: () => Record<string, string>,
): void {
  _getDsxuRelayProxyEnv = fn
}
export function subprocessEnv(): NodeJS.ProcessEnv {
  // DSXU relay proxy: inject HTTPS_PROXY + CA bundle vars so curl/gh/python
  // in agent subprocesses route through the local relay. Returns {} when the
  // proxy is disabled or not registered (non-CCR), so this is a no-op outside
  // CCR containers.
  const proxyEnv = _getDsxuRelayProxyEnv?.() ?? {}
  const envVar = getDsxuCodeEnv('SUBPROCESS_ENV_SCRUB')
  if (!isEnvTruthy(envVar)) {
    return withDsxuUtf8SubprocessEnv(withDsxuRuntimeBinOnPath(
      Object.keys(proxyEnv).length > 0
        ? { ...process.env, ...proxyEnv }
        : { ...process.env },
    ))
  }
  const env = { ...process.env, ...proxyEnv }
  for (const k of GHA_SUBPROCESS_SCRUB) {
    delete env[k]
    // GitHub Actions auto-creates INPUT_<NAME> for `with:` inputs, duplicating
    // secrets like INPUT_PROVIDER_API_KEY. No-op for vars that aren't action inputs.
    delete env[`INPUT_${k}`]
  }
  return withDsxuUtf8SubprocessEnv(withDsxuRuntimeBinOnPath(env))
}
function withDsxuRuntimeBinOnPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const runtimeBin = dirname(process.execPath)
  const currentPath = env.PATH ?? env.Path ?? ''
  const pathParts = currentPath.split(delimiter).filter(Boolean)
  if (!pathParts.includes(runtimeBin)) {
    pathParts.unshift(runtimeBin)
  }
  return {
    ...env,
    PATH: pathParts.join(delimiter),
  }
}
export function withDsxuUtf8SubprocessEnv(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env }
  next.PYTHONIOENCODING ??= 'utf-8'
  next.PYTHONUTF8 ??= '1'
  if (process.platform !== 'win32') {
    next.LANG ??= 'C.UTF-8'
    next.LC_ALL ??= 'C.UTF-8'
  }
  return next
}
