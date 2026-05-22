/**
 * Undercover mode — safety utilities for contributing to public/open-source repos.
 *
 * When active, DSXU Code adds safety instructions to commit/PR prompts and
 * strips all attribution to avoid leaking internal model codenames, project
 * names, or other provider-internal information. The model is not told what
 * model it is.
 *
 * Activation:
 *   - DSXU_CODE_UNDERCOVER=1 — force ON (archived alias honored)
 *   - Otherwise AUTO: active UNLESS the repo remote matches the internal
 *     allowlist (INTERNAL_MODEL_REPOS in commitAttribution.ts). Safe default
 *     is ON — DSXU may push to public remotes from a CWD that isn't itself
 *     a git checkout (e.g. /tmp crash repro).
 *   - There is NO force-OFF. This guards against model codename leaks — if
 *     we're not confident we're in an internal repo, we stay undercover.
 *
 * All code paths are gated on process.env.USER_TYPE === 'ant'. Since USER_TYPE is
 * a build-time --define, the bundler constant-folds these checks and dead-code-
 * eliminates the dsxu internal branches from external builds. In external builds every
 * function in this file reduces to a trivial return.
 */

import { getRepoClassCached } from './commitAttribution.js'
import { getGlobalConfig } from './config.js'
import { isDsxuCodeEnvTruthy } from './envUtils.js'

export function isUndercover(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    if (isDsxuCodeEnvTruthy('UNDERCOVER')) return true
    // Auto: active unless we've positively confirmed we're in an allowlisted
    // internal repo. 'external', 'none', and null (check not yet run) all
    // resolve to ON. The check is primed in setup.ts; only 'internal' → OFF.
    return getRepoClassCached() !== 'internal'
  }
  return false
}

export function getUndercoverInstructions(): string {
  if (process.env.USER_TYPE === 'ant') {
    return `## UNDERCOVER MODE — CRITICAL

You are operating UNDERCOVER in a PUBLIC/OPEN-SOURCE repository. Your commit
messages, PR titles, and PR bodies MUST NOT contain ANY provider-internal
information. Do not blow your cover.

NEVER include in commit messages or PR descriptions:
- Internal model codenames
- Unreleased model version numbers or internal route codenames
- Internal repo or project names
- Internal tooling, Slack channels, or short links
- The phrase "DSXU Code" or any mention that you are an AI
- Any hint of what model or version you are
- Co-Authored-By lines or any other attribution

Write commit messages as a human developer would — describe only what the code
change does.

GOOD:
- "Fix race condition in file watcher initialization"
- "Add support for custom key bindings"
- "Refactor parser for better error messages"

BAD (never write these):
- "Fix bug found while testing with an unreleased model codename"
- "1-shotted by an internal model id"
- "Generated with DSXU Code"
- "Co-Authored-By: internal model <...>"
`
  }
  return ''
}

/**
 * Check whether to show the one-time explainer dialog for auto-undercover.
 * True when: undercover is active via auto-detection (not forced via env),
 * and the user hasn't seen the notice before. Pure — the component marks the
 * flag on mount.
 */
export function shouldShowUndercoverAutoNotice(): boolean {
  if (process.env.USER_TYPE === 'ant') {
    // If forced via env, user already knows; don't nag.
    if (isDsxuCodeEnvTruthy('UNDERCOVER')) return false
    if (!isUndercover()) return false
    if (getGlobalConfig().hasSeenUndercoverAutoNotice) return false
    return true
  }
  return false
}
