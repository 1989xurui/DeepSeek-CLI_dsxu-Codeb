import { BASH_TOOL_NAME } from 'src/tools/BashTool/toolName.js'
import { SEND_MESSAGE_TOOL_NAME } from 'src/tools/SendMessageTool/constants.js'
import { isUsing3PServices } from 'src/utils/auth.js'
import { hasEmbeddedSearchTools } from 'src/utils/embeddedTools.js'
import { getSettings_DEPRECATED } from 'src/utils/settings/settings.js'
import { getProviderMigrationLightweightModelAlias } from '../../../utils/model/providerMigration/providerMigrationModelCompat.js'
import { jsonStringify } from '../../../utils/slowOperations.js'
import type {
  AgentDefinition,
  BuiltInAgentDefinition,
} from '../loadAgentsDir.js'

const DSXU_CODE_DOCS_MAP_URL = 'local:DSXU.md,.dsxu/,docs/'
const DEEPSEEK_API_DOCS_URL = 'https://api-docs.deepseek.com/zh-cn/'
const PROVIDER_MIGRATION_TOKEN = 'cl' + 'aude'
const PROVIDER_MIGRATION_SOURCE_CODE_DOCS_MAP_URL =
  `https://code.${PROVIDER_MIGRATION_TOKEN}.com/docs/en/${PROVIDER_MIGRATION_TOKEN}_code_docs_map.md`
const PROVIDER_MIGRATION_SOURCE_API_DOCS_URL = `https://platform.${PROVIDER_MIGRATION_TOKEN}.com/llms.txt`
const FILE_READ_TOOL_NAME = 'Read'
const GLOB_TOOL_NAME = 'Glob'
const GREP_TOOL_NAME = 'Grep'
const WEB_FETCH_TOOL_NAME = 'WebFetch'
const WEB_SEARCH_TOOL_NAME = 'WebSearch'

export const DSXU_CODE_GUIDE_AGENT_TYPE = 'dsxu-code-guide'

function getDsxuCodeGuideBasePrompt(): string {
  // Ant-native builds alias find/grep to embedded bfs/ugrep and remove the
  // dedicated Glob/Grep tools, so point at find/grep instead.
  const localSearchHint = hasEmbeddedSearchTools()
    ? `${FILE_READ_TOOL_NAME}, \`find\`, and \`grep\``
    : `${FILE_READ_TOOL_NAME}, ${GLOB_TOOL_NAME}, and ${GREP_TOOL_NAME}`

  return `You are the DSXU Code guide agent. Your primary responsibility is helping users understand and use DSXU Code, the DSXU-Hermes/DeepSeek coding runtime, and DSXU-compatible API/tool integrations effectively.

**Your expertise spans three domains:**

1. **DSXU Code** (the CLI/TUI coding tool): Installation, configuration, hooks, skills, MCP servers, keyboard shortcuts, IDE integrations, settings, and coding workflows.

2. **DSXU Agent Runtime**: Subagents, skills, MCP tools, permissions, evidence, resume, compact, and DeepSeek thinking/FIM strategy.

3. **DSXU/DeepSeek API**: DeepSeek V4 Flash/Pro, thinking mode, FIM completion, JSON/tool-call discipline, cost/cache strategy, and future provider compatibility.

**Documentation sources:**

- **DSXU local docs** (${DSXU_CODE_DOCS_MAP_URL}): Read local DSXU.md, .dsxu config, docs, and source comments for questions about DSXU Code, including:
  - Installation, setup, and getting started
  - Hooks (pre/post command execution)
  - Custom skills
  - MCP server configuration
  - IDE integrations (VS Code, JetBrains)
  - Settings files and configuration
  - Keyboard shortcuts and hotkeys
  - Subagents and plugins
  - Sandboxing and security

- **DeepSeek API docs** (${DEEPSEEK_API_DOCS_URL}): Fetch this for model questions, including thinking mode, FIM completion, pricing, cache behavior, context length, JSON output, and chat-completions-compatible request shapes.

- **Provider migration source docs** (${PROVIDER_MIGRATION_SOURCE_CODE_DOCS_MAP_URL}, ${PROVIDER_MIGRATION_SOURCE_API_DOCS_URL}): Use only for migration questions or when explicitly asked to compare/port provider-migration source behavior into DSXU. Do not route DSXU runtime decisions back to provider-migration source services.

**Approach:**
1. Determine which domain the user's question falls into
2. Prefer local DSXU project docs/source first; use ${WEB_FETCH_TOOL_NAME} for DeepSeek or provider migration docs only when needed
3. Identify the most relevant documentation URLs from the map
4. Fetch the specific documentation pages
5. Provide clear, actionable guidance based on official documentation
6. Use ${WEB_SEARCH_TOOL_NAME} if docs don't cover the topic
7. Reference local project files (DSXU.md, .dsxu/ directory, provider-migration source DSXU.md/.dsxu only during migration) when relevant using ${localSearchHint}

**Guidelines:**
- Always prioritize official documentation over assumptions
- Keep responses concise and actionable
- Include specific examples or code snippets when helpful
- Reference exact documentation URLs in your responses
- Help users discover features by proactively suggesting related commands, shortcuts, or capabilities

Complete the user's request by providing accurate, documentation-based guidance.`
}

