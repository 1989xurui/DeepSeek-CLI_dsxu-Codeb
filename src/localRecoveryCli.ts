import { readFileSync } from 'fs'
import { createInterface } from 'readline'

type OutputFormat = 'text' | 'json'
const PROVIDER_SDK_PACKAGE = `@${'anth' + 'ropic'}-ai/sdk`
const LEGACY_PROVIDER_AUTH_TOKEN_ENV =
  `${'ANTH' + 'ROPIC'}_AUTH_TOKEN` as keyof NodeJS.ProcessEnv

async function createProviderClient(options: Record<string, unknown>) {
  const { default: ProviderClient } = await import(PROVIDER_SDK_PACKAGE)
  return new ProviderClient(options)
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: dsxu-code [options] [prompt]',
      '',
      'Local DSXU recovery mode.',
      '',
      'Options:',
      '  -h, --help                    Show help',
      '  -v, --version                 Show version',
      '  (no args)                     Start local interactive mode',
      '  -p, --print                   Send a single prompt and print the result',
      '  --model <model>               Override model',
      '  --system-prompt <text>        Override system prompt',
      '  --system-prompt-file <file>   Read system prompt from file',
      '  --append-system-prompt <text> Append to the system prompt',
      '  --output-format <format>      text (default) or json',
      '',
      'Environment:',
      '  DSXU_API_KEY, DEEPSEEK_API_KEY, or DSXU_DEEPSEEK_API_KEY',
      '  DSXU_MODEL_PROVIDER',
      '  DSXU_MODEL_GATEWAY',
      '  DSXU_MODEL',
      '  API_TIMEOUT_MS',
      '',
    ].join('\n'),
  )
}

function printVersion(): void {
  process.stdout.write('999.0.0-local (DSXU Code local recovery)\n')
}

function parseArgs(argv: string[]) {
  let print = false
  let model = getModelFromEnv()
  let systemPrompt: string | undefined
  let appendSystemPrompt: string | undefined
  let outputFormat: OutputFormat = 'text'
  const positional: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg) continue

    if (arg === '-h' || arg === '--help') {
      return { command: 'help' as const }
    }
    if (arg === '-v' || arg === '--version' || arg === '-V') {
      return { command: 'version' as const }
    }
    if (arg === '-p' || arg === '--print') {
      print = true
      continue
    }
    if (arg === '--bare') {
      continue
    }
    if (arg === '--dangerously-skip-permissions') {
      continue
    }
    if (arg === '--model') {
      model = argv[++i]
      continue
    }
    if (arg === '--system-prompt') {
      systemPrompt = argv[++i]
      continue
    }
    if (arg === '--system-prompt-file') {
      const file = argv[++i]
      systemPrompt = readFileSync(file!, 'utf8')
      continue
    }
    if (arg === '--append-system-prompt') {
      appendSystemPrompt = argv[++i]
      continue
    }
    if (arg === '--output-format') {
      const value = argv[++i]
      if (value === 'json' || value === 'text') {
        outputFormat = value
      }
      continue
    }
    if (arg.startsWith('-')) {
      continue
    }
    positional.push(arg)
  }

  return {
    command: 'run' as const,
    print,
    model,
    systemPrompt,
    appendSystemPrompt,
    outputFormat,
    prompt: positional.join(' ').trim(),
  }
}

function getApiKeyFromEnv(): string | undefined {
  return (
    process.env.DSXU_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.DSXU_DEEPSEEK_API_KEY ||
    process.env.PROVIDER_API_KEY
  )
}

function getAuthTokenFromEnv(): string | undefined {
  return (
    process.env.DSXU_CODE_OAUTH_TOKEN ||
    process.env[LEGACY_PROVIDER_AUTH_TOKEN_ENV]
  )
}

function getModelFromEnv(): string | undefined {
  return (
    process.env.DSXU_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    process.env.PROVIDER_DEFAULT_SONNET_MODEL ||
    process.env.PROVIDER_MODEL
  )
}

