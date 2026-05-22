type ContextCollapseStats = {
  collapsedSpans: number
  collapsedMessages: number
  stagedSpans: number
  health: {
    totalSpawns: number
    totalErrors: number
    lastError?: string
    emptySpawnWarningEmitted: boolean
    totalEmptySpawns: number
    disabledReason: string
  }
}

const listeners = new Set<() => void>()

const disabledReason =
  'DSXU context-collapse runtime is not active; DSXU autocompact/microcompact remain the context owner.'

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function initContextCollapse(): void {
  emit()
}

export function resetContextCollapse(): void {
  emit()
}

export function isContextCollapseEnabled(): boolean {
  return false
}

export function getStats(): ContextCollapseStats {
  return {
    collapsedSpans: 0,
    collapsedMessages: 0,
    stagedSpans: 0,
    health: {
      totalSpawns: 0,
      totalErrors: 0,
      emptySpawnWarningEmitted: false,
      totalEmptySpawns: 0,
      disabledReason,
    },
  }
}

export async function applyCollapsesIfNeeded<TMessage>(
  messages: TMessage[],
  _toolUseContext?: unknown,
  _querySource?: unknown,
): Promise<{
  messages: TMessage[]
  committed: number
  staged: number
}> {
  return {
    messages,
    committed: 0,
    staged: 0,
  }
}

export function recoverFromOverflow<TMessage>(
  messages: TMessage[],
  _querySource?: unknown,
): {
  messages: TMessage[]
  committed: number
} {
  return {
    messages,
    committed: 0,
  }
}

export function isWithheldPromptTooLong(
  _message?: unknown,
  _isPromptTooLongMessage?: (message: unknown) => boolean,
  _querySource?: unknown,
): boolean {
  return false
}
