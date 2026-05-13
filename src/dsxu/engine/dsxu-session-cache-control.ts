import {
  clearSessionMessagesCache,
  clearSessionMetadata,
  resetSessionFilePointer,
} from '../../utils/sessionStorage.js'

export type DSXUSessionCacheControlResult = {
  cleared: readonly string[]
}

export function clearDSXUSessionCaches(): DSXUSessionCacheControlResult {
  clearSessionMessagesCache()
  clearSessionMetadata()
  void resetSessionFilePointer()

  return {
    cleared: [
      'sessionMessagesCache',
      'sessionMetadata',
      'sessionFilePointer',
    ],
  }
}

export function clearSessionCaches(): DSXUSessionCacheControlResult {
  return clearDSXUSessionCaches()
}

export type V15SessionCacheControlResult = DSXUSessionCacheControlResult
