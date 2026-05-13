import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

export const GREP_TOOL_NAME = 'Grep'

export function getDescription(): string {
  return `A powerful search tool built on ripgrep

  Usage:
  - ALWAYS use ${GREP_TOOL_NAME} for search tasks. NEVER invoke \`grep\` or \`rg\` as a ${BASH_TOOL_NAME} command. The ${GREP_TOOL_NAME} tool has been optimized for correct permissions and access.
  - Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
  - Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
  - Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
  - Use ${AGENT_TOOL_NAME} tool for open-ended searches requiring multiple rounds
  - Pattern syntax: Uses ripgrep (not grep) - literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)
  - Multiline matching: By default patterns match within single lines only. For cross-line patterns like \`struct \\{[\\s\\S]*?field\`, use \`multiline: true\`

  DSXU weak-model discipline:
  - When to use: use ${GREP_TOOL_NAME} for exact or regex content search across files, especially identifiers, error text, TODOs, imports, and config keys.
  - When not to use: do not use ${GREP_TOOL_NAME} for filename discovery, directory listing, shell command output, semantic symbol relationships, or web/MCP data. Use Glob, shell tools, LSP, WebFetch, or MCP tools as appropriate.
  - Recovery after failure: if results are too broad, add path/type/glob filters; if no results appear, simplify the regex or search a literal substring before changing tools.
  - Weak-model anti-pattern: do not invoke grep/rg through ${BASH_TOOL_NAME}; do not claim behavior from a Grep hit until you Read the relevant code when context matters.
  - Verification / evidence: cite matching files and then Read the specific file/range before editing or reporting nuanced behavior.
`
}
