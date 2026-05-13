import { isDsxuCodeEnvTruthy } from '../../utils/envUtils.js'
import { getMaxOutputLength } from '../../utils/shell/outputLimits.js'
import {
  getPowerShellEdition,
  type PowerShellEdition,
} from '../../utils/shell/powershellDetection.js'
import {
  getDefaultBashTimeoutMs,
  getMaxBashTimeoutMs,
} from '../../utils/timeouts.js'
import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../GrepTool/prompt.js'
import { POWERSHELL_TOOL_NAME } from './toolName.js'

export function getDefaultTimeoutMs(): number {
  return getDefaultBashTimeoutMs()
}

export function getMaxTimeoutMs(): number {
  return getMaxBashTimeoutMs()
}

export function getDsxuPowerShellPromptRuntimeProfile(): {
  runtime: 'DSXU PowerShell Prompt'
  backgroundDisableEnv: readonly string[]
  fileOperationPolicy: string
  shellRole: string
  activationEvidence?: readonly string[]
} {
  return {
    runtime: 'DSXU PowerShell Prompt',
    backgroundDisableEnv: [
      'DSXU_CODE_DISABLE_BACKGROUND_TASKS',
      'legacy provider disable-background-tasks alias',
    ],
    fileOperationPolicy:
      'PowerShell is for terminal operations; Read/Edit/Write/Glob/Grep remain the specialized DSXU coding tools',
    shellRole:
      'PowerShell remains available as a Windows execution tool under DSXU permission and evidence rules',
    activationEvidence: [
      'edition detection changes syntax guidance for Windows PowerShell 5.1 vs PowerShell 7+',
      'DSXU PowerShell startup sets UTF-8 defaults for console IO, Get-Content, Select-String, CSV import/export, and file writes',
      'prompt forbids Read-Host/Get-Credential/editor-style interactive commands',
      'file operations are routed to DSXU specialized tools instead of shell text commands',
      'background guidance prevents sleep polling for long-running commands',
      'weak-model anti-patterns block EncodedCommand, iex/iwr download execution, and protected-path redirects',
    ],
  }
}

function getBackgroundUsageNote(): string | null {
  if (isDsxuCodeEnvTruthy('DISABLE_BACKGROUND_TASKS')) {
    return null
  }
  return `  - You can use the \`run_in_background\` parameter to run the command in the background. Only use this if you don't need the result immediately and are OK being notified when it finishes. You do not need to check the output right away - you'll be notified when it finishes.`
}

function getSleepGuidance(): string | null {
  if (isDsxuCodeEnvTruthy('DISABLE_BACKGROUND_TASKS')) {
    return null
  }
  return `  - Avoid unnecessary \`Start-Sleep\` commands:
    - Do not sleep between commands that can run immediately; just run them.
    - If your command is long running and you would like to be notified when it finishes, use \`run_in_background\`. There is no need to sleep in this case.
    - Do not retry failing commands in a sleep loop; diagnose the root cause or consider an alternative approach.
    - If waiting for a background task you started with \`run_in_background\`, you will be notified when it completes; do not poll.
    - If you must poll an external process, use a check command rather than sleeping first.
    - If you must sleep, keep the duration short (1-5 seconds) to avoid blocking the user.`
}

function getEditionSection(edition: PowerShellEdition | null): string {
  if (edition === 'desktop') {
    return `PowerShell edition: Windows PowerShell 5.1 (powershell.exe)
   - Pipeline chain operators \`&&\` and \`||\` are NOT available; they cause a parser error. To run B only if A succeeds: \`A; if ($?) { B }\`. To chain unconditionally: \`A; B\`.
   - Ternary (\`?:\`), null-coalescing (\`??\`), and null-conditional (\`?.\`) operators are NOT available. Use \`if/else\` and explicit \`$null -eq\` checks instead.
   - Avoid \`2>&1\` on native executables. In 5.1, redirecting a native command's stderr inside PowerShell wraps each line in an ErrorRecord (NativeCommandError) and sets \`$?\` to \`$false\` even when the exe returned exit code 0. stderr is already captured for you; don't redirect it.
   - Plain Windows PowerShell 5.1 defaults are not UTF-8-safe for no-BOM files, but DSXU injects a UTF-8 prelude before every PowerShell command. Do not rely on a user profile or host code page for encoding correctness.
   - \`ConvertFrom-Json\` returns a PSCustomObject, not a hashtable. \`-AsHashtable\` is not available.`
  }
  if (edition === 'core') {
    return `PowerShell edition: PowerShell 7+ (pwsh)
   - Pipeline chain operators \`&&\` and \`||\` ARE available and work like bash. Prefer \`cmd1 && cmd2\` over \`cmd1; cmd2\` when cmd2 should only run if cmd1 succeeds.
   - Ternary (\`$cond ? $a : $b\`), null-coalescing (\`??\`), and null-conditional (\`?.\`) operators are available.
   - Default file encoding is UTF-8 without BOM.`
  }
  return `PowerShell edition: unknown; assume Windows PowerShell 5.1 for compatibility
   - Do NOT use \`&&\`, \`||\`, ternary \`?:\`, null-coalescing \`??\`, or null-conditional \`?.\`. These are PowerShell 7+ only and parser-error on 5.1.
   - To chain commands conditionally: \`A; if ($?) { B }\`. Unconditionally: \`A; B\`.`
}

