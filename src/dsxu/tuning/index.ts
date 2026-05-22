export type TuningHookPhase = 'pre-eval' | 'post-eval' | 'pre-release' | 'post-release'

export type TuningHookResult = {
  hookId: string
  action: 'noop' | 'alert' | 'recommend'
  message?: string
  details?: Record<string, unknown>
}

export type TuningHook = {
  id: string
  phase: TuningHookPhase
  priority: number
  enabled: boolean
  execute: (context: unknown) => Promise<TuningHookResult>
}

export class HookRegistry {
  private hooks = new Map<string, TuningHook>()

  register(hook: TuningHook): void {
    this.hooks.set(hook.id, hook)
  }

  unregister(id: string): void {
    this.hooks.delete(id)
  }

  list(phase?: TuningHookPhase): TuningHook[] {
    return Array.from(this.hooks.values())
      .filter((hook) => !phase || hook.phase === phase)
      .sort((a, b) => a.priority - b.priority)
  }

  async trigger(phase: TuningHookPhase, context: unknown): Promise<TuningHookResult[]> {
    const results: TuningHookResult[] = []
    for (const hook of this.list(phase)) {
      if (!hook.enabled) continue
      try {
        results.push(await hook.execute(context))
      } catch (error) {
        results.push({
          hookId: hook.id,
          action: 'alert',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return results
  }

  clear(): void {
    this.hooks.clear()
  }
}

export function createPlaceholderHooks(): TuningHook[] {
  return [
    'claim-boundary-review',
    'cache-regression-watch',
    'tool-evidence-watch',
    'release-risk-watch',
  ].map((id, index) => ({
    id,
    phase: 'post-eval' as const,
    priority: (index + 1) * 10,
    enabled: false,
    execute: async () => ({ hookId: id, action: 'noop' as const }),
  }))
}
