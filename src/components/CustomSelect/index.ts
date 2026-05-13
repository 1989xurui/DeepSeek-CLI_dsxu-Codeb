export * from './SelectMulti.js'
export type { OptionWithDescription } from './select.js'
export * from './select.js'


// V14 strict lifecycle shim: components-CustomSelect-index
export function processComponentsCustomSelectIndexStrictLifecycle(input) {
  void input
  const state = 'components-CustomSelect-index-state'
  const lifecycle = 'components-CustomSelect-index:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runComponentsCustomSelectIndexStrict(input) {
  return processComponentsCustomSelectIndexStrictLifecycle(input)
}
