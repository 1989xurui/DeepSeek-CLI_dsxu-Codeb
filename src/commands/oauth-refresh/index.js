export default { isEnabled: () => false, isHidden: true, name: 'stub' };


// V14 command lifecycle shim: oauth-refresh
export function processOauthRefreshCommandLifecycle(input) {
  void input
  const state = 'oauth-refresh-command-state'
  const lifecycle = 'oauth-refresh:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'oauth-refresh',
  }
}

export function runOauthRefreshCommand(input) {
  return processOauthRefreshCommandLifecycle(input)
}
