import type { LocalCommandResult } from '../../types/command.js'

export async function call(): Promise<LocalCommandResult> {
  return {
    type: 'text',
    value: 'The archived merchandise command is disabled in DSXU Code.',
  }
}
