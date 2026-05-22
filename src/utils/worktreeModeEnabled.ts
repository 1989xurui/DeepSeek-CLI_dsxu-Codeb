/**
 * Worktree mode is now unconditionally enabled for all users.
 *
 * Previously gated by feature flag provider flag 'tengu_worktree_mode', but the
 * CACHED_MAY_BE_STALE pattern returns the default (false) on first launch
 * before the cache is populated, silently swallowing --worktree.
 * Worktree mode runtime gate.
 */
export function isWorktreeModeEnabled(): boolean {
  return true
}
