import { feature } from 'bun:bundle'
import { getFeatureValue_CACHED_WITH_REFRESH } from '../../services/analytics/growthbook.js'
import { DEFAULT_CRON_JITTER_CONFIG } from '../../utils/cronTasks.js'
import { isDsxuRuntimeMode, isDsxuCodeEnvTruthy } from '../../utils/envUtils.js'

const KAIROS_CRON_REFRESH_MS = 5 * 60 * 1000

export const DEFAULT_MAX_AGE_DAYS =
  DEFAULT_CRON_JITTER_CONFIG.recurringMaxAgeMs / (24 * 60 * 60 * 1000)

/**
 * Unified gate for the cron scheduling system. Combines the build-time
 * `feature('AGENT_TRIGGERS')` flag (dead code elimination) with the runtime
 * `tengu_kairos_cron` GrowthBook gate on a 5-minute refresh window.
 *
 * AGENT_TRIGGERS is independently shippable from KAIROS — the cron module
 * graph (cronScheduler/cronTasks/cronTasksLock/cron.ts + the three tools +
 * /loop skill) has zero imports into src/assistant/ and no feature('KAIROS')
 * calls. The REPL.tsx kairosEnabled read is safe:
 * kairosEnabled is unconditionally in AppStateStore with default false, so
 * when KAIROS is off the scheduler just gets assistantMode: false.
 *
 * Called from Tool.isEnabled() (lazy, post-init) and inside useEffect /
 * imperative setup, never at module scope — so the disk cache has had a
 * chance to populate.
 *
 * The default is `true` — /loop is GA (announced in changelog). GrowthBook
 * is disabled for Bedrock/Vertex/Foundry and when DISABLE_TELEMETRY /
 * DSXU_CODE_DISABLE_NONESSENTIAL_TRAFFIC are set; a `false` default would
 * break /loop for those users (GH #31759). The GB gate now serves purely as
 * a fleet-wide kill switch — flipping it to `false` stops already-running
 * schedulers on their next isKilled poll tick, not just new ones.
 *
 * `DSXU_CODE_DISABLE_CRON` is a local override that wins over GB.
  */
export function isKairosCronEnabled(): boolean {
  const cronDisabled =
    isDsxuCodeEnvTruthy('DISABLE_CRON')
  if (isDsxuRuntimeMode()) {
    return !cronDisabled
  }
  return feature('AGENT_TRIGGERS')
    ? !cronDisabled &&
        getFeatureValue_CACHED_WITH_REFRESH(
          'tengu_kairos_cron',
          true,
          KAIROS_CRON_REFRESH_MS,
        )
    : false
}

/**
 * Kill switch for disk-persistent (durable) cron tasks. Narrower than
 * {@link isKairosCronEnabled} — flipping this off forces `durable: false` at
 * the call() site, leaving session-only cron (in-memory, GA) untouched.
 *
 * Defaults to `true` so Bedrock/Vertex/Foundry and DISABLE_TELEMETRY users get
 * durable cron. Does NOT consult DSXU_CODE_DISABLE_CRON (that kills the whole
 * scheduler via isKairosCronEnabled).
 */
export function isDurableCronEnabled(): boolean {
  return getFeatureValue_CACHED_WITH_REFRESH(
    'tengu_kairos_cron_durable',
    true,
    KAIROS_CRON_REFRESH_MS,
  )
}

export const CRON_CREATE_TOOL_NAME = 'CronCreate'
export const CRON_DELETE_TOOL_NAME = 'CronDelete'
export const CRON_LIST_TOOL_NAME = 'CronList'

