export class Event {
  private _didStopImmediatePropagation = false

  didStopImmediatePropagation(): boolean {
    return this._didStopImmediatePropagation
  }

  stopImmediatePropagation(): void {
    this._didStopImmediatePropagation = true
  }
}


// V14 lifecycle shim: event
export function processEventLifecycle(input) {
  void input
  const state = 'event-state'
  const lifecycle = 'event:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
