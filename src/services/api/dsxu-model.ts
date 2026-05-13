import {
  getMaxOutputTokensForModel as getLegacyMaxOutputTokensForModel,
  queryModelWithStreaming as queryLegacyModelWithStreaming,
} from './dsxuTransport.js'

export function getMaxOutputTokensForModel(model: string): number {
  return getLegacyMaxOutputTokensForModel(model)
}

export const queryModelWithStreaming = queryLegacyModelWithStreaming

export class DSXUUserAbortError extends Error {
  constructor(message = 'User aborted DSXU model request') {
    super(message)
    this.name = 'DSXUUserAbortError'
  }
}
