import type { LocalCommandResult } from '../../types/command.js'

export async function call(): Promise<LocalCommandResult> {
  return {
    type: 'text',
    value: 'The provider-migration merchandise command is disabled in DSXU Code.',
  }
}
