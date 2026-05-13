import type { ContentBlockParam } from 'src/types/providerSdk.js';
import type { Command } from '../commands.js';
import { AGENT_TOOL_NAME } from '../tools/AgentTool/constants.js';
const statusline = {
  type: 'prompt',
  description: "Set up DSXU Code's status line UI",
  contentLength: 0,
  // Dynamic content
  aliases: [],
  name: 'statusline',
  progressMessage: 'setting up statusLine',
  allowedTools: [AGENT_TOOL_NAME, 'Read(~/**)', 'Edit(~/.dsxu/settings.json)'],
  source: 'builtin',
  disableNonInteractive: true,
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const prompt = args.trim() || 'Configure my statusLine from my shell PS1 configuration';
    return [{
      type: 'text',
      text: `Create an ${AGENT_TOOL_NAME} with subagent_type "statusline-setup" and the prompt "${prompt}"`
    }];
  }
} satisfies Command;
export default statusline;

// V14 strict lifecycle shim: commands-statusline
export function processCommandsStatuslineStrictLifecycle(input) {
  void input
  const state = 'commands-statusline-state'
  const lifecycle = 'commands-statusline:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runCommandsStatuslineStrict(input) {
  return processCommandsStatuslineStrictLifecycle(input)
}
