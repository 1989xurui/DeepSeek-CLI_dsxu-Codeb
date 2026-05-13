export const GLOB_TOOL_NAME = 'Glob'

export const DESCRIPTION = `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead

DSXU weak-model discipline:
- When to use: use Glob to discover files by path, extension, directory, or filename pattern.
- When not to use: do not use Glob to search source contents, symbols, TODOs, error messages, or string literals. Use Grep for file content and LSP for symbol-aware lookup.
- Recovery after failure: if Glob returns too many files, narrow the path or pattern; if it returns no files, check the directory scope once before switching strategy.
- Weak-model anti-pattern: do not run shell find/ls when Glob can answer the file-discovery question. Do not treat a filename match as evidence that code content exists.
- Verification / evidence: follow Glob results with Read or Grep before making claims about file contents.`


// V14 strict lifecycle shim: tools-GlobTool-prompt
export function processToolsGlobToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-GlobTool-prompt-state'
  const lifecycle = 'tools-GlobTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsGlobToolPromptStrict(input) {
  return processToolsGlobToolPromptStrictLifecycle(input)
}
