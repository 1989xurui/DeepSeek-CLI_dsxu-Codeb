export const NO_CONTENT_MESSAGE = '(no content)'


// V14 strict lifecycle shim: constants-messages
export function processConstantsMessagesStrictLifecycle(input) {
  void input
  const state = 'constants-messages-state'
  const lifecycle = 'constants-messages:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runConstantsMessagesStrict(input) {
  return processConstantsMessagesStrictLifecycle(input)
}
