import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

export const FILE_WRITE_TOOL_NAME = 'Write'
export const DESCRIPTION = 'Write a file to the local filesystem.'

function getPreReadInstruction(): string {
  return `\n- If this is an existing file, you MUST use the ${FILE_READ_TOOL_NAME} tool first to read the file's contents. This tool will fail if you did not read the file first.`
}

export function getWriteToolDescription(): string {
  return `Writes a file to the local filesystem.

Usage:
- This tool will overwrite the existing file if there is one at the provided path.${getPreReadInstruction()}
- Prefer the Edit tool for modifying existing files \u2014 it only sends the diff. Only use this tool to create new files or for complete rewrites.
- NEVER create documentation files (*.md) or README files unless explicitly requested by the User.
- Do not create replacement source or test directories when the task asks to fix or extend an existing project. First discover existing source/tests with Glob/Grep/Read and patch them with Edit.
- Only use emojis if the user explicitly requests it. Avoid writing emojis to files unless asked.
- After a successful write, do not repeat the same Write unless verification proves the content is wrong. Run the smallest relevant verification command next, or Read only when you need different fresh evidence.

DSXU weak-model discipline:
- When to use: use Write to create a new required file or perform a deliberate full rewrite after the file has been read if it already exists.
- When not to use: do not use Write for small edits, speculative files, unrequested docs, hidden side projects, or to overwrite files outside the allowed scope.
- Recovery after failure: if Write is rejected or out of scope, replan with Edit or ask a specific scope question; if content is wrong after verification, patch with Edit instead of rewriting again.
- Weak-model anti-pattern: do not use shell heredocs, echo redirection, cat redirection, or PowerShell Set-Content to bypass Write/Edit permissions.
- Verification / evidence: after writing code or config, run the smallest relevant verification command or read the new file if no executable check exists.`
}


// V14 strict lifecycle shim: tools-FileWriteTool-prompt
export function processToolsFileWriteToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-FileWriteTool-prompt-state'
  const lifecycle = 'tools-FileWriteTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsFileWriteToolPromptStrict(input) {
  return processToolsFileWriteToolPromptStrictLifecycle(input)
}
