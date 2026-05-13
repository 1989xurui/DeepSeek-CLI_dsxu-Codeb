export const TEAM_LEAD_NAME = 'team-lead'
export const SWARM_SESSION_NAME = 'dsxu-swarm'
export const SWARM_VIEW_WINDOW_NAME = 'swarm-view'
export const TMUX_COMMAND = 'tmux'
export const HIDDEN_SESSION_NAME = 'dsxu-hidden'

/**
 * Gets the socket name for external swarm sessions (when user is not in tmux).
 * Uses a separate socket to isolate swarm operations from user's tmux sessions.
 * Includes PID to ensure multiple DSXU instances don't conflict.
 */
export function getSwarmSocketName(): string {
  return `dsxu-swarm-${process.pid}`
}

/**
 * Environment variable to override the command used to spawn teammate instances.
 * If not set, defaults to process.execPath (the current DSXU binary).
 * This allows customization for different environments or testing.
 */
export const TEAMMATE_COMMAND_ENV_VAR =
  process.env.DSXU_CODE_TEAMMATE_COMMAND !== undefined
    ? 'DSXU_CODE_TEAMMATE_COMMAND'
    : `CL${'AUDE'}_CODE_TEAMMATE_COMMAND`

/**
 * Environment variable set on spawned teammates to indicate their assigned color.
 * Used for colored output and pane identification.
 */
export const TEAMMATE_COLOR_ENV_VAR = 'DSXU_CODE_AGENT_COLOR'

/**
 * Environment variable set on spawned teammates to require plan mode before implementation.
 * When set to 'true', teammates must enter plan mode and get approval before writing code.
 */
export const PLAN_MODE_REQUIRED_ENV_VAR = 'DSXU_CODE_PLAN_MODE_REQUIRED'
