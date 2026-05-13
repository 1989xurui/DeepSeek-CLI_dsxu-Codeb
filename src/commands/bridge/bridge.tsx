import type { ToolUseContext } from '../../Tool.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { handleDsxuProviderAliasCommand } from '../../dsxu/engine/provider-alias.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
): Promise<null> {
  const result = await handleDsxuProviderAliasCommand('remote-control', {
    cwd: context.cwd,
    sessionId: args.trim() || undefined,
  })

  onDone(result?.message ?? 'Remote provider alias is blocked on the DSXU local mainline.', {
    display: 'system',
  })
  return null
}
