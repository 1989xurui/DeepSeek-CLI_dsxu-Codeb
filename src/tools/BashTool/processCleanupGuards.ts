export type SelfKillingProcessCleanupFinding = {
  form: 'pkill-full' | 'pgrep-full-kill'
  pattern: string
  message: string
}

function extractFirstPatternAfterFullFlag(command: string, tool: 'pkill' | 'pgrep'): string | null {
  const match = command.match(
    new RegExp(
      `\\b${tool}\\s+(?:(?:-[A-Za-z]*f[A-Za-z]*|--full)\\s+)(?:"([^"]+)"|'([^']+)'|([^\\s;&|)]+))`,
      'i',
    ),
  )
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

function regexMatchesCommandLine(pattern: string, command: string): boolean {
  try {
    return new RegExp(pattern).test(command)
  } catch {
    return command.includes(pattern)
  }
}

function commandUsesPgrepResultForKill(command: string): boolean {
  return (
    /\bkill\s+\$\([^)]*\bpgrep\s+(?:-[A-Za-z]*f[A-Za-z]*|--full)\b/i.test(command) ||
    /\bpgrep\s+(?:-[A-Za-z]*f[A-Za-z]*|--full)\b[^|;&]*\|\s*xargs\b[^|;&]*\bkill\b/i.test(command)
  )
}

export function detectSelfKillingProcessCleanup(
  command: string,
): SelfKillingProcessCleanupFinding | null {
  const pkillPattern = extractFirstPatternAfterFullFlag(command, 'pkill')
  if (pkillPattern && regexMatchesCommandLine(pkillPattern, command)) {
    return {
      form: 'pkill-full',
      pattern: pkillPattern,
      message:
        `Blocked: pkill -f pattern "${pkillPattern}" can match the current DSXU shell command line and terminate the tool itself, causing a false Waiting/exit 143/144 state.`,
    }
  }

  const pgrepPattern = extractFirstPatternAfterFullFlag(command, 'pgrep')
  if (
    pgrepPattern &&
    commandUsesPgrepResultForKill(command) &&
    regexMatchesCommandLine(pgrepPattern, command)
  ) {
    return {
      form: 'pgrep-full-kill',
      pattern: pgrepPattern,
      message:
        `Blocked: kill from pgrep -f pattern "${pgrepPattern}" can include the current DSXU shell command line and terminate the tool itself, causing a false Waiting/exit 143/144 state.`,
    }
  }

  return null
}

export function renderSelfKillingProcessCleanupMessage(
  finding: SelfKillingProcessCleanupFinding,
): string {
  return [
    finding.message,
    'Use a scoped cleanup instead: target the known port (for example `fuser -k 5173/tcp` on WSL/Linux), or split cleanup and server start into separate Bash calls.',
    'For dev servers, start with `run_in_background: true`, then inspect the task output path or poll the HTTP endpoint until it is ready.',
  ].join(' ')
}