const DSXU_CRON_CREATE_DISCIPLINE = `

## DSXU weak-model discipline

- When to use: schedule one-shot or recurring prompts only when the user asks for future/reminder/loop behavior.
- When not to use: do not use cron for immediate work, hidden background execution, remote provider triggers, or persistent jobs without explicit user intent.
- Recovery after failure: if the cron expression is ambiguous, ask one concrete time/schedule question; if persistence is unavailable, fall back to session-only with clear wording.
- Weak-model anti-pattern: do not create durable jobs by default, do not round approximate times to fleet-hot minutes, and do not schedule actions that would bypass permissions.
- Verification / evidence: cite the cron expression, recurring/durable flags, local timezone assumption, job id, and expiration behavior.`

const DSXU_CRON_DELETE_DISCIPLINE = `

DSXU weak-model discipline:
- When to use: delete a known scheduled job when the user asks to cancel it or the job is obsolete.
- When not to use: do not delete unknown jobs or jobs owned by a different explicit user request without confirmation.
- Recovery after failure: list jobs and confirm the id before retrying.
- Weak-model anti-pattern: do not treat deletion as task completion.
- Verification / evidence: cite the job id and deletion result.`

const DSXU_CRON_LIST_DISCIPLINE = `

DSXU weak-model discipline:
- When to use: list scheduled jobs before update/delete or to answer the user's schedule question.
- When not to use: do not use this as proof that a scheduled task ran.
- Recovery after failure: report missing durable/session stores separately.
- Weak-model anti-pattern: do not infer job execution from list membership.
- Verification / evidence: cite job ids, schedules, durable/session-only state, and expiration.`

export function getRuntimeProductName(): string {
  return isDsxuRuntimeMode() ? 'DSXU Code' : 'DSXU'
}

export function getScheduledTasksPath(): string {
  return isDsxuRuntimeMode()
    ? '.dsxu/scheduled_tasks.json'
    : '.dsxu/scheduled_tasks.json'
}

export function buildCronCreateDescription(durableEnabled: boolean): string {
  return durableEnabled
    ? `Schedule a prompt to run at a future time — either recurring on a cron schedule, or once at a specific time. Pass durable: true to persist to ${getScheduledTasksPath()}; otherwise session-only.`
    : `Schedule a prompt to run at a future time within this ${getRuntimeProductName()} session — either recurring on a cron schedule, or once at a specific time.`
}

export function buildCronCreatePrompt(durableEnabled: boolean): string {
  const durabilitySection = durableEnabled
    ? `## Durability

By default (durable: false) the job lives only in this ${getRuntimeProductName()} session — nothing is written to disk, and the job is gone when ${getRuntimeProductName()} exits. Pass durable: true to write to ${getScheduledTasksPath()} so the job survives restarts. Only use durable: true when the user explicitly asks for the task to persist ("keep doing this every day", "set this up permanently"). Most "remind me in 5 minutes" / "check back in an hour" requests should stay session-only.`
    : `## Session-only

Jobs live only in this ${getRuntimeProductName()} session — nothing is written to disk, and the job is gone when ${getRuntimeProductName()} exits.`

  const durableRuntimeNote = durableEnabled
    ? `Durable jobs persist to ${getScheduledTasksPath()} and survive session restarts — on next launch they resume automatically. One-shot durable tasks that were missed while the REPL was closed are surfaced for catch-up. Session-only jobs die with the process. `
    : ''

  return `Schedule a prompt to be enqueued at a future time. Use for both recurring schedules and one-shot reminders.

Uses standard 5-field cron in the user's local timezone: minute hour day-of-month month day-of-week. "0 9 * * *" means 9am local — no timezone conversion needed.

## One-shot tasks (recurring: false)

For "remind me at X" or "at <time>, do Y" requests — fire once then auto-delete.
Pin minute/hour/day-of-month/month to specific values:
  "remind me at 2:30pm today to check the deploy" → cron: "30 14 <today_dom> <today_month> *", recurring: false
  "tomorrow morning, run the smoke test" → cron: "57 8 <tomorrow_dom> <tomorrow_month> *", recurring: false

## Recurring jobs (recurring: true, the default)

For "every N minutes" / "every hour" / "weekdays at 9am" requests:
  "*/5 * * * *" (every 5 min), "0 * * * *" (hourly), "0 9 * * 1-5" (weekdays at 9am local)

## Avoid the :00 and :30 minute marks when the task allows it

Every user who asks for "9am" gets \`0 9\`, and every user who asks for "hourly" gets \`0 *\` — which means requests from across the planet land on the API at the same instant. When the user's request is approximate, pick a minute that is NOT 0 or 30:
  "every morning around 9" → "57 8 * * *" or "3 9 * * *" (not "0 9 * * *")
  "hourly" → "7 * * * *" (not "0 * * * *")
  "in an hour or so, remind me to..." → pick whatever minute you land on, don't round

Only use minute 0 or 30 when the user names that exact time and clearly means it ("at 9:00 sharp", "at half past", coordinating with a meeting). When in doubt, nudge a few minutes early or late — the user will not notice, and the fleet will.

${durabilitySection}

## Runtime behavior

Jobs only fire while the REPL is idle (not mid-query). ${durableRuntimeNote}The scheduler adds a small deterministic jitter on top of whatever you pick: recurring tasks fire up to 10% of their period late (max 15 min); one-shot tasks landing on :00 or :30 fire up to 90 s early. Picking an off-minute is still the bigger lever.

Recurring tasks auto-expire after ${DEFAULT_MAX_AGE_DAYS} days — they fire one final time, then are deleted. This bounds session lifetime. Tell the user about the ${DEFAULT_MAX_AGE_DAYS}-day limit when scheduling recurring jobs.

Returns a job ID you can pass to ${CRON_DELETE_TOOL_NAME}.${DSXU_CRON_CREATE_DISCIPLINE}`
}

