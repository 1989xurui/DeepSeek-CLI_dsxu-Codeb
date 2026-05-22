import { useCallback } from 'react'
import type React from 'react'
import type { Command } from '../commands.js'
import type { Message } from '../types/message.js'

/** Delay retained for callers that still debounce the archived remote dialog state. */
export const BRIDGE_FAILURE_DISMISS_MS = 10_000

/**
 * DSXU default mainline no longer starts the archived bridge runtime from the REPL.
 * Remote/session routing is owned by the DSXU provider contract; archived bridge
 * compatibility must enter through an explicit provider alias outside this hook.
 */
export function useReplBridge(
  _messages: Message[],
  _setMessages: (action: React.SetStateAction<Message[]>) => void,
  _abortControllerRef: React.RefObject<AbortController | null>,
  _commands: readonly Command[],
  _mainLoopModel: string,
): {
  sendBridgeResult: () => void
} {
  const sendBridgeResult = useCallback(() => {
    // Intentionally inert: DSXU provider backends publish task/session events.
  }, [])

  return {
    sendBridgeResult,
  }
}

export function getDsxuUseReplBridgeRuntimeProfile() {
  return {
    runtime: 'DSXU provider REPL facade',
    defaultBehavior:
      'archived bridge initialization is unavailable on the default DSXU mainline',
    defaultOverride: 'DSXU provider contract handles local peer/session routing',
    archivedOverride: 'archived bridge code is not imported from useReplBridge',
  }
}
