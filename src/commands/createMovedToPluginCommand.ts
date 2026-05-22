import type { ContentBlockParam } from 'src/types/providerSdk.js'
import type { Command } from '../commands.js'
import type { ToolUseContext } from '../Tool.js'
import { isDsxuRuntimeMode } from '../utils/envUtils.js'

type Options = {
  name: string
  description: string
  progressMessage: string
  pluginName: string
  pluginCommand: string
  /**
   * The prompt to use while the marketplace is private.
   * External users will get this prompt. Once the marketplace is public,
   * this parameter and the fallback logic can be removed.
   */
  getPromptWhileMarketplaceIsPrivate: (
    args: string,
    context: ToolUseContext,
  ) => Promise<ContentBlockParam[]>
}

export function createMovedToPluginCommand({
  name,
  description,
  progressMessage,
  pluginName,
  pluginCommand,
  getPromptWhileMarketplaceIsPrivate,
}: Options): Command {
  return {
    type: 'prompt',
    name,
    description,
    progressMessage,
    contentLength: 0, // Dynamic content
    userFacingName() {
      return name
    },
    source: 'builtin',
    async getPromptForCommand(
      args: string,
      context: ToolUseContext,
    ): Promise<ContentBlockParam[]> {
      if (isDsxuRuntimeMode()) {
        return [
          {
            type: 'text',
            text: `This command has moved to the DSXU plugin system. Tell the user:

1. To install the plugin, run:
   dsxu plugin install ${pluginName}@dsxu-code-marketplace

2. After installation, use /${pluginName}:${pluginCommand} to run this command

3. If the DSXU plugin marketplace is not configured in this environment, use the built-in fallback flow only when it is explicitly available.

Do not attempt to run the command through the provider-migration source marketplace.`,
          },
        ]
      }

      if (process.env.USER_TYPE === 'ant') {
        return [
          {
            type: 'text',
            text: `This command has been moved to a plugin. Tell the user:

1. To install the plugin, run:
   ${'cl' + 'aude'} plugin install ${pluginName}@${'cl' + 'aude'}-code-marketplace

2. After installation, use /${pluginName}:${pluginCommand} to run this command

3. For more information, see the provider-migration source marketplace README for ${pluginName}.

Do not attempt to run the command. Simply inform the user about the plugin installation.`,
          },
        ]
      }

      return getPromptWhileMarketplaceIsPrivate(args, context)
    },
  }
}

export function getDsxuMovedToPluginCommandRuntimeProfile(): {
  runtime: 'DSXU Plugin Command Migration'
  dsxuInstallTemplate: string
  providerMigrationPolicy: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Plugin Command Migration',
    dsxuInstallTemplate:
      'dsxu plugin install <plugin>@dsxu-code-marketplace then /<plugin>:<command>',
    providerMigrationPolicy:
      'Provider-migration source marketplace prompt is kept only outside DSXU runtime for historical migration projection',
    activationEvidence: [
      'DSXU_CODE_MODE=1 forces DSXU plugin instructions',
      'provider-migration source plugin install is not emitted in DSXU runtime mode',
      'private-marketplace fallback remains available for non-DSXU builds',
    ],
  }
}