export const CRON_DELETE_DESCRIPTION = 'Cancel a scheduled cron job by ID'
export function buildCronDeletePrompt(durableEnabled: boolean): string {
  return durableEnabled
    ? `Cancel a cron job previously scheduled with ${CRON_CREATE_TOOL_NAME}. Removes it from ${getScheduledTasksPath()} (durable jobs) or the in-memory session store (session-only jobs).${DSXU_CRON_DELETE_DISCIPLINE}`
    : `Cancel a cron job previously scheduled with ${CRON_CREATE_TOOL_NAME}. Removes it from the in-memory session store.${DSXU_CRON_DELETE_DISCIPLINE}`
}

export const CRON_LIST_DESCRIPTION = 'List scheduled cron jobs'
export function buildCronListPrompt(durableEnabled: boolean): string {
  return durableEnabled
    ? `List all cron jobs scheduled via ${CRON_CREATE_TOOL_NAME}, both durable (${getScheduledTasksPath()}) and session-only.${DSXU_CRON_LIST_DISCIPLINE}`
    : `List all cron jobs scheduled via ${CRON_CREATE_TOOL_NAME} in this session.${DSXU_CRON_LIST_DISCIPLINE}`
}

export function getDsxuCronPromptRuntimeProfile(): {
  runtime: 'DSXU Cron Prompt'
  toolNames: readonly string[]
  durablePath: string
  disableEnv: readonly string[]
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Cron Prompt',
    toolNames: [
      CRON_CREATE_TOOL_NAME,
      CRON_DELETE_TOOL_NAME,
      CRON_LIST_TOOL_NAME,
    ],
    durablePath: getScheduledTasksPath(),
    disableEnv: ['DSXU_CODE_DISABLE_CRON', 'DSXU_CODE_DISABLE_CRON legacy'],
    activationEvidence: [
      'isKairosCronEnabled checks DSXU disable env before legacy alias',
      'durable cron writes to .dsxu/scheduled_tasks.json in DSXU mode',
      'prompt differentiates session-only and durable task persistence',
      'recurring jobs include jitter and max-age guidance for long-running stability',
    ],
  }
}