export async function getPrompt(): Promise<string> {
  const backgroundNote = getBackgroundUsageNote()
  const sleepGuidance = getSleepGuidance()
  const edition = await getPowerShellEdition()

  return `Executes a given PowerShell command with optional timeout. Working directory persists between commands; shell state (variables, functions) does not.

IMPORTANT: This tool is for terminal operations via PowerShell: git, npm, docker, and PS cmdlets. DO NOT use it for file operations (reading, writing, editing, searching, finding files) - use the specialized tools for this instead.

${getEditionSection(edition)}

Before executing the command, please follow these steps:

1. Directory Verification:
   - Use DSXU Read for exact files. If DSXU Glob/Grep are available in this turn, use them for project file discovery and source inspection. Do not use \`Get-ChildItem\`, \`ls\`, \`dir\`, \`Get-Content\`, \`cat\`, or \`type\` when dedicated DSXU tools can provide the evidence; if discovery tools are unavailable, use exact paths from the task prompt or report PARTIAL.
   - Only verify a parent directory through PowerShell when no dedicated DSXU evidence exists, the command is allowed, and the task explicitly needs shell-level filesystem state.

2. Command Execution:
   - Always quote file paths that contain spaces with double quotes.
   - Capture the output of the command.

PowerShell Syntax Notes:
   - Variables use $ prefix: $myVar = "value".
   - Escape character is backtick (\`), not backslash.
   - Use Verb-Noun cmdlet naming for allowed PowerShell operations, such as Set-Location, New-Item, and Remove-Item.
   - Avoid aliases such as ls, dir, cat, type, and rm; they are easy to confuse with dedicated DSXU file tools or denied shell filesystem operations.
   - Pipe operator | passes objects, not plain text.
   - Use Select-Object, Where-Object, ForEach-Object for filtering and transformation.
   - String interpolation: "Hello $name" or "Hello $($obj.Property)".
   - Registry access uses PSDrive prefixes: \`HKLM:\\SOFTWARE\\...\`, \`HKCU:\\...\` - NOT raw \`HKEY_LOCAL_MACHINE\\...\`.
   - Environment variables: read with \`$env:NAME\`, set with \`$env:NAME = "value"\` (NOT \`Set-Variable\` or bash \`export\`).
   - Call native exe with spaces in path via call operator: \`& "C:\\Program Files\\App\\app.exe" arg1 arg2\`.

Interactive and blocking commands (will hang; this tool runs with -NonInteractive):
   - NEVER use \`Read-Host\`, \`Get-Credential\`, \`Out-GridView\`, \`$Host.UI.PromptForChoice\`, or \`pause\`.
   - Destructive cmdlets (\`Remove-Item\`, \`Stop-Process\`, \`Clear-Content\`, etc.) may prompt for confirmation. Add \`-Confirm:$false\` only when the action is intended and allowed.
   - Never use \`git rebase -i\`, \`git add -i\`, or other commands that open an interactive editor.

Passing multiline strings (commit messages, file content) to native executables:
   - Use a single-quoted here-string so PowerShell does not expand \`$\` or backticks inside. The closing \`'@\` MUST be at column 0 on its own line; indenting it is a parse error:
<example>
git commit -m @'
Commit message here.
Second line with $literal dollar signs.
'@
</example>
   - Use \`@'...'@\` (single-quoted, literal) not \`@"..."@\` (double-quoted, interpolated) unless you need variable expansion.
   - For arguments containing \`-\`, \`@\`, or other characters PowerShell parses as operators, use the stop-parsing token: \`git log --% --format=%H\`.

Usage notes:
  - The command argument is required.
  - You can specify an optional timeout in milliseconds (up to ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} minutes). If not specified, commands will timeout after ${getDefaultTimeoutMs()}ms (${getDefaultTimeoutMs() / 60000} minutes).
  - It is very helpful if you write a clear, concise description of what this command does.
  - If the output exceeds ${getMaxOutputLength()} characters, output will be truncated before being returned to you.
${backgroundNote ? backgroundNote + '\n' : ''}\
  - Avoid using PowerShell to run commands that have dedicated tools, unless explicitly instructed:
    - File search: If ${GLOB_TOOL_NAME} is available, use it (NOT Get-ChildItem, dir, or ls). If it is unavailable, use exact paths from the task prompt or report PARTIAL.
    - Content search: If ${GREP_TOOL_NAME} is available, use it (NOT Select-String). If it is unavailable, use exact paths from the task prompt or report PARTIAL.
    - Read files: Use ${FILE_READ_TOOL_NAME} (NOT Get-Content, Format-Hex, or [System.IO.File]::ReadAllText/ReadAllBytes; DSXU denies local file reads through PowerShell in coding tasks)
    - Edit files: Use ${FILE_EDIT_TOOL_NAME}
    - Write files: Use ${FILE_WRITE_TOOL_NAME} (NOT Set-Content/Out-File/Add-Content; DSXU denies local file writes through PowerShell in coding tasks)
    - Communication: Output text directly (NOT Write-Output/Write-Host)
  - When issuing multiple commands:
    - If the commands are independent and can run in parallel, make multiple ${POWERSHELL_TOOL_NAME} tool calls in a single message.
    - If the commands depend on each other and must run sequentially, chain them in a single ${POWERSHELL_TOOL_NAME} call (see edition-specific chaining syntax above).
    - Use \`;\` only when you need to run commands sequentially but don't care if earlier commands fail.
    - DO NOT use newlines to separate commands (newlines are ok in quoted strings and here-strings).
  - Do NOT prefix commands with \`cd\` or \`Set-Location\` -- the working directory is already set to the correct project directory automatically.
${sleepGuidance ? sleepGuidance + '\n' : ''}\
  - For git commands:
    - Prefer to create a new commit rather than amending an existing commit.
    - Before running destructive operations (e.g., git reset --hard, git push --force, git checkout --), consider whether there is a safer alternative that achieves the same goal. Only use destructive operations when they are truly the best approach.
    - Never skip hooks (--no-verify) or bypass signing (--no-gpg-sign, -c commit.gpgsign=false) unless the user has explicitly asked for it. If a hook fails, investigate and fix the underlying issue.

DSXU weak-model discipline:
  - When to use: use PowerShell for Windows-native commands, Windows paths, registry-safe inspection, Windows process/service checks, and commands the user explicitly asks to run in PowerShell.
  - When not to use: do not use PowerShell for local file reads/searches/edits/writes when DSXU Read/Grep/Glob/Edit/Write can do it; do not use it to enumerate a project just because the task is open-ended.
  - Recovery after failure: if syntax fails because the edition is 5.1, retry once with 5.1-safe syntax; if permission is denied, replan with a safer read-only command.
  - Weak-model anti-pattern: do not pipe downloaded scripts into execution, do not use EncodedCommand/iex/iwr shortcuts, do not redirect into protected Windows or WSL paths, and do not use interactive prompts.
  - File-write guardrail: if a task needs to change repository files, use ${FILE_EDIT_TOOL_NAME} or ${FILE_WRITE_TOOL_NAME}; PowerShell file-writing cmdlets such as Set-Content, Add-Content, Out-File, Clear-Content, Export-Csv, Export-Clixml, and Tee-Object are denied so edits keep diff, permission, and verification evidence.
  - File-read guardrail: if a task needs file contents, use ${FILE_READ_TOOL_NAME}; PowerShell file-reading cmdlets and .NET file APIs are denied so reads keep stable offsets and evidence.
  - Native command output: do not append \`2>&1\`, \`2>$null\`, or other stderr-suppression/merge redirects; DSXU captures stderr separately and hiding it removes recovery evidence.
  - Task-scope guardrail: if the current task or permission result forbids a command shape such as directory enumeration, shell reads, stream merging, or chained commands, that narrower rule wins over the general PowerShell examples.
  - Verification / evidence: cite the exact command and result that proves the claim; do not report PASS from a command that failed, timed out, was denied, or only produced partial output.
  - Stop-on-pass: after a PowerShell test/build command reports the requested PASS condition, do not rerun it for reassurance. Return the required marker or final answer immediately.`
}
