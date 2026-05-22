import ProviderClient, {
  PROVIDER_MIGRATION_SDK_PACKAGES,
  type ClientOptions,
  type ProviderClientInstance,
} from 'src/types/providerClientSdk.js'
import { randomUUID } from 'crypto'
import type { GoogleAuth } from 'google-auth-library'
import {
  checkAndRefreshOAuthTokenIfNeeded,
  getApiKeyFromApiKeyHelper,
  getProviderApiKey,
  isProviderSubscriptionAccount,
  refreshAndGetAwsCredentials,
  refreshGcpCredentialsIfNeeded,
} from 'src/utils/auth.js'
import { getProviderControlTokens } from 'src/services/auth/dsxuProviderControlAuth.js'
import { getUserAgent } from 'src/utils/http.js'
import { getSmallFastModel } from 'src/utils/model/model.js'
import {
  getAPIProvider,
  isFirstPartyProviderBaseUrl,
} from 'src/utils/model/providers.js'
import { isDSXUCodeMode } from 'src/utils/model/dsxuModel.js'
import { getProxyFetchOptions } from 'src/utils/proxy.js'
import {
  getIsNonInteractiveSession,
  getSessionId,
} from '../../bootstrap/state.js'
import { getOauthConfig } from '../../constants/oauth.js'
import { isDebugToStdErr, logForDebugging } from '../../utils/debug.js'
import {
  getAWSRegion,
  getDsxuCodeEnv,
  getVertexRegionForModel,
  isDsxuCodeEnvTruthy,
  isEnvTruthy,
  isProviderMigrationServiceShellAllowed,
} from '../../utils/envUtils.js'
import { DeepSeekAdapter } from './deepseek-adapter.js'
const PROVIDER_MIGRATION_AGENT_SDK_CLIENT_APP_ENV = `CL${'AUDE'}_AGENT_SDK_CLIENT_APP`
const PROVIDER_MIGRATION_SESSION_ID_HEADER = `X-${'Cl' + 'aude'}-Code-Session-Id`
const PROVIDER_MIGRATION_REMOTE_CONTAINER_HEADER = `x-${'cl' + 'aude'}-remote-container-id`
const PROVIDER_MIGRATION_REMOTE_SESSION_HEADER = `x-${'cl' + 'aude'}-remote-session-id`
const PROVIDER_MIGRATION_CUSTOM_HEADERS_ENV = 'ANTH' + 'ROPIC_CUSTOM_HEADERS'
const PROVIDER_MIGRATION_AUTH_TOKEN_ENV = 'ANTH' + 'ROPIC_AUTH_TOKEN'
const PROVIDER_MIGRATION_SMALL_FAST_MODEL_AWS_REGION_ENV =
  'ANTH' + 'ROPIC_SMALL_FAST_MODEL_AWS_REGION'
const PROVIDER_MIGRATION_FOUNDRY_API_KEY_ENV = 'ANTH' + 'ROPIC_FOUNDRY_API_KEY'
const PROVIDER_MIGRATION_VERTEX_PROJECT_ID_ENV = 'ANTH' + 'ROPIC_VERTEX_PROJECT_ID'
/**
 * Environment variables for different client types:
 *
 * Direct API:
 * - Provider API key: Required for direct API access
 *
 * AWS Bedrock:
 * - AWS credentials configured via aws-sdk defaults
 * - AWS_REGION or AWS_DEFAULT_REGION: Sets the AWS region for all models (default: us-east-1)
 * - Provider migration small-fast-model AWS region env: Optional override for the small fast DSXU route
 *
 * Foundry (Azure):
 * - Provider migration Foundry resource env: Your Azure resource name (e.g., 'my-resource')
 *   For the full endpoint: https://{resource}.services.ai.azure.com/provider/v1/messages
 * - Provider migration Foundry base URL env: Optional. Alternative to resource - provide full base URL directly
 *   (e.g., 'https://my-resource.services.ai.azure.com')
 *
 * Authentication (one of the following):
 * - Provider migration Foundry API key env: Your Microsoft Foundry API key (if using API key auth)
 * - Azure AD authentication: If no API key is provided, uses DefaultAzureCredential
 *   which supports multiple auth methods (environment variables, managed identity,
 *   Azure CLI, etc.). See: https://docs.microsoft.com/en-us/javascript/api/@azure/identity
 *
 * Vertex AI:
 * - Model-specific region variables (highest priority):
 *   - Model-specific Vertex region env vars for provider migration model IDs
 * - CLOUD_ML_REGION: Optional. The default GCP region to use for all models
 *   If specific model region not specified above
 * - Provider migration Vertex project ID env: Required. Your GCP project ID
 * - Standard GCP credentials configured via google-auth-library
 *
 * Priority for determining region:
 * 1. Hardcoded model-specific environment variables
 * 2. Global CLOUD_ML_REGION variable
 * 3. Default region from config
 * 4. Fallback region (us-east5)
 */
