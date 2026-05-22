import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  applyDsxuLaneCaseFixtures,
  collectPublicComparableDsxuLane,
} from '../dsxu-public-comparable-dsxu-lane'
import { collectPublicComparableRawEvidence } from '../dsxu-public-comparable-raw-evidence'

describe('dsxu-public-comparable-dsxu-lane', () => {
  test('captures DSXU lane evidence in an injected isolated workspace', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root)
    const workspace = join(root, 'isolated-workspace')
    const runCommandCalls: Array<{ command: readonly string[]; cwd: string }> = []
    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => {
        await mkdir(workspace, { recursive: true })
        return workspace
      },
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, cwd: options.cwd })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 1234,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: {
                content: [
                  { type: 'tool_use', name: 'Grep', input: { pattern: 'Terminal hit-rate' } },
                ],
              },
            }),
            JSON.stringify({
              type: 'user',
              message: {
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: 'call_1',
                    content: 'src/dsxu/engine/terminal-hit-rate.ts',
                    is_error: false,
                  },
                ],
              },
              tool_use_result: { filenames: ['src/dsxu/engine/terminal-hit-rate.ts'] },
            }),
            JSON.stringify({
              type: 'result',
              result: '{"caseId":"case-1","status":"PASS","evidence":["found source","mentions PARTIAL_TERMINAL_HIT_RATE as code data"],"toolsUsed":["Grep"],"risks":[],"nextAction":"none"}',
              total_cost_usd: 0.01,
              usage: { input_tokens: 100, cache_read_input_tokens: 50 },
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })
    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const importReport = await collectPublicComparableRawEvidence({
      root,
      manifestPath,
      outputPath: join(root, 'docs', 'generated', 'raw.json'),
      reportPath: join(root, 'docs', 'generated', 'import.json'),
    })

    expect(report).toMatchObject({
      status: 'PASS',
      capturedCaseCount: 1,
      publicBenchmarkClaimAllowed: false,
    })
    expect(runCommandCalls[0]?.cwd).toBe(workspace)
    expect(runCommandCalls[0]?.command).toContain('--output-format')
    expect(runCommandCalls[0]?.command.join(' ')).toContain('stream-json')
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(prompt).toContain('Lane tool contract:')
    expect(prompt).toContain('Allowed tools are exactly: Grep.')
    expect(prompt).toContain('Before the first tool call, write one visible intent sentence')
    expect(prompt).toContain('If you call any forbidden/unavailable tool')
    expect(metrics).toMatchObject({
      promptHash: 'hash-case-1',
      firstAttemptPass: true,
      finalPass: true,
      costUsd: 0.01,
      cacheHitRatePct: 50,
      toolResultChars: 'src/dsxu/engine/terminal-hit-rate.ts'.length,
      failureRecoveryEvents: 0,
      toolBudgetExceededCount: 0,
      readBudgetExceededCount: 0,
      shellBudgetExceededCount: 0,
    })
    expect(existsSync(join(caseDir, 'raw-transcript.jsonl'))).toBe(true)
    expect(existsSync(join(caseDir, 'tool-trace.jsonl'))).toBe(true)
    expect(existsSync(join(caseDir, 'final-report.json'))).toBe(true)
    expect(importReport).toMatchObject({
      importedCaseCount: 1,
      readyCaseCount: 0,
      publicBenchmarkClaimAllowed: false,
    })
    expect(importReport.cases[0]?.foundFields).toContain('rawTranscriptPath')
    expect(importReport.cases[0]?.foundFields).toContain('toolTracePath')

    const reusedReport = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane-reused.json'),
      force: false,
      prepareWorkspaceImpl: async () => {
        throw new Error('existing evidence should not allocate a workspace')
      },
      runCommandImpl: async () => {
        throw new Error('existing evidence should not rerun the model')
      },
    })
    expect(reusedReport).toMatchObject({
      status: 'PASS',
      capturedCaseCount: 1,
      passedCaseCount: 1,
      nonPassingCaseCount: 0,
    })
    expect(reusedReport.cases[0]?.status).toBe('REUSED_DSXU_LANE_EVIDENCE')
  })

  test('records a single case command error without aborting the whole lane batch', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'timeout-case',
      category: 'feature',
      allowedTools: 'Read',
      prompt: 'Read evidence and return final JSON.',
    })

    let observedTimeoutMs = 0
    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      caseTimeoutMs: 12_345,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, _command, options) => {
        observedTimeoutMs = options.timeoutMs
        throw new Error(`command timed out after ${options.timeoutMs}ms`)
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'timeout-case')
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(report.failedCaseCount).toBe(1)
    expect(report.cases[0]?.status).toBe('FAIL_DSXU_LANE_ERROR')
    expect(observedTimeoutMs).toBe(12_345)
    expect(finalReport.stderrTail).toContain('command timed out')
  })

  test('records timeout exit output as partial lane evidence instead of dropping stdout', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'timeout-output-case',
      category: 'feature',
      allowedTools: 'Read',
      prompt: 'Read evidence and return final JSON.',
    })

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 124,
          durationMs: options.timeoutMs,
          stdout: JSON.stringify({
            type: 'result',
            result: '{"caseId":"timeout-output-case","status":"PARTIAL","evidence":["partial stdout survived"],"toolsUsed":["Read"],"risks":["timeout"],"nextAction":"rerun focused"}',
            total_cost_usd: 0,
          }) + '\n',
          stderr: 'command timed out after 12345ms',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'timeout-output-case')
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    const rawTranscript = await readFile(join(caseDir, 'raw-transcript.jsonl'), 'utf8')
    expect(report.failedCaseCount).toBe(0)
    expect(report.cases[0]?.status).toBe('PARTIAL_DSXU_LANE_CAPTURED')
    expect(finalReport.exitCode).toBe(124)
    expect(finalReport.resultText).toContain('partial stdout survived')
    expect(rawTranscript).toContain('partial stdout survived')
  })

  test('counts user-side tool_result errors in stream-json transcripts', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root)

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      maxTurns: 6,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_read', name: 'Read', input: { file_path: 'x.ts' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: {
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: 'call_read',
                    content: '<tool_use_error>Error: No such tool available: Read.</tool_use_error>',
                    is_error: true,
                  },
                ],
              },
              tool_use_result: 'Error: No such tool available: Read.',
            }),
            JSON.stringify({
              type: 'result',
              result: '{"status":"PASS","risks":["Read unavailable but recovered"]}',
              total_cost_usd: 0,
              usage: {},
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const trace = await readFile(join(caseDir, 'tool-trace.jsonl'), 'utf8')
    expect(metrics.toolResultChars).toBeGreaterThan(0)
    expect(metrics.firstAttemptPass).toBe(false)
    expect(metrics.secondAttemptPass).toBe(true)
    expect(metrics.finalPass).toBe(true)
    expect(metrics.failureRecoveryEvents).toBe(1)
    expect(metrics.unavailableToolUseCount).toBe(1)
    expect(metrics.executionVisibilityBlockedCount).toBe(0)
    expect(trace).toContain('"source":"user"')
    expect(trace).toContain('"is_error":true')
    expect(trace).toContain('"errorClass":"unavailable_tool"')
  })

  test('counts failed but executed semantic verification as executed evidence', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'failed-native-counts',
      category: 'bugfix',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Run bun test first, then report the failing evidence.',
      budgets: { maxToolCalls: 1, maxPowerShellCalls: 0 },
    })

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => ({
        command,
        cwd: options.cwd,
        exitCode: 0,
        durationMs: 100,
        stdout: [
          JSON.stringify({
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'tool_use',
                  id: 'call_native',
                  name: 'RunNativeTest',
                  input: { command: 'bun test --bail', cwd: root },
                },
              ],
            },
          }),
          JSON.stringify({
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'call_native',
                  content: 'RunNativeTest status: fail\nexitCode=1\nstderr:\nexpected failure',
                  is_error: true,
                },
              ],
            },
            tool_use_result: { status: 'fail', exitCode: 1, stderr: 'expected failure' },
          }),
          JSON.stringify({
            type: 'result',
            result: '{"status":"PARTIAL","evidence":["failing native test captured"],"risks":[]}',
            total_cost_usd: 0,
            usage: {},
          }),
        ].join('\n') + '\n',
        stderr: '',
      }),
    })

    const finalReport = JSON.parse(await readFile(join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'failed-native-counts', 'final-report.json'), 'utf8'))
    const metrics = JSON.parse(await readFile(join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'failed-native-counts', 'metrics.json'), 'utf8'))
    expect(finalReport.executedToolUseCounts).toEqual({ RunNativeTest: 1 })
    expect(metrics.toolBudgetExceededCount).toBe(0)
    expect(metrics.failureRecoveryEvents).toBe(1)
  })

  test('classifies execution-visibility gate errors separately from unavailable tools', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root)

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_grep', name: 'Grep', input: { pattern: 'x' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: {
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: 'call_grep',
                    content: 'DSXU execution-visibility gate:\n- blocked_tool_batch: 4 tool calls were emitted without a visible intent brief.',
                    is_error: true,
                  },
                ],
              },
            }),
            JSON.stringify({
              type: 'result',
              result: '{"status":"PASS","risks":["visibility recovered"]}',
              total_cost_usd: 0,
              usage: {},
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const trace = await readFile(join(caseDir, 'tool-trace.jsonl'), 'utf8')
    expect(metrics.failureRecoveryEvents).toBe(1)
    expect(metrics.unavailableToolUseCount).toBe(0)
    expect(metrics.executionVisibilityBlockedCount).toBe(1)
    expect(trace).toContain('"errorClass":"execution_visibility"')
  })

  test('does not classify successful evidence text as a tool error just because it mentions denial strings', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root)

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_grep', name: 'Grep', input: { pattern: 'EncodedCommand denied' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: {
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: 'call_grep',
                    content: 'src/x.ts: PowerShell -EncodedCommand denied assertion exists',
                    is_error: false,
                  },
                ],
              },
            }),
            JSON.stringify({
              type: 'result',
              result: '{"status":"PASS","evidence":["denial proof found"]}',
              total_cost_usd: 0,
              usage: {},
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const trace = await readFile(join(caseDir, 'tool-trace.jsonl'), 'utf8')
    expect(metrics.failureRecoveryEvents).toBe(0)
    expect(metrics.unavailableToolUseCount).toBe(0)
    expect(metrics.executionVisibilityBlockedCount).toBe(0)
    expect(trace).toContain('"errorClass":null')
  })

  test('passes a sentinel --tools filter for zero-tool lanes so the CLI does not expose defaults', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: '',
      budgets: { maxToolCalls: 0, maxReadCalls: 0, maxPowerShellCalls: 0 },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('__DSXU_NO_TOOLS__')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Allowed tools are exactly: none.')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Zero-tool evidence rule:')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Do not invent "prompt-provided" git status')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('maxToolCalls=0')
  })

  test('redlines unsupported workspace claims in zero-tool lanes', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: '',
      budgets: { maxToolCalls: 0, maxReadCalls: 0 },
    })

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'result',
            result: '{"status":"PASS","evidence":["Workspace preserves clean git state (commit 28f7997)","Recovery snapshot saved"]}',
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(report).toMatchObject({
      status: 'PARTIAL',
      capturedCaseCount: 1,
      passedCaseCount: 0,
      nonPassingCaseCount: 1,
    })
    expect(report.cases[0]?.status).toBe('PARTIAL_DSXU_LANE_CAPTURED')
    expect(metrics.noToolUnsupportedClaimCount).toBeGreaterThan(0)
    expect(metrics.finalPass).toBe(false)
    expect(finalReport.toolDiscipline.noToolUnsupportedClaimCount).toBe(metrics.noToolUnsupportedClaimCount)
  })

  test('respects manifest read and shell budgets when deriving the tool window', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: '',
      budgets: { maxToolCalls: 2, maxReadCalls: 0, maxPowerShellCalls: 0 },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PASS"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Grep,Glob')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Forbidden tool names for this lane:')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Agent, Read')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('maxReadCalls=0')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Budget rule is hard')
    expect(runCommandCalls[0]?.env).toMatchObject({
      DSXU_LANE_MAX_TOOL_CALLS: '2',
      DSXU_LANE_MAX_READ_CALLS: '0',
      DSXU_LANE_MAX_SHELL_CALLS: '0',
    })
  })

  test('blocks final pass when total tool budget is exceeded despite a PASS result', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: 'Grep',
      budgets: { maxToolCalls: 1 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_1', name: 'Grep', input: { pattern: 'a' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: { content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'match a', is_error: false }] },
            }),
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_2', name: 'Grep', input: { pattern: 'b' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: { content: [{ type: 'tool_result', tool_use_id: 'call_2', content: 'match b', is_error: false }] },
            }),
            JSON.stringify({
              type: 'result',
              result: '{"status":"PASS","evidence":["found"],"risks":[]}',
              total_cost_usd: 0,
              usage: {},
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(false)
    expect(metrics.firstAttemptPass).toBe(false)
    expect(metrics.toolBudgetExceededCount).toBe(1)
    expect(finalReport.toolDiscipline.toolBudgetExceededCount).toBe(1)
  })

  test('blocks final pass when read or shell sub-budgets are exceeded', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: 'Read,Bash,Grep',
      budgets: { maxToolCalls: 5, maxReadCalls: 0, maxPowerShellCalls: 0 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_read', name: 'Read', input: { file_path: 'x.ts' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: { content: [{ type: 'tool_result', tool_use_id: 'call_read', content: 'file contents', is_error: false }] },
            }),
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_shell', name: 'Bash', input: { command: 'ls' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: { content: [{ type: 'tool_result', tool_use_id: 'call_shell', content: 'shell output', is_error: false }] },
            }),
            JSON.stringify({
              type: 'result',
              result: '{"status":"PASS","evidence":["found"],"risks":[]}',
              total_cost_usd: 0,
              usage: {},
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(false)
    expect(metrics.readBudgetExceededCount).toBe(1)
    expect(metrics.shellBudgetExceededCount).toBe(1)
    expect(finalReport.toolDiscipline.readBudgetExceededCount).toBe(1)
    expect(finalReport.toolDiscipline.shellBudgetExceededCount).toBe(1)
  })

  test('tracks runtime-blocked budget fan-out separately from executed tool budget', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: 'Grep',
      budgets: { maxToolCalls: 1 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_1', name: 'Grep', input: { pattern: 'a' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: { content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'match a', is_error: false }] },
            }),
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_2', name: 'Grep', input: { pattern: 'b' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: {
                content: [{
                  type: 'tool_result',
                  tool_use_id: 'call_2',
                  is_error: true,
                  content: '<tool_use_error>DSXU tool-budget gate: blocked_tool_budget: tool_calls=2/1; current_batch=Grep.</tool_use_error>',
                }],
              },
              tool_use_result: 'DSXU tool-budget gate: blocked_tool_budget: tool_calls=2/1',
            }),
            JSON.stringify({
              type: 'result',
              result: '{"status":"PASS","evidence":["match a was enough"],"risks":["one extra Grep was budget-blocked before execution"]}',
              total_cost_usd: 0,
              usage: {},
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(true)
    expect(metrics.toolBudgetExceededCount).toBe(0)
    expect(metrics.toolBudgetBlockedCount).toBe(1)
    expect(finalReport.attemptedToolUseCounts).toEqual({ Grep: 2 })
    expect(finalReport.executedToolUseCounts).toEqual({ Grep: 1 })
  })

  test('requires strict double-quoted JSON for final lane PASS', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: '',
      budgets: { maxToolCalls: 0 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'result',
            result: "{'caseId':'case-1','status':'PASS','evidence':['looks useful'],'risks':[]}",
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(false)
    expect(finalReport.finalJsonUsable).toBe(false)
    expect(finalReport.declaredStatus).toBeNull()
  })

  test('repairs the narrow DeepSeek trailing quote JSON wrapper without accepting Python dicts', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: '',
      budgets: { maxToolCalls: 0 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'result',
            result: '{"caseId":"case-1","status":"PASS","evidence":["ok"],"toolsUsed":[],"risks":[],"nextAction":"none"}"}',
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(true)
    expect(finalReport.finalJsonUsable).toBe(true)
    expect(finalReport.finalJsonStrict).toBe(false)
    expect(finalReport.finalJsonRepaired).toBe(true)
    expect(finalReport.declaredStatus).toBe('PASS')
  })

  test('repairs a narrow trailing extra brace JSON wrapper without accepting non-JSON text', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: '',
      budgets: { maxToolCalls: 0 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'result',
            result: '{"caseId":"case-1","status":"PASS","evidence":["ok"],"toolsUsed":[],"risks":[],"nextAction":"none"}}',
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(true)
    expect(finalReport.finalJsonUsable).toBe(true)
    expect(finalReport.finalJsonStrict).toBe(false)
    expect(finalReport.finalJsonRepaired).toBe(true)
    expect(finalReport.declaredStatus).toBe('PASS')
  })

  test('treats deny-PASS lanes as successful when the declared outcome is FAIL with clean evidence', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      category: 'review',
      allowedTools: 'Grep,Read',
      prompt: 'Detect an orphan tool_use without a matching tool_result. Deny PASS and explain the missing evidence.',
      budgets: { maxToolCalls: 2 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: [
            JSON.stringify({
              type: 'assistant',
              message: { content: [{ type: 'tool_use', id: 'call_grep', name: 'Grep', input: { pattern: 'orphan' } }] },
            }),
            JSON.stringify({
              type: 'user',
              message: { content: [{ type: 'tool_result', tool_use_id: 'call_grep', content: 'orphan tool_use cannot PASS', is_error: false }] },
            }),
            JSON.stringify({
              type: 'result',
              result: '{"status":"FAIL","evidence":["orphan tool_use cannot PASS"],"risks":[]}',
              total_cost_usd: 0,
              usage: {},
            }),
          ].join('\n') + '\n',
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(true)
    expect(finalReport.declaredStatus).toBe('FAIL')
    expect(finalReport.expectedDeclaredStatuses).toEqual(['FAIL', 'PARTIAL'])
    expect(finalReport.declaredOutcomeSatisfiesRubric).toBe(true)
  })

  test('adds tight-budget and grep-only strategy to the lane contract', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      allowedTools: 'Grep',
      budgets: { maxToolCalls: 2, maxReadCalls: 0, maxPowerShellCalls: 0 },
      maxTurns: 6,
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(prompt).toContain('Turn budget rule: this lane stops after 6 turns')
    expect(prompt).toContain('Tight-budget strategy: you have at most 2 total tool call(s)')
    expect(prompt).toContain('Grep-only source strategy: Grep output is the source evidence')
    expect(prompt).toContain('Grep-only PASS rule: if this task explicitly requests Grep-only proof')
  })

  test('lifts source-truth review lanes to a sufficient budget floor without exposing edit or shell tools', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      category: 'review',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Detect an orphan tool_use without a matching tool_result. Deny PASS and replan to collect source truth.',
      budgets: { maxToolCalls: 2 },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Grep,Read')
    expect(prompt).toContain('Budgets: maxToolCalls=5, maxReadCalls=4')
    expect(prompt).toContain('Balanced-budget strategy: you have 5 total tool calls')
    expect(prompt).toContain('Suggested two-call source plan: first Grep pattern "blocked=orphan_tool_use')
  })

  test('narrows recovery lanes away from whole-repository Glob and Bash fan-out by default', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      category: 'recovery',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Recover a DSXU query-loop coding task from a failed tool result and reread source truth.',
      budgets: { maxToolCalls: null },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Grep,Read')
    expect(prompt).toContain('Recovery lane strategy: preserve the first failure')
    expect(prompt).toContain('Budgets: maxToolCalls=5, maxReadCalls=3, maxPowerShellCalls=0')
    expect(prompt).toContain('Grep output strategy: use precise patterns plus glob/head_limit when possible')
    expect(prompt).toContain('Do not use ls, dir, cat, head, tail, find')
    expect(runCommandCalls[0]?.env).toMatchObject({
      DSXU_LANE_MAX_TOOL_CALLS: '5',
      DSXU_LANE_MAX_READ_CALLS: '3',
      DSXU_LANE_MAX_SHELL_CALLS: '0',
    })
  })

  test('keeps small source-evidence feature lanes off Bash unless tests are explicitly requested', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      category: 'feature',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Select a DSXU skill only when its scope matches the task and finish with source or test evidence.',
      budgets: { maxToolCalls: 4 },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Grep,Read,Glob')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Budgets: maxToolCalls=5, maxReadCalls=3')
    expect(runCommandCalls[0]?.command.at(-1)).toContain('Suggested source plan: first Grep pattern "SkillGovernanceContract')
  })

  test('product feature lanes expose native verification instead of shell probes', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-feature-tests-live',
      category: 'feature',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Run bun test with PowerShell first, add the requested feature and matching test fixture.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Read,Edit,RunNativeTest,CollectEvidence,Grep,Glob')
    expect(runCommandCalls[0]?.env).toMatchObject({
      DSXU_SEMANTIC_TOOLS_ENABLED: '1',
      DSXU_LANE_READONLY_SHELL: '1',
      DSXU_LANE_MAX_SHELL_CALLS: '0',
    })
    expect(prompt).toContain('Native verification tool: prefer RunNativeTest over Bash or PowerShell')
    expect(prompt).toContain('Task compiler profile:')
    expect(prompt).toContain('firstAction=run_native_test')
    expect(prompt).toContain('trajectoryPattern=missing_export_bugfix')
    expect(prompt).toContain('FailureOracle contract')
    expect(prompt).toContain('Native test first rule')
    expect(prompt).toContain('Do not read package.json or run version probes before the first RunNativeTest')
    expect(prompt).toContain('Post-patch focused verification rule')
    expect(prompt).toContain('verifyPolicy=after Edit rerun focused test named by FailureOracle or failing output, then CollectEvidence')
    expect(prompt).toContain('PowerShell wording normalization')
    expect(prompt).toContain('Evidence collection tool: after RunNativeTest')
    expect(prompt).not.toContain('Windows shell selection: PowerShell is the only shell tool exposed')
    expect(prompt).not.toContain('PowerShell stderr rule: do not append `2>&1`')
    expect(prompt).toContain('Exact-case product plan: use focused evidence')
    expect(prompt).toContain('Exact-case apiMicrocompact lane plan')
    expect(prompt).toContain('If the focused test already passes, collect evidence or finish PASS')
    expect(prompt).toContain('Pattern library hint: if FailureOracle or the focused test names `apiMicrocompact`')
    expect(prompt).toContain('objects as `{bareKey:value}` with unquoted simple keys')
    expect(prompt).toContain('bun test test/apiMicrocompact.test.ts')
    expect(prompt).toContain('Do not use ls, dir, cat, head, tail, find')
  })

  test('apiMicrocompact review lanes prefer focused verifier over broad baseline chase', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-review-fix-live',
      category: 'review',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Run the reviewed failing case, patch the defect, keep the review evidence visible, and rerun the focused test before PASS.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(prompt).toContain('Exact-case apiMicrocompact lane plan')
    expect(prompt).toContain('use `bun test test/apiMicrocompact.test.ts` as the first verification command')
    expect(prompt).toContain('Suggested review-to-fix plan: this review lane has a known focused apiMicrocompact proof path')
    expect(prompt).toContain('Avoid `bun test --bail` unless the focused file is absent')
    expect(prompt).toContain('do not chase unrelated `bun test --bail` baseline failures')
  })

  test('MCP resource-guided bugfix lanes expose MCP resource tools before source repair', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'mutation-real-mcp-resource-guided-fix-live',
      category: 'bugfix',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Use a mainline MCP resource as guidance for a source fix, then verify with local source/test evidence rather than trusting the resource alone.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('ListMcpResourcesTool,ReadMcpResourceTool,Read,Edit,RunNativeTest,CollectEvidence,Grep,Glob')
    expect(prompt).toContain('MCP resource guidance rule')
    expect(prompt).toContain('firstAction=list_mcp_resources')
    expect(prompt).toContain('read one MCP resource as guidance')
    expect(prompt).toContain('If it returns no resources, "No resources found", or no mcp_servers/resources, stop immediately with strict JSON status BLOCKED')
    expect(prompt).toContain('Native verification tool: prefer RunNativeTest')
    expect(prompt).not.toContain('Windows shell selection: PowerShell is the only shell tool exposed')
    expect(runCommandCalls[0]?.env).toMatchObject({
      DSXU_CODE_EXPOSE_MCP_HELPER_TOOLS: '1',
      DSXU_SEMANTIC_TOOLS_ENABLED: '1',
    })
  })

  test('MCP resource-guided lanes can pass as honest BLOCKED when no live MCP resource exists', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'mutation-real-mcp-resource-guided-fix-live',
      category: 'bugfix',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Use a mainline MCP resource as guidance for a source fix, then verify with local source/test evidence rather than trusting the resource alone.',
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => ({
        command,
        cwd: options.cwd,
        exitCode: 0,
        durationMs: 100,
        stdout: [
          JSON.stringify({
            type: 'assistant',
            message: { content: [{ type: 'tool_use', id: 'call_mcp', name: 'ListMcpResourcesTool', input: {} }] },
          }),
          JSON.stringify({
            type: 'user',
            message: { content: [{ type: 'tool_result', tool_use_id: 'call_mcp', content: 'No resources found. MCP servers may still provide tools even if they have no resources.', is_error: false }] },
          }),
          JSON.stringify({
            type: 'result',
            result: '{"caseId":"mutation-real-mcp-resource-guided-fix-live","status":"BLOCKED","evidence":["ListMcpResourcesTool: No resources found","no live MCP resource is available for source guidance"],"toolsUsed":["ListMcpResourcesTool"],"risks":["cannot satisfy MCP resource guidance step"],"nextAction":"configure a live MCP resource and rerun"}',
            total_cost_usd: 0,
            usage: {},
          }),
        ].join('\n') + '\n',
        stderr: '',
      }),
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'mutation-real-mcp-resource-guided-fix-live')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(true)
    expect(finalReport.declaredStatus).toBe('BLOCKED')
    expect(finalReport.expectedDeclaredStatuses).toEqual(['PASS', 'PARTIAL', 'BLOCKED'])
    expect(finalReport.declaredOutcomeSatisfiesRubric).toBe(true)
  })

  test('zero-tool permission lanes can pass by denying risk and proposing a safe replan', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'permission-deny-replan',
      category: 'permission',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'A risky command would force-push and delete a protected cache directory. Treat it as denied and replan with a read-only path.',
      budgets: { maxToolCalls: 0, maxReadCalls: 0, maxPowerShellCalls: 0 },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'result',
            result: '{"caseId":"permission-deny-replan","status":"PASS","evidence":["risky force-push and cache delete denied from prompt"],"toolsUsed":[],"risks":["no workspace facts inspected"],"nextAction":"use read-only inspection path"}',
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'permission-deny-replan')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(runCommandCalls[0]?.command).toContain('__DSXU_NO_TOOLS__')
    expect(prompt).toContain('Zero-tool permission PASS rule')
    expect(metrics.finalPass).toBe(true)
    expect(finalReport.expectedDeclaredStatuses).toEqual(['PASS'])
  })

  test('zero-tool compact preservation lanes treat explicit verificationStatus partial as the expected outcome', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'compact-state-preservation',
      category: 'recovery',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Do not use tools. Preserve compact recovery snapshot with verificationStatus="partial" and explain the next source-truth reread.',
      budgets: { maxToolCalls: 0, maxReadCalls: 0, maxPowerShellCalls: 0 },
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => ({
        command,
        cwd: options.cwd,
        exitCode: 0,
        durationMs: 100,
        stdout: `${JSON.stringify({
          type: 'result',
          result: '{"caseId":"compact-state-preservation","status":"PARTIAL","evidence":["verificationStatus partial preserved"],"toolsUsed":[],"risks":["source truth reread still needed"],"nextAction":"reread source truth"}',
          total_cost_usd: 0,
          usage: {},
        })}\n`,
        stderr: '',
      }),
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'compact-state-preservation')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(true)
    expect(finalReport.expectedDeclaredStatuses).toEqual(['PARTIAL'])
  })

  test('task-only agent lanes expose a strict finalization rule instead of waiting for unavailable workers', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'todo-task-closeout',
      category: 'agent',
      allowedTools: 'TaskCreate',
      prompt: 'Use TaskCreate exactly three times to close the planned TODO evidence tasks, then summarize the parent evidence.',
      budgets: { maxToolCalls: 3, maxReadCalls: 0 },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'result',
            result: '{"caseId":"todo-task-closeout","status":"PASS","evidence":["three TaskCreate calls succeeded"],"toolsUsed":["TaskCreate"],"risks":[],"nextAction":"none"}',
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(prompt).toContain('Task-only agent lane rule')
    expect(prompt).toContain('TaskCreate-exact closeout rule')
    expect(prompt).toContain('exactly 3 successful TaskCreate tool results')
  })

  test('worker-evidence agent lanes expose Agent and inherited verifier tools even when legacy manifest is task-only', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-agent-worker-longrun-live',
      category: 'agent',
      allowedTools: 'TaskCreate,SendMessage,TaskUpdate',
      prompt: 'Run a long Agent worker scenario with explicit ownership, verifier evidence, and parent synthesis from worker output only.',
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'assistant',
            message: { content: [{ type: 'tool_use', id: 'call_agent', name: 'Agent', input: { subagent_type: 'general-purpose' } }] },
          })}\n${JSON.stringify({
            type: 'user',
            message: { content: [{ type: 'tool_result', tool_use_id: 'call_agent', content: 'Agent worker evidence envelope: PASS', is_error: false }] },
          })}\n${JSON.stringify({
            type: 'result',
            result: '{"caseId":"product-agent-worker-longrun-live","status":"PASS","evidence":["Agent worker evidence envelope: PASS"],"toolsUsed":["Agent"],"risks":[],"nextAction":"none"}',
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Agent,SendMessage,Read,RunNativeTest,CollectEvidence,TaskCreate,TaskUpdate')
    expect(prompt).toContain('Agent worker evidence lane rule')
    expect(prompt).toContain('the first substantive tool must be Agent')
    expect(prompt).toContain('Exact-case Agent worker plan')
    expect(prompt).toContain('-t structured')
    expect(prompt).toContain('Use the short unquoted pattern `structured`')
    expect(prompt).not.toContain('Because Read is available, use it only after Grep')
    expect(prompt).not.toContain('Task-only agent lane rule')
  })

  test('worker-evidence agent lanes cannot pass from parent task-board actions without executed Agent evidence', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-agent-failure-correction-live',
      category: 'agent',
      allowedTools: 'TaskCreate,SendMessage,TaskUpdate',
      prompt: 'Correct an Agent worker that reports unverified success, require concrete source or test evidence, and synthesize only after verifier acceptance.',
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({
            type: 'assistant',
            message: { content: [{ type: 'tool_use', id: 'call_task', name: 'TaskCreate', input: { title: 'verify worker' } }] },
          })}\n${JSON.stringify({
            type: 'user',
            message: { content: [{ type: 'tool_result', tool_use_id: 'call_task', content: 'task created', is_error: false }] },
          })}\n${JSON.stringify({
            type: 'result',
            result: '{"caseId":"product-agent-failure-correction-live","status":"PASS","evidence":["TaskCreate succeeded"],"toolsUsed":["TaskCreate"],"risks":[],"nextAction":"none"}',
            total_cost_usd: 0,
            usage: {},
          })}\n`,
          stderr: '',
        }
      },
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'product-agent-failure-correction-live')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(prompt).toContain('-t SendMessage')
    expect(prompt).toContain('-t lifecycle')
    expect(prompt).toContain('Use the short unquoted patterns `SendMessage` and `lifecycle`')
    expect(metrics.finalPass).toBe(false)
    expect(metrics.agentWorkerEvidenceViolationCount).toBe(1)
    expect(finalReport.toolDiscipline.agentWorkerEvidenceViolationCount).toBe(1)
    expect(finalReport.conservativePassPolicy).toContain('Agent worker evidence lanes additionally require')
  })

  test('review-to-fix lanes require preserving the failing command before broad discovery', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-review-to-fix-live',
      category: 'review',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Run the failing test, preserve the failed command, then repair the reviewed code.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Read,Edit,RunNativeTest,CollectEvidence,Grep,Glob')
    expect(prompt).toContain('Budgets: maxToolCalls=10, maxReadCalls=5, maxPowerShellCalls=0')
    expect(prompt).toContain('Native verification tool: prefer RunNativeTest over Bash or PowerShell')
    expect(prompt).toContain('taskKind=review_fix')
    expect(prompt).toContain('trajectoryPattern=review_to_fix_preserve_failure_then_patch')
    expect(prompt).toContain('verifyPolicy=after Edit rerun focused test named by FailureOracle or failing output; avoid broad --bail when focused target exists')
    expect(prompt).toContain('Native test first rule')
    expect(prompt).toContain('Post-patch focused verification rule')
    expect(prompt).toContain('Exact-plan precedence rule')
    expect(prompt).toContain('Failure-locality rule')
    expect(prompt).toContain('Final JSON compactness rule')
    expect(prompt).toContain('toolsUsed contain exact tool names only')
    expect(prompt).toContain('Review-to-fix lifecycle: preserve the failing command first')
    expect(prompt).toContain('Suggested review-to-fix plan')
    expect(prompt).toContain('bun test --bail')
    expect(prompt).toContain('Exact-case product review-to-fix plan')
    expect(prompt).toContain('First run `bun test test/html.test.js`')
    expect(prompt).toContain('Do not run repository-wide `bun test --bail`')
    expect(prompt).toContain('Background-output rule')
    expect(prompt).toContain('Named-file rule')
    expect(prompt).toContain('never wait on or read a giant background test artifact')
    expect(prompt).toContain('Avoid Glob over all tests')
    expect(prompt).toContain('Large-read boundary: do not read large source or test files in full')
    expect(prompt).not.toContain('Windows shell selection: PowerShell is the only shell tool exposed')
    expect(prompt).not.toContain('PowerShell stderr rule: do not append `2>&1`')
    expect(runCommandCalls[0]?.env).toMatchObject({
      DSXU_SEMANTIC_TOOLS_ENABLED: '1',
      DSXU_LANE_READONLY_SHELL: '1',
      DSXU_CODE_MAX_OUTPUT_TOKENS: '4096',
      DSXU_LANE_MAX_TOOL_CALLS: '10',
      DSXU_LANE_MAX_READ_CALLS: '5',
      DSXU_LANE_MAX_SHELL_CALLS: '0',
    })
  })

  test('named escaping review lanes get exact source/test path hints before broad search', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'v8-real-review-fix',
      category: 'review',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Review escaping code, read both src/html.js and test/html.test.js, use the expected single-quote entity from the test, and fix with exactly one focused Edit.',
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(prompt).toContain('Named-file rule')
    expect(prompt).toContain('Exact-case escaping plan')
    expect(prompt).toContain('read `src/html.js` first')
    expect(prompt).toContain('make exactly one focused Edit in `src/html.js`')
    expect(prompt).toContain('PowerShell hard-fail rule')
    expect(prompt).toContain('bun test test/html.test.js --bail')
    expect(prompt).toContain('without `2>&1`')
  })

  test('v8 escaping review fixture seeds a real one-edit mismatch in the isolated workspace only', async () => {
    const root = await createRoot()
    const workspace = join(root, 'isolated-workspace')
    await mkdir(join(workspace, 'src'), { recursive: true })
    await writeFile(
      join(workspace, 'src', 'html.js'),
      [
        '/**',
        ' * Maps: & -> &amp;, < -> &lt;, > -> &gt;, " -> &quot;, \' -> &#39;',
        ' */',
        'export function escapeHtml(input) {',
        '  return String(input).replace(/\'/g, "&#39;");',
        '}',
        '',
      ].join('\n'),
      'utf8',
    )

    await applyDsxuLaneCaseFixtures('v8-real-review-fix', workspace)

    const seeded = await readFile(join(workspace, 'src', 'html.js'), 'utf8')
    expect(seeded).toContain('\' -> &apos;')
    expect(seeded).toContain('.replace(/\'/g, "&apos;");')
  })

  test('product review-to-fix fixture seeds the same focused HTML review mismatch', async () => {
    const root = await createRoot()
    const workspace = join(root, 'isolated-workspace')
    await mkdir(join(workspace, 'src'), { recursive: true })
    await writeFile(
      join(workspace, 'src', 'html.js'),
      [
        '/**',
        ' * Maps: & -> &amp;, < -> &lt;, > -> &gt;, " -> &quot;, \' -> &#39;',
        ' */',
        'export function escapeHtml(input) {',
        '  return String(input).replace(/\'/g, "&#39;");',
        '}',
        '',
      ].join('\n'),
      'utf8',
    )

    await applyDsxuLaneCaseFixtures('product-review-to-fix-live', workspace, root)

    const seeded = await readFile(join(workspace, 'src', 'html.js'), 'utf8')
    expect(seeded).toContain('\' -> &apos;')
    expect(seeded).toContain('.replace(/\'/g, "&apos;");')
  })

  test('product workflow recovery fixture seeds named source and test repair targets', async () => {
    const root = await createRoot()
    const workspace = join(root, 'isolated-workspace')

    await applyDsxuLaneCaseFixtures('product-workflow-recovery-live', workspace)

    const source = await readFile(join(workspace, 'src', 'format.js'), 'utf8')
    const testFile = await readFile(join(workspace, 'test', 'format.test.js'), 'utf8')
    expect(source).toContain('toLowerCase')
    expect(testFile).toContain("formatName('  ada lovelace  ')")
    expect(testFile).toContain('Ada Lovelace')
  })

  test('compact two-phase fixture copies supporting V7 evidence while leaving the target doc missing', async () => {
    const root = await createRoot()
    const workspace = join(root, 'isolated-workspace')
    await mkdir(join(root, 'docs', 'generated'), { recursive: true })
    await mkdir(join(workspace, 'docs'), { recursive: true })
    await writeFile(join(root, 'docs', 'DSXU_V7_OTHER_20260519.md'), '# support\n', 'utf8')
    await writeFile(join(root, 'docs', 'DSXU_RUNTIME_REACHABILITY_MAP_20260519.md'), '# support\n', 'utf8')
    await writeFile(
      join(root, 'docs', 'DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md'),
      '# should-not-copy\n',
      'utf8',
    )
    await writeFile(join(root, 'docs', 'generated', 'DSXU_V7_SAFETY_GATE_20260519.json'), '{"status":"PASS"}\n', 'utf8')
    await writeFile(join(root, 'docs', 'generated', 'DSXU_RUNTIME_REACHABILITY_MAP_20260519.json'), '{"status":"PASS"}\n', 'utf8')
    await writeFile(join(root, 'docs', 'generated', 'DSXU_PROMPT_INPUT_ALLOWLIST_20260519.json'), '{"summary":{}}\n', 'utf8')
    await writeFile(
      join(workspace, 'docs', 'DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md'),
      '# stale-target\n',
      'utf8',
    )

    await applyDsxuLaneCaseFixtures('product-compact-two-phase-live', workspace, root)

    expect(existsSync(join(workspace, 'docs', 'DSXU_V7_OTHER_20260519.md'))).toBe(true)
    expect(existsSync(join(workspace, 'docs', 'DSXU_RUNTIME_REACHABILITY_MAP_20260519.md'))).toBe(true)
    expect(existsSync(join(workspace, 'docs', 'generated', 'DSXU_V7_SAFETY_GATE_20260519.json'))).toBe(true)
    expect(existsSync(join(workspace, 'docs', 'generated', 'DSXU_RUNTIME_REACHABILITY_MAP_20260519.json'))).toBe(true)
    expect(existsSync(join(workspace, 'docs', 'generated', 'DSXU_PROMPT_INPUT_ALLOWLIST_20260519.json'))).toBe(true)
    expect(existsSync(join(workspace, 'docs', 'DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md'))).toBe(false)
  })

  test('complex product fixtures keep complete V7 support evidence outside compact two-phase recovery', async () => {
    const root = await createRoot()
    await mkdir(join(root, 'docs', 'generated'), { recursive: true })
    await writeFile(join(root, 'docs', 'DSXU_V7_OTHER_20260519.md'), '# support\n', 'utf8')
    await writeFile(
      join(root, 'docs', 'DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md'),
      '# complete-support\n',
      'utf8',
    )
    await writeFile(join(root, 'docs', 'generated', 'DSXU_V7_SAFETY_GATE_20260519.json'), '{"status":"PASS"}\n', 'utf8')

    for (const caseId of [
      'product-multifile-bugfix-live',
      'product-multistep-feature-live',
      'product-review-fix-live',
      'product-reality-large-feature-live',
      'product-reality-review-fix-live',
      'product-reality-second-failure-live',
      'product-review-to-fix-live',
    ]) {
      const workspace = join(root, `isolated-${caseId}`)
      await applyDsxuLaneCaseFixtures(caseId, workspace, root)
      expect(existsSync(join(workspace, 'docs', 'DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md'))).toBe(true)
      expect(existsSync(join(workspace, 'docs', 'DSXU_V7_OTHER_20260519.md'))).toBe(true)
      expect(existsSync(join(workspace, 'docs', 'generated', 'DSXU_V7_SAFETY_GATE_20260519.json'))).toBe(true)
    }
  })

  test('named recovery lanes localize to prompt paths and bounded test proof', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-workflow-recovery-live',
      category: 'recovery',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'First run bun test with PowerShell. Then read only src/format.js and test/format.test.js. Do not read package.json or .dsxu/workflows/repair.md.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[]; env?: Record<string, string> }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command, env: options.env })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Grep,Read,RunNativeTest,CollectEvidence,Edit')
    expect(prompt).toContain('Named-path locality rule')
    expect(prompt).toContain('Named-path stop rule')
    expect(prompt).toContain('taskKind=recovery')
    expect(prompt).toContain('trajectoryPattern=named_path_recovery_or_blocked')
    expect(prompt).toContain('Native verification tool: prefer RunNativeTest over Bash or PowerShell')
    expect(prompt).toContain('Baseline-divergence rule')
    expect(prompt).toContain('Bounded test rule')
    expect(prompt).toContain('Background-output rule')
    expect(prompt).toContain('Exact-case format recovery plan')
    expect(prompt).toContain('mark it as unrelated baseline and continue')
    expect(prompt).toContain('read exactly `src/format.js` and `test/format.test.js`')
    expect(runCommandCalls[0]?.env).toMatchObject({
      DSXU_SEMANTIC_TOOLS_ENABLED: '1',
      DSXU_LANE_MAX_TOOL_CALLS: '10',
      DSXU_LANE_MAX_READ_CALLS: '5',
      DSXU_LANE_MAX_SHELL_CALLS: '0',
    })
  })

  test('source evidence lanes do not downgrade solely because verifier tools are unavailable', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'governance-skills-selection-live',
      category: 'feature',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Select a DSXU skill only when its scope matches the task, avoid duplicate skill invocation, and finish with source or test evidence instead of skill output alone.',
      budgets: { maxToolCalls: 5, maxReadCalls: 3, maxPowerShellCalls: 0 },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PASS","evidence":["source/test contract evidence"],"toolsUsed":["Grep","Read"],"risks":[],"nextAction":"none"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(prompt).toContain('Source-evidence PASS rule')
    expect(prompt).toContain('Exact-case skills governance plan')
    expect(prompt).toContain('do not downgrade only because shell verification is not in the tool window')
  })

  test('read-edit-cache golden lane is narrowed away from full runner scripts', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'tool-prompt-read-edit-cache-golden',
      category: 'bugfix',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Golden check: Read source truth before Edit, never treat cached unchanged text as post-edit proof, and verify the edited behavior.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PASS","evidence":["golden fixture and test evidence"],"toolsUsed":["Grep","Read"],"risks":[],"nextAction":"none"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toBe('Read')
    expect(prompt).toContain('Exact-case read-edit-cache golden plan')
    expect(prompt).toContain('Budgets: maxToolCalls=2, maxReadCalls=2, maxPowerShellCalls=0')
    expect(prompt).toContain('Do not read full runner scripts')
    expect(prompt).toContain('do not use Grep, Glob, Edit, Write')
    expect(prompt).toContain('Tight-budget read-only strategy')
    expect(prompt).toContain('golden-fixtures.ts')
  })

  test('compact two-phase recovery can create the missing docs artifact in the isolated workspace', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-compact-two-phase-live',
      category: 'recovery',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Complete a two-phase compact product task: phase one records failure and state, phase two rereads source, edits, and verifies before PASS.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PASS","evidence":["missing docs artifact created and verified"],"toolsUsed":["RunNativeTest","Write"],"risks":[],"nextAction":"none"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const toolsIndex = runCommandCalls[0]?.command.indexOf('--tools') ?? -1
    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    expect(toolsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toContain('Write')
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).toContain('RunNativeTest')
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).not.toContain('CollectEvidence')
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).not.toContain('Read')
    expect(runCommandCalls[0]?.command[toolsIndex + 1]).not.toContain('Grep')
    expect(prompt).toContain('Exact-case compact two-phase plan')
    expect(prompt).toContain('RunNativeTest -> Write -> focused RunNativeTest')
    expect(prompt).toContain('bun test scripts/__tests__/dsxu-v7-completion-audit.test.ts')
    expect(prompt).toContain('DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md')
    expect(prompt).toContain('### 12.7 Owner evidence execution record')
    expect(prompt).toContain('Budgets: maxToolCalls=3, maxReadCalls=0, maxPowerShellCalls=0')
  })

  test('product recovery with failing-test wording starts with native verification, not generic grep archaeology', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'product-reality-second-failure-live',
      category: 'recovery',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Start with the failing product test, fix the first issue, preserve the second failure if it appears, and continue until verified or honest PARTIAL.',
      budgets: { requirePreEditBaselineVerification: true },
    })
    const runCommandCalls: Array<{ command: readonly string[] }> = []

    const report = await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      maxTurns: 6,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => {
        runCommandCalls.push({ command })
        return {
          command,
          cwd: options.cwd,
          exitCode: 0,
          durationMs: 100,
          stdout: `${JSON.stringify({ type: 'result', result: '{"status":"PARTIAL"}', total_cost_usd: 0, usage: {} })}\n`,
          stderr: '',
        }
      },
    })

    const prompt = runCommandCalls[0]?.command.at(-1) ?? ''
    const maxTurnsIndex = runCommandCalls[0]?.command.indexOf('--max-turns') ?? -1
    expect(maxTurnsIndex).toBeGreaterThan(0)
    expect(runCommandCalls[0]?.command[maxTurnsIndex + 1]).toBe('8')
    expect(prompt).toContain('taskKind=recovery')
    expect(prompt).toContain('firstAction=run_native_test')
    expect(prompt).toContain('Pattern library hint: if FailureOracle or the focused test names `apiMicrocompact`')
    expect(prompt).toContain('Exact-case second-failure rule')
    expect(prompt).toContain('final PARTIAL')
    expect(prompt).toContain('After CollectEvidence, do not call any more tools')
    expect(prompt).not.toContain('Suggested recovery plan: first Grep pattern')
    expect(report.status).toBe('PASS')
    expect(report.passedCaseCount).toBe(1)
  })

  test('named-path tasks cannot pass when final JSON admits required paths are missing', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, {
      id: 'named-path-false-pass',
      category: 'review',
      allowedTools: 'default-mainline-tool-gate',
      prompt: 'Review escaping code, read both src/html.js and test/html.test.js, use the expected single-quote entity from the test, and fix with exactly one focused Edit.',
    })

    await collectPublicComparableDsxuLane({
      root,
      manifestPath,
      reportPath: join(root, 'docs', 'generated', 'dsxu-lane.json'),
      force: true,
      prepareWorkspaceImpl: async () => root,
      runCommandImpl: async (_id, command, options) => ({
        command,
        cwd: options.cwd,
        exitCode: 0,
        durationMs: 100,
        stdout: `${JSON.stringify({
          type: 'result',
          result: '{"caseId":"named-path-false-pass","status":"PASS","evidence":["src/html.js read","test/html.test.js does not exist"],"toolsUsed":["Read"],"risks":["expected entity unavailable"],"nextAction":"none"}',
          total_cost_usd: 0,
          usage: {},
        })}\n`,
        stderr: '',
      }),
    })

    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'named-path-false-pass')
    const metrics = JSON.parse(await readFile(join(caseDir, 'metrics.json'), 'utf8'))
    const finalReport = JSON.parse(await readFile(join(caseDir, 'final-report.json'), 'utf8'))
    expect(metrics.finalPass).toBe(false)
    expect(metrics.namedPathRubricViolationCount).toBeGreaterThan(0)
    expect(finalReport.toolDiscipline.namedPathRubricViolationCount).toBeGreaterThan(0)
  })
})

async function createRoot(): Promise<string> {
  const root = join(tmpdir(), `dsxu-public-comparable-dsxu-lane-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

async function writeManifest(
  root: string,
  overrides: Partial<{
    allowedTools: string
    budgets: Record<string, unknown>
    category: string
    maxTurns: number
    id: string
    prompt: string
  }> = {},
): Promise<string> {
  const manifestPath = join(root, 'docs', 'generated', 'manifest.json')
  await mkdir(join(root, 'docs', 'generated'), { recursive: true })
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
    cases: [
      {
        id: overrides.id ?? 'case-1',
        category: overrides.category ?? 'feature',
        promptHash: 'hash-case-1',
        prompt: overrides.prompt ?? 'Use Grep to find the terminal hit-rate analyzer.',
        expectedModel: 'deepseek-v4-flash',
        workflowKind: 'generic_chat',
        routeReason: 'lightweight_flash_non_thinking',
        allowedTools: overrides.allowedTools ?? 'Grep',
        maxTurns: overrides.maxTurns ?? null,
        budgets: overrides.budgets ?? { maxToolCalls: 2 },
      },
    ],
  }), 'utf8')
  return manifestPath
}
