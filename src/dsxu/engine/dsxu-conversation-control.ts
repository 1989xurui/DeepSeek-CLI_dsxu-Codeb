import { regenerateSessionId } from '../../bootstrap/state.js'
import type { AppState } from '../../state/AppStateStore.js'
import type { Message } from '../../types/message.js'
import {
  clearSessionMessagesCache,
  clearSessionMetadata,
  resetSessionFilePointer,
} from '../../utils/sessionStorage.js'

export type DSXUConversationControlInput = {
  setMessages?: (messages: Message[]) => void
  readFileState?: { clear?: () => void } | Map<unknown, unknown> | Set<unknown>
  discoveredSkillNames?: { clear?: () => void } | Set<unknown>
  loadedNestedMemoryPaths?: { clear?: () => void } | Set<unknown>
  getAppState?: () => AppState
  setAppState?: (updater: (prev: AppState) => AppState) => void
  setConversationId?: (id: string) => void
}

export type DSXUConversationControlResult = {
  conversationId: string
  cleared: readonly string[]
}

export async function clearDSXUConversation(input: DSXUConversationControlInput = {}): Promise<DSXUConversationControlResult> {
  const conversationId = regenerateSessionId()

  input.setMessages?.([])
  input.readFileState?.clear?.()
  input.discoveredSkillNames?.clear?.()
  input.loadedNestedMemoryPaths?.clear?.()
  input.setConversationId?.(conversationId)

  input.setAppState?.(prev => ({
    ...prev,
    readFileState: {
      ...prev.readFileState,
      files: new Set(),
    },
  }))

  clearSessionMessagesCache()
  clearSessionMetadata()
  await resetSessionFilePointer()

  return {
    conversationId,
    cleared: [
      'messages',
      'readFileState',
      'discoveredSkillNames',
      'loadedNestedMemoryPaths',
      'sessionMessagesCache',
      'sessionMetadata',
      'sessionFilePointer',
    ],
  }
}

export async function clearConversation(input: DSXUConversationControlInput = {}): Promise<DSXUConversationControlResult> {
  return clearDSXUConversation(input)
}
