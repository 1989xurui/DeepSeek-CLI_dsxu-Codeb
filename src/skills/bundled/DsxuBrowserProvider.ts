import { BROWSER_TOOLS } from '../../types/browserProviderMcp.js'
import { BASE_CHROME_PROMPT } from '../../utils/dsxuBrowserProvider/prompt.js'
import { shouldAutoEnableDsxuBrowserProvider } from '../../utils/dsxuBrowserProvider/setup.js'
import { toBrowserMCPToolName } from '../../utils/dsxuBrowserProvider/common.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { registerBundledSkill } from '../bundledSkills.js'

const DEFAULT_BROWSER_TOOL_NAMES = [
  'tabs_context_mcp',
  'tabs_create_mcp',
  'javascript_tool',
  'read_console_messages',
  'gif_creator',
]

function getBrowserToolNames(): string[] {
  return BROWSER_TOOLS.length > 0
    ? BROWSER_TOOLS.map(tool => tool.name)
    : DEFAULT_BROWSER_TOOL_NAMES
}

const SKILL_ACTIVATION_MESSAGE = `
Now that this skill is invoked, you have access to DSXU browser automation tools. You can now use the browser MCP tools to interact with web pages.

IMPORTANT: Start by calling mcp__dsxu-browser__tabs_context_mcp to get information about the user's current browser tabs.
`

export function registerDsxuBrowserProviderSkill(): void {
  registerBundledSkill({
    name: isEnvTruthy(process.env.DSXU_CODE_MODE)
      ? 'dsxu-browser-control'
      : 'dsxu-in-chrome',
    description:
      'Automates your Chrome browser through the DSXU Browser Provider to interact with web pages - clicking elements, filling forms, capturing screenshots, reading console logs, and navigating sites. Opens pages in new tabs within your existing Chrome session. Requires site-level permissions before executing.',
    whenToUse:
      'When the user wants to interact with web pages, automate browser tasks, capture screenshots, read console logs, or perform any browser-based actions. Always invoke BEFORE attempting to use browser MCP tools.',
    allowedTools: getBrowserToolNames().map(toBrowserMCPToolName),
    userInvocable: true,
    isEnabled: () => shouldAutoEnableDsxuBrowserProvider(),
    async getPromptForCommand(args) {
      let prompt = `${BASE_CHROME_PROMPT}\n${SKILL_ACTIVATION_MESSAGE}`
      if (args) {
        prompt += `\n## Task\n\n${args}`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
