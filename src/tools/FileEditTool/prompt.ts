import { isCompactLinePrefixEnabled } from '../../utils/file.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

function getPreReadInstruction(): string {
  return `\n- You must use your \`${FILE_READ_TOOL_NAME}\` tool at least once in the conversation before editing. This tool will error if you attempt an edit without reading the file. `
}

export function getEditToolDescription(): string {
  return getDefaultEditDescription()
}

function getDefaultEditDescription(): string {
  const prefixFormat = isCompactLinePrefixEnabled()
    ? 'line number + tab'
    : 'spaces + line number + arrow'
  const minimalUniquenessHint =
    process.env.USER_TYPE === 'ant'
      ? `\n- Use the smallest old_string that's clearly unique — usually 2-4 adjacent lines is sufficient. Avoid including 10+ lines of context when less uniquely identifies the target.`
      : ''
  return `Performs exact string replacements in files.

Usage:${getPreReadInstruction()}
- When editing text from Read tool output, ensure you preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: ${prefixFormat}. Everything after that is the actual file content to match. Never include any part of the line number prefix in the old_string or new_string.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- Only use emojis if the user explicitly requests it. Avoid adding emojis to files unless asked.
- The edit will FAIL if \`old_string\` is not unique in the file. Either provide a larger string with more surrounding context to make it unique or use \`replace_all\` to change every instance of \`old_string\`.${minimalUniquenessHint}
- Use \`replace_all\` for replacing and renaming strings across the file. This parameter is useful if you want to rename a variable for instance.
- After a successful edit, do not repeat the same Edit. Run the smallest relevant verification command next, or Read only when you need different fresh evidence.
- V12 complex Edit preflight: before a large or risky Edit, internally review the diff you are about to apply. Large/risky means \`old_string\` or \`new_string\` is over 8 lines, or the edit touches public APIs, tests, permissions, tool calls, query loop, Agent, MCP, or Workflow.
- The preflight must confirm: \`old_string\` does not include Read line-number prefixes or display tabs; \`new_string\` does not introduce symbols you have not read or located; the change stays inside the current scope fence; and the planned verification command can prove the edit. If any check fails, reread or narrow the edit before calling Edit.
- Security/regex Edit preflight: before changing sanitizers, escaping, auth, permission, or validation regexes, reason through one concrete input -> expected output example. If removing HTML attributes or unsafe inline handlers, make sure the replacement consumes the full attribute boundary, including surrounding whitespace when the expected output should not leave an extra space. Pair the source edit with a regression assertion that proves the exact expected output.

DSXU weak-model discipline:
- When to use: use Edit for small, exact modifications to an existing file after reading the target file.
- When not to use: do not use Edit to create new files, rewrite whole files without need, change unread files, or patch generated/vendor files outside the requested scope.
- Recovery after failure: if old_string is not unique or not found, reread the smallest relevant range and retry once with a more precise unique string; if the edit succeeded, verify instead of repeating it.
- Weak-model anti-pattern: do not call Read and Edit for the same file in the same assistant turn. Read must complete before the dependent Edit is attempted. Do not issue two Edit calls in one assistant turn; wait for the first Edit result before deciding the next distinct Edit. Do not copy Read line-number prefixes or their tab separators into old_string. Do not let stale Read cache, unchanged-file reminders, or uncertainty trigger the same Edit again. Do not use shell sed/awk or PowerShell replacement to bypass Edit discipline. Do not send large speculative edits without a preflight review.
- Verification / evidence: after a successful edit, run the smallest relevant test/build/check or read a targeted range only if command verification is impossible.`
}


// V14 strict lifecycle shim: tools-FileEditTool-prompt
export function processToolsFileEditToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-FileEditTool-prompt-state'
  const lifecycle = 'tools-FileEditTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsFileEditToolPromptStrict(input) {
  return processToolsFileEditToolPromptStrictLifecycle(input)
}
