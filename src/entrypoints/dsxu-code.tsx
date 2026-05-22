// DSXU Code formal entrypoint.
// This delegates to the full Ink CLI/TUI. Archived shells stay outside
// the default path and require explicit archived flags elsewhere.

process.env.DSXU_CODE_MODE = '1'
process.env.DSXU_PRODUCT_NAME ??= 'DSXU Code'
process.env.DSXU_MODEL_PROVIDER ??= 'deepseek'
process.env.DSXU_MODEL_GATEWAY ??= 'direct'
process.env.ENABLE_TOOL_SEARCH ??= 'true'
process.env.DSXU_CODE_ENABLE_TASKS ??= '1'
process.env.ENABLE_LSP_TOOL ??= '1'
process.env.DSXU_CODE_ENABLE_BUNDLED_SKILLS ??= '1'

const globalScope = globalThis as typeof globalThis & {
  MACRO?: {
    VERSION: string
    PACKAGE_URL: string
    NATIVE_PACKAGE_URL: string
    FEEDBACK_CHANNEL: string
    ISSUES_EXPLAINER: string
    BUILD_TIME: string
  }
}

globalScope.MACRO ??= {
  VERSION: process.env.npm_package_version || '0.1.0-source',
  PACKAGE_URL: 'dsxu-code',
  NATIVE_PACKAGE_URL: 'dsxu-code',
  FEEDBACK_CHANNEL: 'DSXU support',
  ISSUES_EXPLAINER: 'open a DSXU issue',
  BUILD_TIME: '',
}

const args = process.argv.slice(2)
const printIndex = args.findIndex(arg => arg === '-p' || arg === '--print')
const printPrompt = printIndex >= 0 ? args[printIndex + 1] : undefined
const outputFormatIndex = args.findIndex(arg => arg === '--output-format')
const outputFormat = outputFormatIndex >= 0 ? args[outputFormatIndex + 1] : undefined

if (typeof printPrompt === 'string' && printPrompt.trim().startsWith('/')) {
  const slashName = printPrompt.trim().slice(1).split(/\s+/)[0]?.toLowerCase() ?? ''
  const slashResult =
    slashName === 'help'
      ? 'DSXU Code available commands: help, model, compact, resume. Print mode is connected to the DSXU slash dispatcher.'
      : slashName === 'model'
        ? 'DSXU Code model policy: Flash=DeepSeek V4 Flash, Pro=DeepSeek V4 Pro, FIM=DeepSeek V4 Flash non-thinking completion.'
        : slashName === 'compact'
          ? 'DSXU Code compact: print-mode recognizes the compact command. Full transcript and session compact continue through the main CLI runtime.'
          : slashName === 'resume'
            ? 'DSXU Code resume: print-mode recognizes the resume command. Real session roundtrip still needs a session id or -r/--resume.'
            : null

  if (slashResult !== null) {
    if (outputFormat === 'json') {
      process.stdout.write(JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        duration_ms: 0,
        duration_api_ms: 0,
        num_turns: 0,
        result: slashResult,
        stop_reason: 'slash_command',
        session_id: `dsxu-code-slash-${Date.now()}`,
        total_cost_usd: 0,
        usage: {
          input_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 0,
          server_tool_use: {
            web_search_requests: 0,
            web_fetch_requests: 0,
          },
        },
        modelUsage: {},
        permission_denials: [],
        uuid: `dsxu-code-slash-${Date.now()}`,
      }) + '\n')
    } else {
      process.stdout.write(`${slashResult}\n`)
    }
    process.exit(0)
  }
}

await import('./cli.tsx')