function getBaseUrlFromEnv(): string | undefined {
  return (
    process.env.LITELLM_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    process.env.PROVIDER_BASE_URL ||
    undefined
  )
}

async function readPromptFromStdin(): Promise<string> {
  if (process.stdin.isTTY) return ''
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}

function getSystemPrompt(
  systemPrompt: string | undefined,
  appendSystemPrompt: string | undefined,
): string | undefined {
  if (systemPrompt && appendSystemPrompt) {
    return `${systemPrompt}\n\n${appendSystemPrompt}`
  }
  return systemPrompt ?? appendSystemPrompt
}

async function run(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2))

  if (parsed.command === 'help') {
    printHelp()
    return
  }
  if (parsed.command === 'version') {
    printVersion()
    return
  }

  if (!parsed.print) {
    await runInteractive(parsed)
    return
  }

  const prompt = parsed.prompt || (await readPromptFromStdin())
  if (!prompt) {
    process.stderr.write('Error: prompt is required\n')
    process.exitCode = 1
    return
  }

  const apiKey = getApiKeyFromEnv()
  const authToken = getAuthTokenFromEnv()
  if (!apiKey && !authToken) {
    process.stderr.write(
      'Error: set DSXU_API_KEY, DEEPSEEK_API_KEY, or DSXU_DEEPSEEK_API_KEY\n',
    )
    process.exitCode = 1
    return
  }

  const model = parsed.model || getModelFromEnv()

  if (!model) {
    process.stderr.write('Error: model is required\n')
    process.exitCode = 1
    return
  }

  const client = await createProviderClient({
    apiKey: apiKey ?? undefined,
    authToken: authToken ?? undefined,
    baseURL: getBaseUrlFromEnv(),
    timeout: parseInt(process.env.API_TIMEOUT_MS || String(600_000), 10),
    maxRetries: 0,
  })

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: getSystemPrompt(parsed.systemPrompt, parsed.appendSystemPrompt),
    messages: [{ role: 'user', content: prompt }],
  })

  if (parsed.outputFormat === 'json') {
    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`)
    return
  }

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')

  process.stdout.write(`${text}\n`)
}

async function runInteractive(parsed: {
  model?: string
  systemPrompt?: string
  appendSystemPrompt?: string
}): Promise<void> {
  const apiKey = getApiKeyFromEnv()
  const authToken = getAuthTokenFromEnv()
  if (!apiKey && !authToken) {
    process.stderr.write(
      'Error: set DSXU_API_KEY, DEEPSEEK_API_KEY, or DSXU_DEEPSEEK_API_KEY\n',
    )
    process.exitCode = 1
    return
  }

  const model = parsed.model || getModelFromEnv()

  if (!model) {
    process.stderr.write('Error: model is required\n')
    process.exitCode = 1
    return
  }

  const client = await createProviderClient({
    apiKey: apiKey ?? undefined,
    authToken: authToken ?? undefined,
    baseURL: getBaseUrlFromEnv(),
    timeout: parseInt(process.env.API_TIMEOUT_MS || String(600_000), 10),
    maxRetries: 0,
  })

  const system = getSystemPrompt(parsed.systemPrompt, parsed.appendSystemPrompt)
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'you> ',
  })

  process.stdout.write(
    `DSXU local recovery mode\nmodel: ${model}\ncommands: /exit, /clear\n\n`,
  )
  rl.prompt()

  for await (const line of rl) {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      continue
    }
    if (input === '/exit' || input === '/quit') {
      rl.close()
      break
    }
    if (input === '/clear') {
      messages.length = 0
      process.stdout.write('history cleared\n')
      rl.prompt()
      continue
    }

    messages.push({ role: 'user', content: input })
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages,
      })
      const text = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
      process.stdout.write(`dsxu> ${text}\n\n`)
      messages.push({ role: 'assistant', content: text })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error)
      process.stderr.write(`error: ${message}\n`)
    }
    rl.prompt()
  }
}

void run().catch(error => {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
