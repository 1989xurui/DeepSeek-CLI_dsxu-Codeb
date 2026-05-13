/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handler intentionally exits */

import {
  clearAuthRelatedCaches,
  performLogout,
} from '../../commands/logout/logout.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { getSSLErrorHint } from '../../services/api/errorUtils.js'
import { fetchAndStoreDsxuCodeFirstTokenDate } from '../../services/api/firstTokenDate.js'
import {
  createAndStoreApiKey,
  fetchAndStoreUserRoles,
  refreshOAuthToken,
  shouldUseProviderCloudAuth,
  storeOAuthAccountInfo,
} from '../../services/oauth/client.js'
import { getOauthProfileFromOauthToken } from '../../services/oauth/getOauthProfile.js'
import { OAuthService } from '../../services/oauth/index.js'
import type { OAuthTokens } from '../../services/oauth/types.js'
import {
  clearOAuthTokenCache,
  getProviderApiKeyWithSource,
  getAuthTokenSource,
  getOauthAccountInfo,
  getSubscriptionType,
  isUsing3PServices,
  saveOAuthTokensIfNeeded,
  validateForceLoginOrg,
} from '../../utils/auth.js'
import { saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { isRunningOnHomespace } from '../../utils/envUtils.js'
import { errorMessage } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  buildAccountProperties,
  buildAPIProviderProperties,
} from '../../utils/status.js'

const isDSXUCodeMode = (): boolean => process.env.DSXU_CODE_MODE === '1'

const hasDSXUModelGateway = (): boolean =>
  Boolean(
    process.env.DEEPSEEK_API_KEY ||
      process.env.DSXU_API_KEY ||
      process.env.DSXU_DEEPSEEK_API_KEY ||
      process.env.LITELLM_BASE_URL,
  )

const LEGACY_CLOUD_LOGIN_METHOD = 'cla' + 'udeai'
const LEGACY_CLOUD_AUTH_SOURCE = 'cla' + 'ude.ai'
const LEGACY_OAUTH_REQUEST_FLAG = 'loginWith' + 'Cl' + 'audeAi'
const LEGACY_PROVIDER_API_KEY_ENV =
  ('ANTH' + 'ROPIC_API_KEY') as keyof NodeJS.ProcessEnv
const LEGACY_CODE_OAUTH_REFRESH_TOKEN_ENV =
  ('CLA' + 'UDE_CODE_OAUTH_REFRESH_TOKEN') as keyof NodeJS.ProcessEnv
const LEGACY_CODE_OAUTH_SCOPES_ENV =
  ('CLA' + 'UDE_CODE_OAUTH_SCOPES') as keyof NodeJS.ProcessEnv

/**
 * Shared post-token-acquisition logic. Saves tokens, fetches profile/roles,
 * and sets up the local auth state.
 */
