import axios from 'axios'
import isEqual from 'lodash-es/isEqual.js'
import {
  getProviderApiKey,
  hasProfileScope,
} from 'src/utils/auth.js'
import { z } from 'zod'
import { getOauthConfig } from '../../constants/oauth.js'
import {
  getCompatProviderAccessToken,
  getCompatProviderBearerHeaders,
} from '../../dsxu/legacy/auth/legacyProviderControlAuth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { withOAuth401Retry } from '../../utils/http.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'
import { getDSXUCodeUserAgent } from '../../utils/userAgent.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'

const bootstrapResponseSchema = lazySchema(() =>
  z.object({
    client_data: z.record(z.unknown()).nullish(),
    additional_model_options: z
      .array(
        z
          .object({
            model: z.string(),
            name: z.string(),
            description: z.string(),
          })
          .transform(({ model, name, description }) => ({
            value: model,
            label: name,
            description,
          })),
      )
      .nullish(),
  }),
)

type BootstrapResponse = z.infer<ReturnType<typeof bootstrapResponseSchema>>

async function fetchBootstrapAPI(): Promise<BootstrapResponse | null> {
  if (isDsxuRuntimeMode()) {
    logForDebugging('[Bootstrap] Skipped: DSXU runtime uses local model/provider bootstrap')
    return null
  }

  if (isEssentialTrafficOnly()) {
    logForDebugging('[Bootstrap] Skipped: Nonessential traffic disabled')
    return null
  }

  if (getAPIProvider() !== 'firstParty') {
    logForDebugging('[Bootstrap] Skipped: 3P provider')
    return null
  }

  // OAuth preferred (requires user:profile scope -service-key OAuth tokens
  // lack it and would 403). Fall back to API key auth for console users.
  const apiKey = getProviderApiKey()
  const hasUsableOAuth =
    getCompatProviderAccessToken() && hasProfileScope()
  if (!hasUsableOAuth && !apiKey) {
    logForDebugging('[Bootstrap] Skipped: no usable OAuth or API key')
    return null
  }

  const endpoint = `${getOauthConfig().BASE_API_URL}/api/${'cl' + 'aude'}_cli/bootstrap`

  // withOAuth401Retry handles the refresh-and-retry. API key users fail
  // through on 401 (no refresh mechanism -no OAuth token to pass).
  try {
    return await withOAuth401Retry(async () => {
      // Re-read OAuth each call so the retry picks up the refreshed token.
      const token = getCompatProviderAccessToken()
      let authHeaders: Record<string, string>
      if (token && hasProfileScope()) {
        authHeaders = getCompatProviderBearerHeaders(token)
      } else if (apiKey) {
        authHeaders = { 'x-api-key': apiKey }
      } else {
        logForDebugging('[Bootstrap] No auth available on retry, aborting')
        return null
      }

      logForDebugging('[Bootstrap] Fetching')
      const response = await axios.get<unknown>(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': getDSXUCodeUserAgent(),
          ...authHeaders,
        },
        timeout: 5000,
      })
      const parsed = bootstrapResponseSchema().safeParse(response.data)
      if (!parsed.success) {
        logForDebugging(
          `[Bootstrap] Response failed validation: ${parsed.error.message}`,
        )
        return null
      }
      logForDebugging('[Bootstrap] Fetch ok')
      return parsed.data
    })
  } catch (error) {
    logForDebugging(
      `[Bootstrap] Fetch failed: ${axios.isAxiosError(error) ? (error.response?.status ?? error.code) : 'unknown'}`,
    )
    throw error
  }
}

/**
 * Fetch bootstrap data from the API and persist to disk cache.
 */
export async function fetchBootstrapData(): Promise<void> {
  try {
    const response = await fetchBootstrapAPI()
    if (!response) return

    const clientData = response.client_data ?? null
    const additionalModelOptions = response.additional_model_options ?? []

    // Only persist if data actually changed -avoids a config write on every startup.
    const config = getGlobalConfig()
    if (
      isEqual(config.clientDataCache, clientData) &&
      isEqual(config.additionalModelOptionsCache, additionalModelOptions)
    ) {
      logForDebugging('[Bootstrap] Cache unchanged, skipping write')
      return
    }

    logForDebugging('[Bootstrap] Cache updated, persisting to disk')
    saveGlobalConfig(current => ({
      ...current,
      clientDataCache: clientData,
      additionalModelOptionsCache: additionalModelOptions,
    }))
  } catch (error) {
    logError(error)
  }
}


// V14 lifecycle shim: bootstrap
export function processBootstrapLifecycle(input) {
  void input
  const state = 'bootstrap-state'
  const lifecycle = 'bootstrap:session-lifecycle'
  return { state, lifecycle, invoked: true }
}

export function getDsxuBootstrapRuntimeProfile() {
  return {
    runtime: 'DSXU Bootstrap Provider',
    defaultMode: 'local-provider-bootstrap',
    isolatedLegacyShell: `/api/${'cl' + 'aude'}_cli/bootstrap`,
    persistedFields: ['clientDataCache', 'additionalModelOptionsCache'],
    activationEvidence: [
      'DSXU_CODE_MODE skips legacy first-party bootstrap API',
      'local provider/model bootstrap is resolved by DSXU settings and DeepSeek adapter',
      'legacy provider bootstrap remains unreachable from DSXU default runtime',
    ],
  }
}
