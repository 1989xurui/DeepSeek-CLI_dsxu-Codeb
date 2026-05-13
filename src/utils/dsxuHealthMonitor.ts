export type DsxuHealthSeverity = 'info' | 'warning' | 'critical'

export type DsxuMojibakeIssue = {
  path: string
  line: number
  excerpt: string
  score: number
}

export type DsxuMojibakeSurface = 'comment' | 'string_or_template' | 'unknown'

export type DsxuClassifiedMojibakeIssue = DsxuMojibakeIssue & {
  surface: DsxuMojibakeSurface
  activePath: boolean
  userVisibleRisk: boolean
}

export type DsxuTuiHealthIssueKind =
  | 'permission_prompt_hidden'
  | 'loading_without_visible_progress'
  | 'auto_continue_waiting_behind_queue'
  | 'auto_continue_duplicate_source'

export type DsxuTuiHealthIssue = {
  kind: DsxuTuiHealthIssueKind
  severity: DsxuHealthSeverity
  message: string
}

export type DsxuTuiBackgroundTaskSummary = {
  id: string
  type: string
  status: string
  description?: string
  outputFile?: string
  toolUseId?: string
}

export type DsxuTuiHealthSnapshotInput = {
  isLoading: boolean
  showSpinner: boolean
  focusedInputDialog?: string
  toolUseConfirmQueueLength: number
  permissionFallbackVisible: boolean
  streamingTextLength: number
  inProgressToolUseCount: number
  backgroundTaskCount?: number
  backgroundTasks?: DsxuTuiBackgroundTaskSummary[]
  commandQueueLength: number
  mainPromptCommandQueued: boolean
  autoContinueSourceUuid?: string | null
  lastAutoContinueSourceUuid?: string | null
  suppressingDialogs: boolean
}

export type DsxuTuiVisibleState =
  | 'idle'
  | 'model_thinking'
  | 'permission_waiting'
  | 'tool_running'
  | 'background_task_running'
  | 'stuck_no_event'

export type DsxuTuiHealthSnapshot = {
  status: 'idle' | 'busy' | 'waiting' | 'stalled'
  visibleState: DsxuTuiVisibleState
  issues: DsxuTuiHealthIssue[]
  backgroundTaskCount: number
  backgroundTasks: DsxuTuiBackgroundTaskSummary[]
  summary: string
}

const MOJIBAKE_MARKERS = [
  '\u93cc\u30e9\u7359\u7487\u4f79\u69f8\u935a\ufe42\u20ac\u6c33\u7e43',
  '\u951f\u65a4\u62f7',
  '\u95bf\u71b8\u67bb\u93b7',
  '\u9225?',
  '\u59ab\u20ac',
  '\u7487',
  '\u95bf',
  '\u9435',
  '\u95c1',
  '\u6d93',
  '\u6fee',
  '\u7f01',
  '\u59d8',
  '\u945e',
  '\u00e2\u20ac',
  '\u00e2\u20ac\u201d',
  '\u00e2\u20ac\u2122',
  '\u00e2\u0153',
  '\u00e6\u00b5',
  '\u00e8\u00af',
  '\u00e8\u00ae',
  '\u00e5\u00ad',
  '\u00e4\u00bb',
  '\u00e5\u00ae',
  '\u00ef\u00bc',
  '\u6d93\u5a5a\u647c',
  '\u5a34\u5b2d\u762f',
  '\u7481\u677f\u7e42',
  '\u9358\u5d87\u7f09',
  '\u59af\u2103\u5af9',
  '\u93ad\u3220',
  '\u9358\u5d87',
  '\u6957\u5cb8\u7629',
  '\u934a\u521b\u7f09',
  '\u59a7\u6a81',
  '\u5997\u30e6',
  '\u5e34\u5bb8\u30e5\u53ff',
  '\u93b5\u0446',
  '\u93c9\u51ae\u6aba',
  '\u59ab\u20ac',
  '\u6fb6\u8fab\u89e6',
  '\u9358\u71b7\u74d9',
]

const HARD_MOJIBAKE_MARKERS = [
  '\uFFFD',
  '\u951f\u65a4\u62f7',
  '\u9225?',
  '\u9241?',
  '\u922b?',
  '\u9239\u20ac',
  '\u9239?',
]

const MOJIBAKE_CLUSTER_PATTERN =
  /[\u93cc\u7359\u7487\u935a\u951f\u65a4\u62f7\u95bf\u71b8\u67bb\u93b7\u9225\u9241\u922b\u9239\u59ab\u9435\u95c1\u6d93\u6fee\u7f01\u59d8\u945e\u5997\u93b5\u93c9\u51ae\u6aba\u6fb6\u8fab\u89e6\u9358\u71b7\u74d9\u5e34\u5bb8\u53ff\u0446]{2,}/u
const LATIN1_MOJIBAKE_CLUSTER_PATTERN =
  /(?:\u00e2[\u20ac\u0153]|\u00e6[\u00b5\u0080-\u00bf]|\u00e8[\u00ae\u00af\u0080-\u00bf]|\u00e5[\u00ad\u00ae\u0080-\u00bf]|\u00e4[\u00bb\u0080-\u00bf]|\u00ef\u00bc){2,}/u