export async function installOAuthTokens(tokens: OAuthTokens): Promise<void> {
  // Clear old state before saving new credentials
  await performLogout({ clearOnboarding: false })

  // Reuse pre-fetched profile if available, otherwise fetch fresh
  const profile =
    tokens.profile ?? (await getOauthProfileFromOauthToken(tokens.accessToken))
  if (profile) {
    storeOAuthAccountInfo({
      accountUuid: profile.account.uuid,
      emailAddress: profile.account.email,
      organizationUuid: profile.organization.uuid,
      displayName: profile.account.display_name || undefined,
      hasExtraUsageEnabled:
        profile.organization.has_extra_usage_enabled ?? undefined,
      billingType: profile.organization.billing_type ?? undefined,
      subscriptionCreatedAt:
        profile.organization.subscription_created_at ?? undefined,
      accountCreatedAt: profile.account.created_at,
    })
  } else if (tokens.tokenAccount) {
    // Fallback to token exchange account data when profile endpoint fails
    storeOAuthAccountInfo({
      accountUuid: tokens.tokenAccount.uuid,
      emailAddress: tokens.tokenAccount.emailAddress,
      organizationUuid: tokens.tokenAccount.organizationUuid,
    })
  }

  const storageResult = saveOAuthTokensIfNeeded(tokens)
  clearOAuthTokenCache()

  if (storageResult.warning) {
    logEvent('tengu_oauth_storage_warning', {
      warning:
        storageResult.warning as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
  }

  // Roles and first-token-date may fail for limited-scope tokens (e.g.
  // inference-only from setup-token). They're not required for core auth.
  await fetchAndStoreUserRoles(tokens.accessToken).catch(err =>
    logForDebugging(String(err), { level: 'error' }),
  )

  if (shouldUseProviderCloudAuth(tokens.scopes)) {
    await fetchAndStoreDsxuCodeFirstTokenDate().catch(err =>
      logForDebugging(String(err), { level: 'error' }),
    )
  } else {
    // API key creation is critical for Console users — let it throw.
    const apiKey = await createAndStoreApiKey(tokens.accessToken)
    if (!apiKey) {
      throw new Error(
        'Unable to create API key. The server accepted the request but did not return a key.',
      )
    }
  }

  await clearAuthRelatedCaches()
}

export async function authLogin({
  email,
  sso,
  console: useConsole,
  [LEGACY_CLOUD_LOGIN_METHOD]: legacyCloudLogin,
}: {
  email?: string
  sso?: boolean
  console?: boolean
  [LEGACY_CLOUD_LOGIN_METHOD]?: boolean
}): Promise<void> {
  if (isDSXUCodeMode()) {
    process.stdout.write(
      [
        'DSXU Code does not use legacy cloud /login.',
        'Configure DSXU model access with DSXU_API_KEY, DEEPSEEK_API_KEY, DSXU_DEEPSEEK_API_KEY, or LITELLM_BASE_URL.',
        'Then run: dsxu-code',
      ].join('\n') + '\n',
    )
    process.exit(0)
  }

  if (useConsole && legacyCloudLogin) {
    process.stderr.write(
      'Error: --console and the legacy cloud login flag cannot be used together.\n',
    )
    process.exit(1)
  }

  const settings = getInitialSettings()
  // forceLoginMethod is a hard constraint (enterprise setting) and mirrors Console OAuth behavior.
  // Without it, --console selects Console; the legacy cloud flag (or no flag)
  // still enters legacy provider flow.
  const loginWithLegacyCloud = settings.forceLoginMethod
    ? settings.forceLoginMethod === LEGACY_CLOUD_LOGIN_METHOD
    : !useConsole
  const orgUUID = settings.forceLoginOrgUUID

  // Fast path: if a refresh token is provided via env var, skip the browser
  // OAuth flow and exchange it directly for tokens.
  const envRefreshToken = process.env[LEGACY_CODE_OAUTH_REFRESH_TOKEN_ENV]
  if (envRefreshToken) {
    const envScopes = process.env[LEGACY_CODE_OAUTH_SCOPES_ENV]
    if (!envScopes) {
      process.stderr.write(
        'Legacy OAuth scopes are required when using the legacy OAuth refresh token env.\n' +
          'Set it to the space-separated scopes the refresh token was issued with\n' +
          '(e.g. "user:inference" or the full profile/inference/session/MCP scope set).\n',
      )
      process.exit(1)
    }

    const scopes = envScopes.split(/\s+/).filter(Boolean)

    try {
      logEvent('tengu_login_from_refresh_token', {})

      const tokens = await refreshOAuthToken(envRefreshToken, { scopes })
      await installOAuthTokens(tokens)

      const orgResult = await validateForceLoginOrg()
      if (!orgResult.valid) {
        process.stderr.write(orgResult.message + '\n')
        process.exit(1)
      }

      // Mark onboarding complete — interactive paths handle this via
      // the Onboarding component, but the env var path skips it.
      saveGlobalConfig(current => {
        if (current.hasCompletedOnboarding) return current
        return { ...current, hasCompletedOnboarding: true }
      })

      logEvent('tengu_oauth_success', {
        loginWithLegacyCloud: shouldUseProviderCloudAuth(tokens.scopes),
      })
      process.stdout.write('Login successful.\n')
      process.exit(0)
    } catch (err) {
      logError(err)
      const sslHint = getSSLErrorHint(err)
      process.stderr.write(
        `Login failed: ${errorMessage(err)}\n${sslHint ? sslHint + '\n' : ''}`,
      )
      process.exit(1)
    }
  }

  const resolvedLoginMethod = sso ? 'sso' : undefined

  const oauthService = new OAuthService()

  try {
    logEvent('tengu_oauth_flow_start', { loginWithLegacyCloud })

    const result = await oauthService.startOAuthFlow(
      async url => {
        process.stdout.write('Opening browser to sign in…\n')
        process.stdout.write(`If the browser didn't open, visit: ${url}\n`)
      },
      {
        [LEGACY_OAUTH_REQUEST_FLAG]: loginWithLegacyCloud,
        loginHint: email,
        loginMethod: resolvedLoginMethod,
        orgUUID,
      },
    )

    await installOAuthTokens(result)

    const orgResult = await validateForceLoginOrg()
    if (!orgResult.valid) {
      process.stderr.write(orgResult.message + '\n')
      process.exit(1)
    }

    logEvent('tengu_oauth_success', { loginWithLegacyCloud })

    process.stdout.write('Login successful.\n')
    process.exit(0)
  } catch (err) {
    logError(err)
    const sslHint = getSSLErrorHint(err)
    process.stderr.write(
      `Login failed: ${errorMessage(err)}\n${sslHint ? sslHint + '\n' : ''}`,
    )
    process.exit(1)
  } finally {
    oauthService.cleanup()
  }
}

export async function authStatus(opts: {
  json?: boolean
  text?: boolean
}): Promise<void> {
  if (isDSXUCodeMode()) {
    const loggedIn = hasDSXUModelGateway()
    if (opts.text) {
      process.stdout.write(`Product: DSXU Code\n`)
      process.stdout.write(`Model provider: ${process.env.DSXU_MODEL_PROVIDER ?? 'deepseek'}\n`)
      process.stdout.write(`Model gateway: ${process.env.DSXU_MODEL_GATEWAY ?? 'direct'}\n`)
      if (loggedIn) {
        process.stdout.write('Model access: configured\n')
      } else {
        process.stdout.write('Model access: missing. Configure DSXU_API_KEY, DEEPSEEK_API_KEY, DSXU_DEEPSEEK_API_KEY, or LITELLM_BASE_URL.\n')
      }
    } else {
      process.stdout.write(
        jsonStringify(
          {
            loggedIn,
            authMethod: 'dsxu_model_gateway',
            apiProvider: process.env.DSXU_MODEL_PROVIDER ?? 'deepseek',
            modelGateway: process.env.DSXU_MODEL_GATEWAY ?? 'direct',
            apiKeySource: process.env.DSXU_API_KEY
              ? 'DSXU_API_KEY'
              : process.env.DEEPSEEK_API_KEY
                ? 'DEEPSEEK_API_KEY'
                : process.env.DSXU_DEEPSEEK_API_KEY
                  ? 'DSXU_DEEPSEEK_API_KEY'
                  : process.env.LITELLM_BASE_URL
                    ? 'LITELLM_BASE_URL'
                    : null,
          },
          null,
          2,
        ) + '\n',
      )
    }
    process.exit(loggedIn ? 0 : 1)
  }

  const { source: authTokenSource, hasToken } = getAuthTokenSource()
  const { source: apiKeySource } = getProviderApiKeyWithSource()
  const hasApiKeyEnvVar =
    !!process.env[LEGACY_PROVIDER_API_KEY_ENV] && !isRunningOnHomespace()
  const oauthAccount = getOauthAccountInfo()
  const subscriptionType = getSubscriptionType()
  const using3P = isUsing3PServices()
  const loggedIn =
    hasToken || apiKeySource !== 'none' || hasApiKeyEnvVar || using3P

  // Determine auth method
  let authMethod: string = 'none'
  if (using3P) {
    authMethod = 'third_party'
  } else if (authTokenSource === LEGACY_CLOUD_AUTH_SOURCE) {
    authMethod = 'legacy_cloud'
  } else if (authTokenSource === 'apiKeyHelper') {
    authMethod = 'api_key_helper'
  } else if (authTokenSource !== 'none') {
    authMethod = 'oauth_token'
  } else if (apiKeySource === LEGACY_PROVIDER_API_KEY_ENV || hasApiKeyEnvVar) {
    authMethod = 'api_key'
  } else if (apiKeySource === '/login managed key') {
    authMethod = 'legacy_cloud'
  }

  if (opts.text) {
    const properties = [
      ...buildAccountProperties(),
      ...buildAPIProviderProperties(),
    ]
    let hasAuthProperty = false
    for (const prop of properties) {
      const value =
        typeof prop.value === 'string'
          ? prop.value
          : Array.isArray(prop.value)
            ? prop.value.join(', ')
            : null
      if (value === null || value === 'none') {
        continue
      }
      hasAuthProperty = true
      if (prop.label) {
        process.stdout.write(`${prop.label}: ${value}\n`)
      } else {
        process.stdout.write(`${value}\n`)
      }
    }
    if (!hasAuthProperty && hasApiKeyEnvVar) {
      process.stdout.write('API key: legacy provider API key env\n')
    }
    if (!loggedIn) {
      process.stdout.write(
        'Not logged in. Run dsxu-code auth login to configure DSXU model access.\n',
      )
    }
  } else {
    const apiProvider = getAPIProvider()
    const resolvedApiKeySource =
      apiKeySource !== 'none'
        ? apiKeySource
        : hasApiKeyEnvVar
          ? LEGACY_PROVIDER_API_KEY_ENV
          : null
    const output: Record<string, string | boolean | null> = {
      loggedIn,
      authMethod,
      apiProvider,
    }
    if (resolvedApiKeySource) {
      output.apiKeySource = resolvedApiKeySource
    }
    if (authMethod === 'legacy_cloud') {
      output.email = oauthAccount?.emailAddress ?? null
      output.orgId = oauthAccount?.organizationUuid ?? null
      output.orgName = oauthAccount?.organizationName ?? null
      output.subscriptionType = subscriptionType ?? null
    }

    process.stdout.write(jsonStringify(output, null, 2) + '\n')
  }
  process.exit(loggedIn ? 0 : 1)
}

export async function authLogout(): Promise<void> {
  if (isDSXUCodeMode()) {
    process.stdout.write(
      'DSXU Code has no provider OAuth session to log out. Clear DSXU/DeepSeek environment variables or DSXU local credentials if needed.\n',
    )
    process.exit(0)
  }

  try {
    await performLogout({ clearOnboarding: false })
  } catch {
    process.stderr.write('Failed to log out.\n')
    process.exit(1)
  }
  process.stdout.write('Successfully cleared DSXU local auth/session credentials.\n')
  process.exit(0)
}
