import { isAutoMemoryEnabled } from '../../memdir/paths.js'
import { registerBundledSkill } from '../bundledSkills.js'

export type RememberSkillRuntimeProfile = {
  productName: string
  instructionFile: string
  localInstructionFile: string
  enabledByDefault: boolean
}

export function getRememberSkillRuntimeProfile(): RememberSkillRuntimeProfile {
  const isDsxu = process.env.DSXU_CODE_MODE === '1'
  return {
    productName: isDsxu ? 'DSXU Code' : 'DSXU Code',
    instructionFile: isDsxu ? 'DSXU.md' : 'DSXU.md',
    localInstructionFile: isDsxu ? 'DSXU.local.md' : 'DSXU.local.md',
    enabledByDefault:
      process.env.USER_TYPE === 'ant' ||
      process.env.DSXU_CODE_ENABLE_BUNDLED_SKILLS === '1',
  }
}

export function getDsxuRememberSkillRuntimeProfile(): RememberSkillRuntimeProfile & {
  runtime: 'DSXU Remember Skill'
  activationEvidence: readonly string[]
} {
  const profile = getRememberSkillRuntimeProfile()
  return {
    ...profile,
    runtime: 'DSXU Remember Skill',
    activationEvidence: [
      'uses DSXU.md and DSXU.local.md as primary instruction files in DSXU mode',
      'reviews auto-memory without applying changes before user approval',
      'classifies memory into project, local, team, or auto-memory destinations',
      'registerRememberSkill exposes the bundled skill only when DSXU bundled skills or ant mode enables it',
    ],
  }
}

export function buildRememberSkillPrompt(): string {
  const { productName, instructionFile, localInstructionFile } =
    getRememberSkillRuntimeProfile()

  return `# Memory Review

## Goal
Review the user's memory landscape and produce a clear report of proposed changes, grouped by action type. Do NOT apply changes - present proposals for user approval.

## Steps

### 1. Gather all memory layers
Read ${instructionFile} and ${localInstructionFile} from the project root (if they exist). Your auto-memory content is already in your system prompt - review it there. Note which team memory sections exist, if any.

**Success criteria**: You have the contents of all memory layers and can compare them.

### 2. Classify each auto-memory entry
For each substantive entry in auto-memory, determine the best destination:

| Destination | What belongs there | Examples |
|---|---|---|
| **${instructionFile}** | Project conventions and instructions for ${productName} that all contributors should follow | "use bun not npm", "API routes use kebab-case", "test command is bun test", "prefer functional style" |
| **${localInstructionFile}** | Personal instructions for ${productName} specific to this user, not applicable to other contributors | "I prefer concise responses", "always explain trade-offs", "don't auto-commit", "run tests before committing" |
| **Team memory** | Org-wide knowledge that applies across repositories (only if team memory is configured) | "deploy PRs go through #deploy-queue", "staging is at staging.internal", "platform team owns infra" |
| **Stay in auto-memory** | Working notes, temporary context, or entries that don't clearly fit elsewhere | Session-specific observations, uncertain patterns |

**Important distinctions:**
- ${instructionFile} and ${localInstructionFile} contain instructions for ${productName}, not user preferences for external tools.
- Workflow practices are ambiguous - ask the user whether they're personal or team-wide.
- When unsure, ask rather than guess.

**Success criteria**: Each entry has a proposed destination or is flagged as ambiguous.

### 3. Identify cleanup opportunities
Scan across all layers for:
- **Duplicates**: Auto-memory entries already captured in ${instructionFile} or ${localInstructionFile} - propose removing from auto-memory.
- **Outdated**: ${instructionFile} or ${localInstructionFile} entries contradicted by newer auto-memory entries - propose updating the older layer.
- **Conflicts**: Contradictions between any two layers - propose resolution, noting which is more recent.

**Success criteria**: All cross-layer issues identified.

### 4. Present the report
Output a structured report grouped by action type:
1. **Promotions** - entries to move, with destination and rationale.
2. **Cleanup** - duplicates, outdated entries, conflicts to resolve.
3. **Ambiguous** - entries where you need the user's input on destination.
4. **No action needed** - brief note on entries that should stay put.

If auto-memory is empty, say so and offer to review ${instructionFile} for cleanup.

**Success criteria**: User can review and approve/reject each proposal individually.

## Rules
- Present ALL proposals before making any changes.
- Do NOT modify files without explicit user approval.
- Do NOT create new files unless the target doesn't exist yet.
- Ask about ambiguous entries - don't guess.
`
}

export function registerRememberSkill(): void {
  const profile = getRememberSkillRuntimeProfile()
  if (!profile.enabledByDefault) {
    return
  }

  registerBundledSkill({
    name: 'remember',
    description: `Review auto-memory entries and propose promotions to ${profile.instructionFile}, ${profile.localInstructionFile}, or shared memory. Also detects outdated, conflicting, and duplicate entries across memory layers.`,
    whenToUse: `Use when the user wants to review, organize, or promote their auto-memory entries. Also useful for cleaning up outdated or conflicting entries across ${profile.instructionFile}, ${profile.localInstructionFile}, and auto-memory.`,
    userInvocable: true,
    isEnabled: () => isAutoMemoryEnabled(),
    async getPromptForCommand(args) {
      let prompt = buildRememberSkillPrompt()

      if (args) {
        prompt += `\n## Additional context from user\n\n${args}`
      }

      return [{ type: 'text', text: prompt }]
    },
  })
}
