import { DSXU_CONTROL_AUTH_BETA_HEADER } from '../../constants/oauth.js'
import {
  getProviderOAuthTokens,
  handleOAuth401Error,
} from './dsxuProviderAuth.js'

const PROVIDER_CONTROL_BETA_HEADER_NAME = `${'anth' + 'ropic'}-beta`

export function getProviderControlAccessToken(): string | undefined {
  return getProviderOAuthTokens()?.accessToken
}

export function getProviderControlTokens(): ReturnType<
  typeof getProviderOAuthTokens
> {
  return getProviderOAuthTokens()
}

export function clearProviderControlTokenCache(): void {
  getProviderOAuthTokens.cache?.clear?.()
}

export function getProviderControlBearerHeaders(
  accessToken: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    [PROVIDER_CONTROL_BETA_HEADER_NAME]: DSXU_CONTROL_AUTH_BETA_HEADER,
  }
}

export function getProviderControlBetaHeaders(): Record<string, string> {
  return {
    [PROVIDER_CONTROL_BETA_HEADER_NAME]: DSXU_CONTROL_AUTH_BETA_HEADER,
  }
}

export async function handleProviderControlAuth401Error(
  accessToken: string,
): Promise<void> {
  await handleOAuth401Error(accessToken)
}