export function scoreMojibake(text: string): number {
  let score = 0
  for (const marker of HARD_MOJIBAKE_MARKERS) {
    if (text.includes(marker)) score += 2
  }
  for (const marker of MOJIBAKE_MARKERS) {
    if (text.includes(marker)) score++
  }
  if (MOJIBAKE_CLUSTER_PATTERN.test(text)) score++
  if (LATIN1_MOJIBAKE_CLUSTER_PATTERN.test(text)) score++
  return score
}

export function looksLikeMojibake(text: string): boolean {
  return scoreMojibake(text) >= 2
}

export function findMojibakeIssuesInText(
  path: string,
  text: string,
): DsxuMojibakeIssue[] {
  return text
    .split(/\r?\n/)
    .map((lineText, index) => ({
      path,
      line: index + 1,
      excerpt: lineText.trim().slice(0, 220),
      score: scoreMojibake(lineText),
    }))
    .filter(issue => issue.score >= 2)
}

export function classifyMojibakeLineSurface(
  lineText: string,
): DsxuMojibakeSurface {
  const trimmed = lineText.trimStart()
  const inlineCommentIndex = lineText.indexOf('//')
  if (
    inlineCommentIndex >= 0 &&
    scoreMojibake(lineText.slice(0, inlineCommentIndex)) < 2 &&
    scoreMojibake(lineText.slice(inlineCommentIndex)) >= 2
  ) {
    return 'comment'
  }
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  ) {
    return 'comment'
  }
  if (/['"`]/.test(lineText) || /<Text\b|<Box\b|jsx:|text:|message:/i.test(lineText)) {
    return 'string_or_template'
  }
  return 'unknown'
}

export function isActiveUserVisibleSourcePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return /(^|\/)src\/(?:components|screens|commands|tools|services\/api|ink)\/|(^|\/)src\/utils\/(?:messages|errors|format|shell|permissions|task)(?:\/|\.ts$|\.tsx$)/.test(
    normalized,
  )
}

export function findClassifiedMojibakeIssuesInText(
  path: string,
  text: string,
): DsxuClassifiedMojibakeIssue[] {
  return text
    .split(/\r?\n/)
    .map((lineText, index) => {
      const surface = classifyMojibakeLineSurface(lineText)
      const activePath = isActiveUserVisibleSourcePath(path)
      return {
        path,
        line: index + 1,
        excerpt: lineText.trim().slice(0, 220),
        score: scoreMojibake(lineText),
        surface,
        activePath,
        userVisibleRisk: activePath && surface !== 'comment',
      }
    })
    .filter(issue => issue.score >= 2)
}

export function buildDsxuTuiHealthSnapshot(
  input: DsxuTuiHealthSnapshotInput,
): DsxuTuiHealthSnapshot {
  const issues: DsxuTuiHealthIssue[] = []
  const backgroundTasks = input.backgroundTasks ?? []
  const backgroundTaskCount =
    input.backgroundTaskCount ?? backgroundTasks.length

  if (
    input.toolUseConfirmQueueLength > 0 &&
    input.focusedInputDialog !== 'tool-permission' &&
    !input.permissionFallbackVisible
  ) {
    issues.push({
      kind: 'permission_prompt_hidden',
      severity: 'critical',
      message:
        'Tool permission is queued but neither the approval panel nor the fixed fallback bar is visible.',
    })
  }

  if (
    input.isLoading &&
    !input.showSpinner &&
    input.streamingTextLength === 0 &&
    input.inProgressToolUseCount === 0 &&
    input.toolUseConfirmQueueLength === 0 &&
    !input.focusedInputDialog
  ) {
    issues.push({
      kind: 'loading_without_visible_progress',
      severity: 'critical',
      message:
        'The turn is loading but the UI has no spinner, streaming text, active tool, or visible dialog.',
    })
  }

  if (input.autoContinueSourceUuid && input.mainPromptCommandQueued) {
    issues.push({
      kind: 'auto_continue_waiting_behind_queue',
      severity: 'warning',
      message:
        'A tool-result auto-continue source exists but a main-thread queued command is ahead of it.',
    })
  }

  if (
    input.autoContinueSourceUuid &&
    input.autoContinueSourceUuid === input.lastAutoContinueSourceUuid
  ) {
    issues.push({
      kind: 'auto_continue_duplicate_source',
      severity: 'info',
      message: 'The latest tool-result auto-continue source was already consumed.',
    })
  }

  const status =
    issues.some(issue => issue.severity === 'critical')
      ? 'stalled'
      : input.toolUseConfirmQueueLength > 0 || input.focusedInputDialog
        ? 'waiting'
        : input.isLoading
          ? 'busy'
          : 'idle'

  const visibleState: DsxuTuiVisibleState =
    status === 'stalled'
      ? 'stuck_no_event'
      : input.toolUseConfirmQueueLength > 0 || input.focusedInputDialog === 'tool-permission'
        ? 'permission_waiting'
        : input.inProgressToolUseCount > 0
          ? 'tool_running'
          : backgroundTaskCount > 0
            ? 'background_task_running'
            : input.isLoading
              ? 'model_thinking'
              : 'idle'

  const summary =
    issues.length === 0
      ? `DSXU TUI health: ${status}; visible_state=${visibleState}${
          visibleState === 'background_task_running'
            ? `; background_tasks=${backgroundTaskCount}`
            : ''
        }`
      : `DSXU TUI health: ${status}; visible_state=${visibleState}; ${issues.map(issue => issue.kind).join(', ')}`

  return {
    status,
    visibleState,
    issues,
    backgroundTaskCount,
    backgroundTasks,
    summary,
  }
}
