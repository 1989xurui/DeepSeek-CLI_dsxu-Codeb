import {
  getMaxOutputTokensForModel as getTransportMaxOutputTokensForModel,
  queryModelWithStreaming as queryDsxuTransportModelWithStreaming,
} from './dsxuTransport.js'

export function getMaxOutputTokensForModel(model: string): number {
  return getTransportMaxOutputTokensForModel(model)
}

export const queryModelWithStreaming = queryDsxuTransportModelWithStreaming

export class DSXUUserAbortError extends Error {
  constructor(message = 'User aborted DSXU model request') {
    super(message)
    this.name = 'DSXUUserAbortError'
  }
}
