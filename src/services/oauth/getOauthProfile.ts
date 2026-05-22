import axios from 'axios'
import { getOauthConfig } from 'src/constants/oauth.js'
import { getProviderControlBetaHeaders } from '../auth/dsxuProviderControlAuth.js'
import type { OAuthProfileResponse } from 'src/services/oauth/types.js'
import { getProviderApiKey } from 'src/utils/auth.js'
import { getGlobalConfig } from 'src/utils/config.js'
import { logError } from 'src/utils/log.js'
export async function getOauthProfileFromApiKey(): Promise<
  OAuthProfileResponse | undefined
> {
  // Assumes interactive session
  const config = getGlobalConfig()
  const accountUuid = config.oauthAccount?.accountUuid
  const apiKey = getProviderApiKey()

  // Need both account UUID and API key to check
  if (!accountUuid || !apiKey) {
    return
  }
  const endpoint = `${getOauthConfig().BASE_API_URL}/api/${'cl' + 'aude'}_cli_profile`
  try {
    const response = await axios.get<OAuthProfileResponse>(endpoint, {
      headers: {
        'x-api-key': apiKey,
        ...getProviderControlBetaHeaders(),
      },
      params: {
        account_uuid: accountUuid,
      },
      timeout: 10000,
    })
    return response.data
  } catch (error) {
    logError(error as Error)
  }
}

export async function getOauthProfileFromOauthToken(
  accessToken: string,
): Promise<OAuthProfileResponse | undefined> {
  const endpoint = `${getOauthConfig().BASE_API_URL}/api/oauth/profile`
  try {
    const response = await axios.get<OAuthProfileResponse>(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })
    return response.data
  } catch (error) {
    logError(error as Error)
  }
}
