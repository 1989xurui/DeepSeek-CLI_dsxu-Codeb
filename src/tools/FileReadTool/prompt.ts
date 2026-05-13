import { isPDFSupported } from '../../utils/pdfUtils.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

// Use a string constant for tool names to avoid circular dependencies
export const FILE_READ_TOOL_NAME = 'Read'

export const FILE_UNCHANGED_STUB =
  'DSXU tool state: read_cache_hit. File unchanged since last read. Treat this as successful fresh evidence for the current cursor step. The content from the most recent earlier Read tool_result for this file is still current. If you are following a numbered plan, mark this Read step complete and advance to the next file, Edit, or verification step; do not Read this same file again unless a later tool result changed it. If an Edit or Write just succeeded, do not repeat that same edit/write; run verification next unless you need different evidence.'

export const MAX_LINES_TO_READ = 2000

export const DESCRIPTION = 'Read a file from the local filesystem.'

export const DSXU_FILE_READ_DISCIPLINE = `
DSXU weak-model discipline:
- When to use: use Read for exact local file contents, screenshots/images, notebooks, PDFs, and source evidence before analysis or edits.
- When not to use: do not use Read for directories, filename discovery, content search, shell output, web pages, or MCP resources. If available, use Glob for file patterns and Grep for content search. Use Bash/PowerShell for commands, WebFetch for web pages, and ReadMcpResource for MCP resources only when those tools are available in the current turn.
- Recovery after failure: if the path is a directory, use an available dedicated file discovery tool. If no discovery tool is available, use exact paths from the task prompt or report PARTIAL with the missing path evidence; do not switch to shell listing. If the file is too large, reread a targeted range; if the file is unchanged after a successful Edit/Write, do not repeat the edit and run verification next.
- Weak-model anti-pattern: do not treat a stale or unchanged Read result as proof that a successful Edit/Write failed. Prefer command/test verification or a fresh targeted read only when you need different evidence.
- Verification / evidence: cite file paths and line numbers from Read output when making claims about source code.`

export const LINE_FORMAT_INSTRUCTION =
  '- Results are returned using cat -n format, with line numbers starting at 1'

export const OFFSET_INSTRUCTION_DEFAULT =
  "- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters"

export const OFFSET_INSTRUCTION_TARGETED =
  '- When you already know which part of the file you need, only read that part. This can be important for larger files.'

/**
 * Renders the Read tool prompt template.  The caller (FileReadTool) supplies
 * the runtime-computed parts.
 */
export function renderPromptTemplate(
  lineFormat: string,
  maxSizeInstruction: string,
  offsetInstruction: string,
): string {
  return `Reads a file from the local filesystem. You can access any file directly by using this tool.
Assume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.

Usage:
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to ${MAX_LINES_TO_READ} lines starting from the beginning of the file${maxSizeInstruction}
${offsetInstruction}
${lineFormat}
- This tool allows DSXU Code to read images (eg PNG, JPG, etc). When reading an image file the contents are presented visually as DSXU Code is a multimodal LLM.${
    isPDFSupported()
      ? '\n- This tool can read PDF files (.pdf). For large PDFs (more than 10 pages), you MUST provide the pages parameter to read specific page ranges (e.g., pages: "1-5"). Reading a large PDF without the pages parameter will fail. Maximum 20 pages per request.'
      : ''
  }
- This tool can read Jupyter notebooks (.ipynb files) and returns all cells with their outputs, combining code, text, and visualizations.
- This tool can only read files, not directories. To read a directory, use an ls command via the ${BASH_TOOL_NAME} tool.
- You will regularly be asked to read screenshots. If the user provides a path to a screenshot, ALWAYS use this tool to view the file at the path. This tool will work with all temporary file paths.
- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.
${DSXU_FILE_READ_DISCIPLINE}`
}

export function getDsxuFileReadPromptRuntimeProfile(): {
  runtime: 'DSXU FileRead Prompt'
  maxLinesToRead: number
  multimodal: readonly string[]
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU FileRead Prompt',
    maxLinesToRead: MAX_LINES_TO_READ,
    multimodal: isPDFSupported()
      ? ['images', 'pdf', 'notebooks']
      : ['images', 'notebooks'],
    activationEvidence: [
      'prompt requires absolute file paths for model-driven reads',
      'line offset and limit guidance supports targeted context packing',
      'image/PDF/notebook handling is explicitly exposed to the model',
      'directory reads are redirected to Bash ls rather than abusing file reads',
      'weak-model discipline separates Read from Glob, Grep, shell commands, web, and MCP resources',
      'unchanged read cache-hit results instruct the model to advance the cursor instead of repeating the same Read/Edit',
    ],
  }
}


// V14 strict lifecycle shim: tools-FileReadTool-prompt
export function processToolsFileReadToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-FileReadTool-prompt-state'
  const lifecycle = 'tools-FileReadTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsFileReadToolPromptStrict(input) {
  return processToolsFileReadToolPromptStrictLifecycle(input)
}
