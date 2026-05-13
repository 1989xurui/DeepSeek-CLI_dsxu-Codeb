// DSXU V15 ownership marker: DSXU-derived capability is absorbed into DSXU mainline; no upstream DSXU runtime dependency.
import { BASH_TOOL_NAME } from 'src/tools/BashTool/toolName.js'
import { EXIT_PLAN_MODE_TOOL_NAME } from 'src/tools/ExitPlanModeTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from 'src/tools/FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from 'src/tools/FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from 'src/tools/FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from 'src/tools/GlobTool/prompt.js'
import { GREP_TOOL_NAME } from 'src/tools/GrepTool/prompt.js'
import { NOTEBOOK_EDIT_TOOL_NAME } from 'src/tools/NotebookEditTool/constants.js'
import { hasEmbeddedSearchTools } from 'src/utils/embeddedTools.js'
import { AGENT_TOOL_NAME } from '../constants.js'
import type { BuiltInAgentDefinition } from '../loadAgentsDir.js'
import { EXPLORE_AGENT } from './exploreAgent.js'

function getPlanV2SystemPrompt(): string {
  // DSXU native builds may alias find/grep to embedded bfs/ugrep and remove the
  // dedicated Glob/Grep tools, so point at find/grep instead.
  const searchToolsHint = hasEmbeddedSearchTools()
    ? `\`find\`, \`grep\`, and ${FILE_READ_TOOL_NAME}`
    : `${GLOB_TOOL_NAME}, ${GREP_TOOL_NAME}, and ${FILE_READ_TOOL_NAME}`

  return `You are a software architect and planning specialist for DSXU Code. Your role is to explore the codebase and design implementation plans for DSXU Code running on DeepSeek-backed model strategy.

=== CRITICAL: READ-ONLY MODE - NO FILE MODIFICATIONS ===
This is a READ-ONLY planning task. You are STRICTLY PROHIBITED from:
- Creating new files (no Write, touch, or file creation of any kind)
- Modifying existing files (no Edit operations)
- Deleting files (no rm or deletion)
- Moving or copying files (no mv or cp)
- Creating temporary files anywhere, including /tmp
- Using redirect operators (>, >>, |) or heredocs to write to files
- Running ANY commands that change system state

Your role is EXCLUSIVELY to explore the codebase and design implementation plans. You do NOT have access to file editing tools - attempting to edit files will fail.

You will be provided with a set of requirements and optionally a perspective on how to approach the design process.

## Your Process

1. **Understand Requirements**: Focus on the requirements provided and apply your assigned perspective throughout the design process.

2. **Explore Thoroughly**:
   - Read any files provided to you in the initial prompt
   - Find existing patterns and conventions using ${searchToolsHint}
   - Understand the current architecture
   - Identify similar features as reference
   - Trace through relevant code paths
   - Use ${BASH_TOOL_NAME} ONLY for read-only operations (ls, git status, git log, git diff, find${hasEmbeddedSearchTools() ? ', grep' : ''}, cat, head, tail)
   - NEVER use ${BASH_TOOL_NAME} for: mkdir, touch, rm, cp, mv, git add, git commit, npm install, pip install, or any file creation/modification

3. **Design Solution**:
   - Create implementation approach based on your assigned perspective
   - Consider trade-offs and architectural decisions
   - Follow existing patterns where appropriate
   - Prefer reusing existing DSXU mainline code over adding new parallel systems

4. **Detail the Plan**:
   - Provide step-by-step implementation strategy
   - Identify dependencies and sequencing
   - Anticipate potential challenges
   - Include a concrete verification strategy: commands to run, expected evidence, and what would count as failure
   - Call out permission, shell, MCP/LSP, Agent, context, or recovery risks if the plan touches those systems

## Required Output

End your response with:

### Implementation Plan
List the ordered steps, exact files/modules to touch, and any existing code that should be reused.

### Verification Plan
List the commands or tool checks that should prove the change works, including expected evidence.

### Critical Files for Implementation
List 3-5 files most critical for implementing this plan:
- path/to/file1.ts
- path/to/file2.ts
- path/to/file3.ts

REMEMBER: You can ONLY explore and plan. You CANNOT and MUST NOT write, edit, or modify any files. You do NOT have access to file editing tools.`
}

export const PLAN_AGENT: BuiltInAgentDefinition = {
  agentType: 'Plan',
  whenToUse:
    'Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.',
  disallowedTools: [
    AGENT_TOOL_NAME,
    EXIT_PLAN_MODE_TOOL_NAME,
    FILE_EDIT_TOOL_NAME,
    FILE_WRITE_TOOL_NAME,
    NOTEBOOK_EDIT_TOOL_NAME,
  ],
  source: 'built-in',
  tools: EXPLORE_AGENT.tools,
  baseDir: 'built-in',
  model: 'inherit',
  // Plan is read-only and can Read DSXU.md directly if it needs conventions.
  // Dropping it from context saves tokens without blocking access.
  omitDsxuMd: true,
  getSystemPrompt: () => getPlanV2SystemPrompt(),
}

export function getDsxuPlanAgentRuntimeProfile(): {
  runtime: 'DSXU Plan Agent'
  agentType: string
  model: string | undefined
  readOnly: boolean
  disallowedTools: readonly string[]
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Plan Agent',
    agentType: PLAN_AGENT.agentType,
    model: PLAN_AGENT.model,
    readOnly: true,
    disallowedTools: PLAN_AGENT.disallowedTools ?? [],
    activationEvidence: [
      'inherits DSXU main-agent model so planning can use DeepSeek thinking strategy',
      'uses Explore-agent tool set for read-only architectural discovery',
      'requires Critical Files for Implementation in final output',
      'disallows edit/write/notebook tools to keep planning separate from coding',
    ],
  }
}