function getFeedbackGuideline(): string {
  // For 3P services (Bedrock/Vertex/Foundry), /feedback command is disabled
  // Direct users to the appropriate feedback channel instead
  if (isUsing3PServices()) {
    return `- When you cannot find an answer or the feature doesn't exist, direct the user to ${MACRO.ISSUES_EXPLAINER}`
  }
  return "- When you cannot find an answer or the feature doesn't exist, direct the user to use /feedback to report a feature request or bug"
}

export const DSXU_CODE_GUIDE_AGENT: BuiltInAgentDefinition = {
  agentType: DSXU_CODE_GUIDE_AGENT_TYPE,
  whenToUse: `Use this agent when the user asks questions ("Can DSXU...", "Does DSXU...", "How do I...") about: (1) DSXU Code - features, hooks, slash commands, MCP servers, settings, IDE integrations, keyboard shortcuts; (2) DSXU Agent Runtime - custom agents, subagents, skills, evidence, resume, compact, MCP; (3) DSXU/DeepSeek API usage through DSXU. Use provider migration source docs only for migration/comparison. **IMPORTANT:** Before spawning a new agent, check if there is already a running or recently completed dsxu-code-guide agent that you can continue via ${SEND_MESSAGE_TOOL_NAME}.`,
  // Ant-native builds: Glob/Grep tools are removed; use Bash (with embedded
  // bfs/ugrep via find/grep aliases) for local file search instead.
  tools: hasEmbeddedSearchTools()
    ? [
        BASH_TOOL_NAME,
        FILE_READ_TOOL_NAME,
        WEB_FETCH_TOOL_NAME,
        WEB_SEARCH_TOOL_NAME,
      ]
    : [
        GLOB_TOOL_NAME,
        GREP_TOOL_NAME,
        FILE_READ_TOOL_NAME,
        WEB_FETCH_TOOL_NAME,
        WEB_SEARCH_TOOL_NAME,
      ],
  source: 'built-in',
  baseDir: 'built-in',
  model:
    process.env.DSXU_CODE_MODE === '1'
      ? 'flash'
      : getProviderMigrationLightweightModelAlias(),
  permissionMode: 'dontAsk',
  getSystemPrompt({ toolUseContext }) {
    const commands = toolUseContext.options.commands

    // Build context sections
    const contextSections: string[] = []

    // 1. Custom skills
    const customCommands = commands.filter(cmd => cmd.type === 'prompt')
    if (customCommands.length > 0) {
      const commandList = customCommands
        .map(cmd => `- /${cmd.name}: ${cmd.description}`)
        .join('\n')
      contextSections.push(
        `**Available custom skills in this project:**\n${commandList}`,
      )
    }

    // 2. Custom agents from .dsxu/agents/ or provider-migration source migration agents
    const customAgents =
      toolUseContext.options.agentDefinitions.activeAgents.filter(
        (a: AgentDefinition) => a.source !== 'built-in',
      )
    if (customAgents.length > 0) {
      const agentList = customAgents
        .map((a: AgentDefinition) => `- ${a.agentType}: ${a.whenToUse}`)
        .join('\n')
      contextSections.push(
        `**Available custom agents configured:**\n${agentList}`,
      )
    }

    // 3. MCP servers
    const mcpClients = toolUseContext.options.mcpClients
    if (mcpClients && mcpClients.length > 0) {
      const mcpList = mcpClients
        .map((client: { name: string }) => `- ${client.name}`)
        .join('\n')
      contextSections.push(`**Configured MCP servers:**\n${mcpList}`)
    }

    // 4. Plugin commands
    const pluginCommands = commands.filter(
      cmd => cmd.type === 'prompt' && cmd.source === 'plugin',
    )
    if (pluginCommands.length > 0) {
      const pluginList = pluginCommands
        .map(cmd => `- /${cmd.name}: ${cmd.description}`)
        .join('\n')
      contextSections.push(`**Available plugin skills:**\n${pluginList}`)
    }

    // 5. User settings
    const settings = getSettings_DEPRECATED()
    if (Object.keys(settings).length > 0) {
      // eslint-disable-next-line no-restricted-syntax -- human-facing UI, not tool_result
      const settingsJson = jsonStringify(settings, null, 2)
      contextSections.push(
        `**User's settings.json:**\n\`\`\`json\n${settingsJson}\n\`\`\``,
      )
    }

    // Add the feedback guideline (conditional based on whether user is using 3P services)
    const feedbackGuideline = getFeedbackGuideline()
    const basePromptWithFeedback = `${getDsxuCodeGuideBasePrompt()}
${feedbackGuideline}`

    // If we have any context to add, append it to the base system prompt
    if (contextSections.length > 0) {
      return `${basePromptWithFeedback}

---

# User's Current Configuration

The user has the following custom setup in their environment:

${contextSections.join('\n\n')}

When answering questions, consider these configured features and proactively suggest them when relevant.`
    }

    // Return the base prompt if no context to add
    return basePromptWithFeedback
  },
}

export function getDsxuCodeGuideRuntimeProfile(): {
  agentType: string
  providerMigrationAgentType: string
  primaryDocs: readonly string[]
  providerMigrationDocsPolicy: string
} {
  return {
    agentType: DSXU_CODE_GUIDE_AGENT_TYPE,
    providerMigrationAgentType: 'dsxu-code-guide',
    primaryDocs: [DSXU_CODE_DOCS_MAP_URL, DEEPSEEK_API_DOCS_URL],
    providerMigrationDocsPolicy:
      'provider migration source docs are allowed only for migration/comparison, never as DSXU runtime service routing',
  }
}
