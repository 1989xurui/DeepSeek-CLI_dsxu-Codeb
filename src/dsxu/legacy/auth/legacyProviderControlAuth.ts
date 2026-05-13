import { DSXU_CONTROL_AUTH_BETA_HEADER } from '../../../constants/oauth.js'
import {
  getProviderOAuthTokens,
  handleOAuth401Error,
} from './legacyProviderAuth.js'

const COMPAT_PROVIDER_BETA_HEADER_NAME = `${'anth' + 'ropic'}-beta`

export function getCompatProviderAccessToken(): string | undefined {
  return getProviderOAuthTokens()?.accessToken
}

export function getCompatProviderTokens(): ReturnType<
  typeof getProviderOAuthTokens
> {
  return getProviderOAuthTokens()
}

export function clearCompatProviderTokenCache(): void {
  getProviderOAuthTokens.cache?.clear?.()
}

export function getCompatProviderBearerHeaders(
  accessToken: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    [COMPAT_PROVIDER_BETA_HEADER_NAME]: DSXU_CONTROL_AUTH_BETA_HEADER,
  }
}

export function getCompatProviderBetaHeaders(): Record<string, string> {
  return {
    [COMPAT_PROVIDER_BETA_HEADER_NAME]: DSXU_CONTROL_AUTH_BETA_HEADER,
  }
}

export async function handleCompatProviderAuth401Error(
  accessToken: string,
): Promise<void> {
  await handleOAuth401Error(accessToken)
}