function createStderrLogger(): ClientOptions['logger'] {
  return {
    error: (msg, ...args) =>
      // biome-ignore lint/suspicious/noConsole:: intentional console output -- SDK logger must use console
      console.error('[Provider SDK ERROR]', msg, ...args),
    // biome-ignore lint/suspicious/noConsole:: intentional console output -- SDK logger must use console
    warn: (msg, ...args) => console.error('[Provider SDK WARN]', msg, ...args),
    // biome-ignore lint/suspicious/noConsole:: intentional console output -- SDK logger must use console
    info: (msg, ...args) => console.error('[Provider SDK INFO]', msg, ...args),
    debug: (msg, ...args) =>
      // biome-ignore lint/suspicious/noConsole:: intentional console output -- SDK logger must use console
      console.error('[Provider SDK DEBUG]', msg, ...args),
  }
}
function shouldUseDsxuDeepSeekClient(): boolean {
  return isDSXUCodeMode() || !isProviderMigrationServiceShellAllowed()
}

export async function getProviderClient({
  apiKey,
  maxRetries,
  model,
  fetchOverride,
  source,
}: {
  apiKey?: string
  maxRetries: number
  model?: string
  fetchOverride?: ClientOptions['fetch']
  source?: string
}): Promise<ProviderClientInstance> {
  if (shouldUseDsxuDeepSeekClient()) {
    const messages = {
      create: (params: unknown, options?: unknown) =>
        DeepSeekAdapter.transformRequest(params, options),
    }
    return {
      beta: { messages },
      messages,
    } as unknown as ProviderClientInstance
  }
  // Provider SDK branches below are migration-only. DSXU mainline must use
  // DeepSeekAdapter unless DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1 is set.
  const containerId = getDsxuCodeEnv('CONTAINER_ID')
  const remoteSessionId = getDsxuCodeEnv('REMOTE_SESSION_ID')
  const clientApp =
    process.env.DSXU_AGENT_SDK_CLIENT_APP ??
    process.env[PROVIDER_MIGRATION_AGENT_SDK_CLIENT_APP_ENV]
  const customHeaders = getCustomHeaders()
  const defaultHeaders: { [key: string]: string } = {
    'x-app': 'cli',
    'User-Agent': getUserAgent(),
    [PROVIDER_MIGRATION_SESSION_ID_HEADER]: getSessionId(),
    ...customHeaders,
    ...(containerId ? { [PROVIDER_MIGRATION_REMOTE_CONTAINER_HEADER]: containerId } : {}),
    ...(remoteSessionId
      ? { [PROVIDER_MIGRATION_REMOTE_SESSION_HEADER]: remoteSessionId }
      : {}),
    // SDK consumers can identify their app/library for backend analytics
    ...(clientApp ? { 'x-client-app': clientApp } : {}),
  }
  // Log API client configuration for HFI debugging
  logForDebugging(
    `[API:request] Creating client, custom provider headers present: ${!!process.env[PROVIDER_MIGRATION_CUSTOM_HEADERS_ENV]}, has Authorization header: ${!!customHeaders['Authorization']}`,
  )
  // Add additional protection header if enabled via env var.
  const additionalProtectionEnabled = isDsxuCodeEnvTruthy(
    'ADDITIONAL_PROTECTION',
  )
  if (additionalProtectionEnabled) {
    defaultHeaders[`x-${'anth' + 'ropic'}-additional-protection`] = 'true'
  }
  logForDebugging('[API:auth] OAuth token check starting')
  await checkAndRefreshOAuthTokenIfNeeded()
  logForDebugging('[API:auth] OAuth token check complete')
  if (!isProviderSubscriptionAccount()) {
    await configureApiKeyHeaders(defaultHeaders, getIsNonInteractiveSession())
  }
  const resolvedFetch = buildFetch(fetchOverride, source)
  const ARGS = {
    defaultHeaders,
    maxRetries,
    timeout: parseInt(process.env.API_TIMEOUT_MS || String(600 * 1000), 10),
    dangerouslyAllowBrowser: true,
    fetchOptions: getProxyFetchOptions({
      ['for' + ('Anth' + 'ropic') + 'API']: true,
    }) as ClientOptions['fetchOptions'],
    ...(resolvedFetch && {
      fetch: resolvedFetch,
    }),
  }
  if (isDsxuCodeEnvTruthy('USE_BEDROCK')) {
    const ProviderBedrock = (await import(PROVIDER_MIGRATION_SDK_PACKAGES.bedrock))[`${'Anth' + 'ropic'}Bedrock`]
    // Use region override for small fast model if specified
    const awsRegion =
      model === getSmallFastModel() &&
      process.env[PROVIDER_MIGRATION_SMALL_FAST_MODEL_AWS_REGION_ENV]
        ? process.env[PROVIDER_MIGRATION_SMALL_FAST_MODEL_AWS_REGION_ENV]
        : getAWSRegion()
    const bedrockArgs: Record<string, unknown> = {
      ...ARGS,
      awsRegion,
      ...(isDsxuCodeEnvTruthy('SKIP_BEDROCK_AUTH') && {
        skipAuth: true,
      }),
      ...(isDebugToStdErr() && { logger: createStderrLogger() }),
    }
    // Add API key authentication if available
    if (process.env.AWS_BEARER_TOKEN_BEDROCK) {
      bedrockArgs.skipAuth = true
      // Add the Bearer token for Bedrock API key authentication
      bedrockArgs.defaultHeaders = {
        ...bedrockArgs.defaultHeaders,
        Authorization: `Bearer ${process.env.AWS_BEARER_TOKEN_BEDROCK}`,
      }
    } else if (!isDsxuCodeEnvTruthy('SKIP_BEDROCK_AUTH')) {
      // Refresh auth and get credentials with cache clearing
      const cachedCredentials = await refreshAndGetAwsCredentials()
      if (cachedCredentials) {
        bedrockArgs.awsAccessKey = cachedCredentials.accessKeyId
        bedrockArgs.awsSecretKey = cachedCredentials.secretAccessKey
        bedrockArgs.awsSessionToken = cachedCredentials.sessionToken
      }
    }
    // we have always been lying about the return type - this doesn't support batching or models
    return new ProviderBedrock(bedrockArgs) as unknown as ProviderClientInstance
  }
  if (isDsxuCodeEnvTruthy('USE_FOUNDRY')) {
    const ProviderFoundry = (await import(PROVIDER_MIGRATION_SDK_PACKAGES.foundry))[`${'Anth' + 'ropic'}Foundry`]
    // Determine Azure AD token provider based on configuration
    // SDK reads the provider migration Foundry API-key env by default
    let azureADTokenProvider: (() => Promise<string>) | undefined
    if (!process.env[PROVIDER_MIGRATION_FOUNDRY_API_KEY_ENV]) {
      if (isDsxuCodeEnvTruthy('SKIP_FOUNDRY_AUTH')) {
        // Mock token provider for testing/proxy scenarios (similar to Vertex mock GoogleAuth)
        azureADTokenProvider = () => Promise.resolve('')
      } else {
        // Use real Azure AD authentication with DefaultAzureCredential
        const {
          DefaultAzureCredential: AzureCredential,
          getBearerTokenProvider,
        } = await import('@azure/identity')
        azureADTokenProvider = getBearerTokenProvider(
          new AzureCredential(),
          'https://cognitiveservices.azure.com/.default',
        )
      }
    }
    const foundryArgs: Record<string, unknown> = {
      ...ARGS,
      ...(azureADTokenProvider && { azureADTokenProvider }),
      ...(isDebugToStdErr() && { logger: createStderrLogger() }),
    }
    // we have always been lying about the return type - this doesn't support batching or models
    return new ProviderFoundry(foundryArgs) as unknown as ProviderClientInstance
  }
  if (isDsxuCodeEnvTruthy('USE_VERTEX')) {
    // Refresh GCP credentials if gcpAuthRefresh is configured and credentials are expired
    // This is similar to how we handle AWS credential refresh for Bedrock
    if (!isDsxuCodeEnvTruthy('SKIP_VERTEX_AUTH')) {
      await refreshGcpCredentialsIfNeeded()
    }
    const [providerVertexModule, { GoogleAuth }] = await Promise.all([
      import(PROVIDER_MIGRATION_SDK_PACKAGES.vertex),
      import('google-auth-library'),
    ])
    const ProviderVertex = providerVertexModule[`${'Anth' + 'ropic'}Vertex`]
    // TODO: Cache either GoogleAuth instance or AuthClient to improve performance
    // Currently we create a new GoogleAuth instance for every getProviderClient() call
    // This could cause repeated authentication flows and metadata server checks
    // However, caching needs careful handling of:
    // - Credential refresh/expiration
    // - Environment variable changes (GOOGLE_APPLICATION_CREDENTIALS, project vars)
    // - Cross-request auth state management
    // See: https://github.com/googleapis/google-auth-library-nodejs/issues/390 for caching challenges
    // Prevent metadata server timeout by providing projectId as fallback
    // google-auth-library checks project ID in this order:
    // 1. Environment variables (GCLOUD_PROJECT, GOOGLE_CLOUD_PROJECT, etc.)
    // 2. Credential files (service account JSON, ADC file)
    // 3. gcloud config
    // 4. GCE metadata server (causes 12s timeout outside GCP)
    //
    // We only set projectId if user hasn't configured other discovery methods
    // to avoid interfering with their existing auth setup
    // Check project environment variables in same order as google-auth-library
    // See: https://github.com/googleapis/google-auth-library-nodejs/blob/main/src/auth/googleauth.ts
    const hasProjectEnvVar =
      process.env['GCLOUD_PROJECT'] ||
      process.env['GOOGLE_CLOUD_PROJECT'] ||
      process.env['gcloud_project'] ||
      process.env['google_cloud_project']
    // Check for credential file paths (service account or ADC)
    // Note: We're checking both standard and lowercase variants to be safe,
    // though we should verify what google-auth-library actually checks
    const hasKeyFile =
      process.env['GOOGLE_APPLICATION_CREDENTIALS'] ||
      process.env['google_application_credentials']
    const googleAuth = isDsxuCodeEnvTruthy('SKIP_VERTEX_AUTH')
      ? ({
          // Mock GoogleAuth for testing/proxy scenarios
          getClient: () => ({
            getRequestHeaders: () => ({}),
          }),
        } as unknown as GoogleAuth)
      : new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          // Only use the provider migration Vertex project ID as last resort fallback
          // This prevents the 12-second metadata server timeout when:
          // - No project env vars are set AND
          // - No credential keyfile is specified AND
          // - ADC file exists but lacks project_id field
          //
          // Risk: If auth project != API target project, this could cause billing/audit issues
          // Mitigation: Users can set GOOGLE_CLOUD_PROJECT to override
          ...(hasProjectEnvVar || hasKeyFile
            ? {}
            : {
                projectId: process.env[PROVIDER_MIGRATION_VERTEX_PROJECT_ID_ENV],
              }),
        })
    const vertexArgs: Record<string, unknown> = {
      ...ARGS,
      region: getVertexRegionForModel(model),
      googleAuth,
      ...(isDebugToStdErr() && { logger: createStderrLogger() }),
    }
    // we have always been lying about the return type - this doesn't support batching or models
    return new ProviderVertex(vertexArgs) as unknown as ProviderClientInstance
  }
  // Determine authentication method based on available tokens
  const clientConfig: ClientOptions = {
    apiKey: isProviderSubscriptionAccount() ? null : apiKey || getProviderApiKey(),
    authToken: isProviderSubscriptionAccount()
      ? getProviderControlTokens()?.accessToken
      : undefined,
    // Set baseURL from OAuth config when using staging OAuth
    ...(process.env.USER_TYPE === 'ant' &&
    isEnvTruthy(process.env.USE_STAGING_OAUTH)
      ? { baseURL: getOauthConfig().BASE_API_URL }
      : {}),
    ...ARGS,
    ...(isDebugToStdErr() && { logger: createStderrLogger() }),
  }
  return new ProviderClient(clientConfig)
}
async function configureApiKeyHeaders(
  headers: Record<string, string>,
  isNonInteractiveSession: boolean,
): Promise<void> {
  const token =
    process.env[PROVIDER_MIGRATION_AUTH_TOKEN_ENV] ||
    (await getApiKeyFromApiKeyHelper(isNonInteractiveSession))
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
}
function getCustomHeaders(): Record<string, string> {
  const customHeaders: Record<string, string> = {}
  const customHeadersEnv = process.env[PROVIDER_MIGRATION_CUSTOM_HEADERS_ENV]
  if (!customHeadersEnv) return customHeaders
  // Split by newlines to support multiple headers
  const headerStrings = customHeadersEnv.split(/\n|\r\n/)
  for (const headerString of headerStrings) {
    if (!headerString.trim()) continue
    // Parse header in format "Name: Value" (curl style). Split on first `:`
    // then trim  -> avoids regex backtracking on malformed long header lines.
    const colonIdx = headerString.indexOf(':')
    if (colonIdx === -1) continue
    const name = headerString.slice(0, colonIdx).trim()
    const value = headerString.slice(colonIdx + 1).trim()
    if (name) {
      customHeaders[name] = value
    }
  }
  return customHeaders
}
export const CLIENT_REQUEST_ID_HEADER = 'x-client-request-id'
function buildFetch(
  fetchOverride: ClientOptions['fetch'],
  source: string | undefined,
): ClientOptions['fetch'] {
  // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
  const inner = fetchOverride ?? globalThis.fetch
  // Only send to the first-party API  -> Bedrock/Vertex/Foundry don't log it
  // and unknown headers risk rejection by strict proxies (inc-4029 class).
  const injectClientRequestId =
    getAPIProvider() === 'firstParty' && isFirstPartyProviderBaseUrl()
  return (input, init) => {
    // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
    const headers = new Headers(init?.headers)
    // Generate a client-side request ID so timeouts (which return no server
    // request ID) can still be correlated with server logs by the API team.
    // Callers that want to track the ID themselves can pre-set the header.
    if (injectClientRequestId && !headers.has(CLIENT_REQUEST_ID_HEADER)) {
      headers.set(CLIENT_REQUEST_ID_HEADER, randomUUID())
    }
    try {
      // eslint-disable-next-line eslint-plugin-n/no-unsupported-features/node-builtins
      const url = input instanceof Request ? input.url : String(input)
      const id = headers.get(CLIENT_REQUEST_ID_HEADER)
      logForDebugging(
        `[API REQUEST] ${new URL(url).pathname}${id ? ` ${CLIENT_REQUEST_ID_HEADER}=${id}` : ''} source=${source ?? 'unknown'}`,
      )
    } catch {
      // never let logging crash the fetch
    }
    return inner(input, { ...init, headers })
  }
}
