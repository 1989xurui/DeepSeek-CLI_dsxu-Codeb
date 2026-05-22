import axios from 'axios'
import { getOauthConfig } from '../../constants/oauth.js'
import { getProviderControlAccessToken } from '../../services/auth/dsxuProviderControlAuth.js'
import { getOrganizationUUID } from '../../services/oauth/client.js'
import type { ToolUseContext } from '../../Tool.js'
import { checkAndRefreshOAuthTokenIfNeeded } from '../../utils/auth.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import type { Input, Output } from './RemoteTriggerTool.js'

const TRIGGERS_BETA = 'ccr-triggers-2026-01-30'

export async function callProviderMigrationRemoteTriggerProvider(
  input: Input,
  context: ToolUseContext,
): Promise<Output> {
  await checkAndRefreshOAuthTokenIfNeeded()
  const accessToken = getProviderControlAccessToken()
  if (!accessToken) {
    throw new Error(
      'Provider migration remote trigger provider is isolated. Run DSXU migration tooling only if you intentionally need provider migration remote trigger import.',
    )
  }
  const orgUUID = await getOrganizationUUID()
  if (!orgUUID) {
    throw new Error('Unable to resolve provider migration organization UUID.')
  }

  const base = `${getOauthConfig().BASE_API_URL}/v1/code/triggers`
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'provider-version': '2023-06-01',
    'provider-beta': TRIGGERS_BETA,
    'x-organization-uuid': orgUUID,
  }

  const { action, trigger_id, body } = input
  let method: 'GET' | 'POST'
  let url: string
  let data: unknown
  switch (action) {
    case 'list':
      method = 'GET'
      url = base
      break
    case 'get':
      if (!trigger_id) throw new Error('get requires trigger_id')
      method = 'GET'
      url = `${base}/${trigger_id}`
      break
    case 'create':
      if (!body) throw new Error('create requires body')
      method = 'POST'
      url = base
      data = body
      break
    case 'update':
      if (!trigger_id) throw new Error('update requires trigger_id')
      if (!body) throw new Error('update requires body')
      method = 'POST'
      url = `${base}/${trigger_id}`
      data = body
      break
    case 'run':
      if (!trigger_id) throw new Error('run requires trigger_id')
      method = 'POST'
      url = `${base}/${trigger_id}/run`
      data = {}
      break
  }

  const res = await axios.request({
    method,
    url,
    headers,
    data,
    timeout: 20_000,
    signal: context.abortController.signal,
    validateStatus: () => true,
  })

  return {
    status: res.status,
    json: jsonStringify(res.data),
  }
}
