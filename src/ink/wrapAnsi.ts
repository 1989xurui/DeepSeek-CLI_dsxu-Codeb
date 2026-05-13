import wrapAnsiNpm from 'wrap-ansi'

type WrapAnsiOptions = {
  hard?: boolean
  wordWrap?: boolean
  trim?: boolean
}

const wrapAnsiBun =
  typeof Bun !== 'undefined' && typeof Bun.wrapAnsi === 'function'
    ? Bun.wrapAnsi
    : null

const wrapAnsi: (
  input: string,
  columns: number,
  options?: WrapAnsiOptions,
) => string = wrapAnsiBun ?? wrapAnsiNpm

export { wrapAnsi }


// V14 lifecycle shim: wrapansi
export function processWrapansiLifecycle(input) {
  void input
  const state = 'wrapansi-state'
  const lifecycle = 'wrapansi:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
