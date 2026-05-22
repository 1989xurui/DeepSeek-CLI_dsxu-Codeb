import { stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import {
  buildRunNativeTestDecision,
  getVerificationIntentKey,
} from '../../dsxu/engine/v18-semantic-tools.js'
import {
  extractSemanticVerificationEventsFromMessages,
  hasSourceMutationAfterLatestSameFailedVerification,
} from './semanticVerificationMessages.js'

export const RUN_NATIVE_TEST_TOOL_NAME = 'RunNativeTest'

const inputSchema = lazySchema(() =>
  z.strictObject({
    command: z
      .string()
      .describe('Native test command, such as "bun test" or "npm test".'),
    cwd: z
      .string()
      .describe('Absolute project or fixture directory where the test should run.'),
    reason: z
      .string()
      .optional()
      .describe('Short reason this native test is the next required verification.'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    status: z.enum(['pass', 'fail', 'blocked', 'already_passed']),
    command: z.string(),
    cwd: z.string(),
    exitCode: z.number().nullable(),
    stdout: z.string(),
    stderr: z.string(),
    decisionReason: z.string(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

function parseNativeTestCommand(command: string): string[] | null {
  const parts = command.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  const [runner, subcommand] = parts
  if (!runner || !subcommand) return null
  const allowedRunner = /^(bun|npm|pnpm|yarn|pytest|go|cargo)$/.test(runner)
  if (!allowedRunner) return null
  if (runner === 'bun' && subcommand === 'test') return parts
  if (runner === 'npm' && (subcommand === 'test' || (subcommand === 'run' && parts[2] === 'test'))) return parts
  if ((runner === 'pnpm' || runner === 'yarn') && subcommand === 'test') return parts
  if (runner === 'pytest') return parts
  if ((runner === 'go' || runner === 'cargo') && subcommand === 'test') return parts
  return null
}

function truncateOutput(value: string, limit = 4000): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit)}\n... DSXU RunNativeTest output truncated ...`
}

async function runNativeCommand(args: string[], cwd: string): Promise<{
  exitCode: number | null
  stdout: string
  stderr: string
}> {
  const child = Bun.spawn(args, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return {
    exitCode,
    stdout,
    stderr,
  }
}

export const RunNativeTestTool = buildTool({
  name: RUN_NATIVE_TEST_TOOL_NAME,
  searchHint: 'run the project native test command once',
  runtimeMetadata: {
    owner: 'DSXU Semantic Verification Tool',
    sideEffects: ['native-process-execution', 'test-output-capture'],
    permission: 'tool-specific checkPermissions plus DSXU Tool Gate visibility',
    evidence: ['verification intent key', 'decision reason', 'exit code', 'stdout/stderr'],
    uiProjection: 'RunNativeTest tool-use/result transcript',
  },
  maxResultSizeChars: 100_000,
  async description() {
    return 'Run one native project test command with DSXU repeated-verification discipline'
  },
  async prompt() {
    return [
      'Use RunNativeTest for focused native verification instead of raw Bash/PowerShell when this tool is available.',
      'Use it for commands like `bun test`, `npm test`, `pnpm test`, `yarn test`, `pytest`, `go test`, or `cargo test`.',
      'Always provide an absolute `cwd` and the smallest relevant native test command.',
      'Do not call it twice with the same failing command unless source changed or your strategy genuinely changed.',
      'After RunNativeTest reports PASS, either call CollectEvidence before the final answer, or emit the final answer/PASS marker immediately. Never call any tool after a requested PASS marker has been emitted.',
    ].join('\n')
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isEnabled() {
    return isEnvTruthy(process.env.DSXU_SEMANTIC_TOOLS_ENABLED)
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    return false
  },
  isOpenWorld() {
    return false
  },
  userFacingName() {
    return RUN_NATIVE_TEST_TOOL_NAME
  },
  renderToolUseMessage(input) {
    const command = typeof input.command === 'string' ? input.command : ''
    return command ? `RunNativeTest(${command})` : 'RunNativeTest'
  },
  async validateInput(input) {
    if (!parseNativeTestCommand(input.command)) {
      return {
        result: false,
        message:
          'RunNativeTest only accepts native test commands such as bun test, npm test, pnpm test, yarn test, pytest, go test, or cargo test.',
        errorCode: 1,
      }
    }
    if (!isAbsolute(input.cwd)) {
      return {
        result: false,
        message: 'RunNativeTest requires an absolute cwd so execution cannot drift outside the reviewed project boundary.',
        errorCode: 1,
      }
    }
    try {
      const cwdStats = await stat(input.cwd)
      if (!cwdStats.isDirectory()) {
        return {
          result: false,
          message: 'RunNativeTest cwd must point to an existing directory.',
          errorCode: 1,
        }
      }
    } catch {
      return {
        result: false,
        message: 'RunNativeTest cwd must point to an existing directory.',
        errorCode: 1,
      }
    }
    return { result: true }
  },
  async checkPermissions(input) {
    return {
      behavior: 'passthrough',
      message: `RunNativeTest wants to execute '${input.command}' in '${input.cwd}'.`,
    }
  },
  async call(input, context) {
    const previousAttempts = extractSemanticVerificationEventsFromMessages(
      context.messages,
    )
    const currentIntent = getVerificationIntentKey(input)
    const sourceChangedSinceLastAttempt =
      hasSourceMutationAfterLatestSameFailedVerification(
        context.messages,
        event => getVerificationIntentKey(event) === currentIntent,
      )
    const decision = buildRunNativeTestDecision({
      command: input.command,
      cwd: input.cwd,
      previousAttempts,
      sourceChangedSinceLastAttempt,
    })

    if (decision.action === 'block_repeated_verification') {
      return {
        data: {
          status: 'blocked',
          command: input.command,
          cwd: input.cwd,
          exitCode: decision.latestExitCode ?? null,
          stdout: '',
          stderr: '',
          decisionReason: decision.reason,
        },
      }
    }
    if (decision.action === 'collect_existing_pass') {
      return {
        data: {
          status: 'already_passed',
          command: input.command,
          cwd: input.cwd,
          exitCode: 0,
          stdout: '',
          stderr: '',
          decisionReason: decision.reason,
        },
      }
    }

    const args = parseNativeTestCommand(input.command)!
    const result = await runNativeCommand(args, input.cwd)
    return {
      data: {
        status: result.exitCode === 0 ? 'pass' : 'fail',
        command: input.command,
        cwd: input.cwd,
        exitCode: result.exitCode,
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
        decisionReason: decision.reason,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const out = content as Output
    const state =
      out.status === 'pass' || out.status === 'already_passed'
        ? 'verification_passed'
        : out.status === 'blocked'
          ? 'repeated_native_verification_blocked'
          : 'verification_failed'
    const lines = [
      `RunNativeTest status: ${out.status}`,
      `command=${out.command}`,
      `cwd=${out.cwd}`,
      `exitCode=${out.exitCode ?? 'null'}`,
      `decision=${out.decisionReason}`,
      out.stdout ? `stdout:\n${out.stdout}` : '',
      out.stderr ? `stderr:\n${out.stderr}` : '',
      `DSXU tool state: ${state}; semanticTool=RunNativeTest; next=${out.status === 'pass' || out.status === 'already_passed' ? 'collect_evidence_before_final_or_final_now' : out.status === 'blocked' ? 'change_source_or_strategy' : 'repair_or_report_partial'}.`,
    ].filter(Boolean)
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: lines.join('\n'),
      is_error: out.status === 'fail' || out.status === 'blocked',
    }
  },
} satisfies ToolDef<InputSchema, Output>)
