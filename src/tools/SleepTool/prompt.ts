import { TICK_TAG } from '../../constants/xml.js'

export const SLEEP_TOOL_NAME = 'Sleep'

export const DESCRIPTION = 'Wait for a specified duration'

export const DSXU_SLEEP_TOOL_DISCIPLINE = `

DSXU weak-model discipline:
- When to use: sleep only when the user asks you to wait, a scheduled tick instructs you to pause, or there is genuinely no useful safe work.
- When not to use: do not use Sleep to avoid a decision, hide a failure, wait for commands that should be checked with process/status tools, or replace explicit user input.
- Recovery after failure: if wake-up reveals a blocker, report it or replan instead of sleeping repeatedly.
- Weak-model anti-pattern: do not create sleep loops, do not hold shell processes with Bash sleep, and do not sleep while a verification command should be run.
- Verification / evidence: after waking, cite the tick/wait reason and any checked state before claiming progress.`

export const SLEEP_TOOL_PROMPT = `Wait for a specified duration. The user can interrupt the sleep at any time.

Use this when the user tells you to sleep or rest, when you have nothing to do, or when you're waiting for something.

You may receive <${TICK_TAG}> prompts — these are periodic check-ins. Look for useful work to do before sleeping.

You can call this concurrently with other tools — it won't interfere with them.

Prefer this over \`Bash(sleep ...)\` — it doesn't hold a shell process.

Each wake-up costs an API call, but the prompt cache expires after 5 minutes of inactivity — balance accordingly.`
