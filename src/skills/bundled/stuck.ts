// DSXU V15 ownership marker: upstream-derived capability is absorbed into DSXU mainline; no upstream vendor runtime dependency.
import { registerBundledSkill } from '../bundledSkills.js'

export type StuckSkillRuntimeProfile = {
  productName: string
  debugDir: string
  feedbackTarget: string
  processRegex: string
  enabledByDefault: boolean
}

export function getStuckSkillRuntimeProfile(): StuckSkillRuntimeProfile {
  const isDsxu = process.env.DSXU_CODE_MODE === '1'
  return {
    productName: isDsxu ? 'DSXU Code' : 'DSXU Code',
    debugDir: isDsxu
      ? '~/.dsxu/debug/<session-id>.txt'
      : '~/.dsxu/debug/<session-id>.txt',
    feedbackTarget: isDsxu
      ? 'the DSXU issue/evidence ledger'
      : '#dsxu-code-feedback',
    processRegex: isDsxu ? '(dsxu|dsxu-code|cli)' : '(dsxu|cli)',
    enabledByDefault:
      process.env.USER_TYPE === 'ant' ||
      process.env.DSXU_CODE_ENABLE_BUNDLED_SKILLS === '1',
  }
}

export function getDsxuStuckSkillActivationProfile(): {
  skill: 'stuck'
  activation: readonly string[]
  diagnosticScope: readonly string[]
  safetyPolicy: readonly string[]
} {
  const profile = getStuckSkillRuntimeProfile()
  return {
    skill: 'stuck',
    activation: [
      `product=${profile.productName}`,
      `enabledByDefault=${profile.enabledByDefault}`,
      `feedbackTarget=${profile.feedbackTarget}`,
    ],
    diagnosticScope: [
      'process list',
      'CPU/RSS/state sampling',
      'child-process inspection',
      'debug log tail',
    ],
    safetyPolicy: [
      'diagnostic-only skill',
      'does not kill or signal processes',
      'external report only when a stuck session is actually found',
    ],
  }
}

// Prompt text contains `ps` commands as instructions for the assistant to run,
// not commands this file executes.
// eslint-disable-next-line custom-rules/no-direct-ps-commands
export function getStuckPrompt(): string {
  const { productName, debugDir, feedbackTarget, processRegex } =
    getStuckSkillRuntimeProfile()
  return `# /stuck - diagnose frozen/slow ${productName} sessions

The user thinks another ${productName} session on this machine is frozen, stuck, or very slow. Investigate and produce a report for ${feedbackTarget}.

## What to look for

Scan for other ${productName} processes (excluding the current one - PID is in \`process.pid\` but for shell commands just exclude the PID you see running this prompt). Process names are typically \`dsxu\`, \`dsxu-code\`, or \`cli\` in DSXU mode.

Signs of a stuck session:
- **High CPU sustained** - likely an infinite loop. Sample twice, 1-2s apart, to confirm it's not a transient spike.
- **Process state \`D\` (uninterruptible sleep)** - often an I/O hang. The \`state\` column in \`ps\` output; first character matters.
- **Process state \`T\` (stopped)** - user probably hit Ctrl+Z by accident.
- **Process state \`Z\` (zombie)** - parent is not reaping.
- **Very high RSS** - possible memory leak making the session sluggish.
- **Stuck child process** - a hung \`git\`, \`node\`, or shell subprocess can freeze the parent. Check \`pgrep -lP <pid>\` for each session.

## Investigation steps

1. **List all ${productName} processes** (macOS/Linux):
   \`\`\`
   ps -axo pid=,pcpu=,rss=,etime=,state=,comm=,command= | grep -E '${processRegex}' | grep -v grep
   \`\`\`
   Filter to rows where \`comm\` is \`dsxu\`, \`dsxu-code\`, \`dsxu\`, or (\`cli\` AND the command path contains the current product executable).

2. **For anything suspicious**, gather more context:
   - Child processes: \`pgrep -lP <pid>\`
   - If high CPU: sample again after 1-2s to confirm it's sustained
   - If a child looks hung, note its full command line with \`ps -p <child_pid> -o command=\`
   - Check the session's debug log if you can infer the session ID: \`${debugDir}\`

3. **Consider a stack dump** for a truly frozen process (advanced, optional):
   - macOS: \`sample <pid> 3\` gives a 3-second native stack sample
   - This is big - only grab it if the process is clearly hung and you want to know why

## Report

**Only create an external report if you actually found something stuck.** If every session looks healthy, tell the user that directly - do not post an all-clear.

If you did find a stuck/slow session, write the diagnosis to the DSXU evidence ledger or a user-approved issue channel. Use ToolSearch to find the relevant connector if it is not already loaded.

**Use a two-message structure** to keep the channel scannable:

1. **Top-level message** - one short line: hostname, ${productName} version, and a terse symptom.
2. **Thread reply** - the full diagnostic dump. Include PID, CPU%, RSS, state, uptime, command line, child processes, diagnosis, and relevant debug log tail or sample output.

If no connector is available, format the report as a message the user can copy-paste into their tracking system.

## Notes
- Do not kill or signal any processes - this is diagnostic only.
- If the user gave an argument, focus there first.
`
}

export function registerStuckSkill(): void {
  const profile = getStuckSkillRuntimeProfile()
  if (!profile.enabledByDefault) {
    return
  }

  registerBundledSkill({
    name: 'stuck',
    description:
      'Investigate frozen/stuck/slow DSXU Code sessions on this machine and produce a diagnostic report.',
    userInvocable: true,
    async getPromptForCommand(args) {
      let prompt = getStuckPrompt()
      if (args) {
        prompt += `\n## User-provided context\n\n${args}\n`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
