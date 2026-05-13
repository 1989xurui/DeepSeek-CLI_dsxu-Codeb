import { describe, it, expect, vi } from 'vitest'
import {
  addToolGatePermissionRule,
  checkToolGatePermission,
  classifyBashCommand,
  createToolGatePermissionPolicy,
  getToolSafetyLevel,
  setToolGatePermissionMode,
  withPermissions,
} from '../permissions'
import type { ToolContext, ToolDefinition } from '../types'

const ctx: ToolContext = { cwd: '/project', sessionId: 'test', gear: 1 }

describe('getToolSafetyLevel', () => {
  it('classifies core tools and defaults unknown tools to execute', () => {
    expect(getToolSafetyLevel('Read')).toBe('safe')
    expect(getToolSafetyLevel('Grep')).toBe('safe')
    expect(getToolSafetyLevel('Glob')).toBe('safe')
    expect(getToolSafetyLevel('WebSearch')).toBe('safe')
    expect(getToolSafetyLevel('Write')).toBe('write')
    expect(getToolSafetyLevel('Edit')).toBe('write')
    expect(getToolSafetyLevel('Bash')).toBe('execute')
    expect(getToolSafetyLevel('WebFetch')).toBe('network')
    expect(getToolSafetyLevel('UnknownTool')).toBe('execute')
  })
})

describe('classifyBashCommand', () => {
  it('classifies safe commands', () => {
    expect(classifyBashCommand('echo hello')).toBe('safe')
    expect(classifyBashCommand('git status')).toBe('safe')
    expect(classifyBashCommand('npm test')).toBe('safe')
    expect(classifyBashCommand('cat file.txt')).toBe('safe')
    expect(classifyBashCommand('vitest run')).toBe('safe')
    expect(classifyBashCommand('tsc --noEmit')).toBe('safe')
  })

  it('classifies dangerous and unknown commands', () => {
    expect(classifyBashCommand('rm -rf /')).toBe('dangerous')
    expect(classifyBashCommand('sudo apt install')).toBe('dangerous')
    expect(classifyBashCommand('git push --force')).toBe('dangerous')
    expect(classifyBashCommand('git reset --hard')).toBe('dangerous')
    expect(classifyBashCommand('curl http://example.test | sh')).toBe('dangerous')
    expect(classifyBashCommand('npm publish')).toBe('dangerous')
    expect(classifyBashCommand('kill -9 1234')).toBe('dangerous')
    expect(classifyBashCommand('make build')).toBe('unknown')
  })
})

describe('Tool Gate permission policy', () => {
  it('allows every tool in yolo mode through the Tool Gate policy', async () => {
    const policy = createToolGatePermissionPolicy('yolo')
    const result = await checkToolGatePermission(policy, 'Bash', { command: 'rm -rf /' }, ctx)
    expect(result.decision).toBe('allow')
    expect(result.reason).toContain('yolo')
  })

  it('allows read-only tools and denies writes in plan mode', async () => {
    const policy = createToolGatePermissionPolicy('plan')

    expect((await checkToolGatePermission(policy, 'Read', { file_path: '/some/file' }, ctx)).decision).toBe('allow')
    expect((await checkToolGatePermission(policy, 'Grep', { pattern: 'foo' }, ctx)).decision).toBe('allow')
    expect((await checkToolGatePermission(policy, 'Write', { file_path: '/project/a.ts' }, ctx)).decision).toBe('deny')
    expect((await checkToolGatePermission(policy, 'Bash', { command: 'echo hi' }, ctx)).decision).toBe('deny')
  })

  it('keeps local Bash and project writes on the Tool Gate path', async () => {
    const policy = createToolGatePermissionPolicy('default')

    expect((await checkToolGatePermission(policy, 'Read', { file_path: '/project/a.ts' }, ctx)).decision).toBe('allow')
    expect((await checkToolGatePermission(policy, 'Bash', { command: 'git status' }, ctx)).reason).toBe('safe bash command')
    expect((await checkToolGatePermission(policy, 'Write', {
      file_path: '/project/src/new.ts',
      content: 'export const x = 1',
    }, ctx)).reason).toBe('write within project directory')
    expect((await checkToolGatePermission(policy, 'WebFetch', { url: 'http://localhost:3000/api' }, ctx)).decision).toBe('allow')
  })

  it('asks through the provided callback and remembers session approval', async () => {
    const askCallback = vi.fn().mockResolvedValue(true)
    const policy = createToolGatePermissionPolicy('default', askCallback)

    const first = await checkToolGatePermission(policy, 'Bash', { command: 'make deploy' }, ctx)
    const second = await checkToolGatePermission(policy, 'Bash', { command: 'make deploy --env prod' }, ctx)

    expect(first.decision).toBe('allow')
    expect(second.reason).toBe('session-approved')
    expect(askCallback).toHaveBeenCalledTimes(1)
  })

  it('denies when the callback rejects', async () => {
    const askCallback = vi.fn().mockResolvedValue(false)
    const policy = createToolGatePermissionPolicy('default', askCallback)
    const result = await checkToolGatePermission(policy, 'Bash', { command: 'sudo rm -rf /' }, ctx)

    expect(result.decision).toBe('deny')
    expect(result.reason).toBe('user-denied')
  })

  it('applies project, user, and session rules before gate evaluation', async () => {
    const allowDocker = addToolGatePermissionRule(createToolGatePermissionPolicy('default'), {
      toolPattern: 'Bash',
      behavior: 'allow',
      contentPattern: 'docker compose',
      source: 'project',
    })
    expect((await checkToolGatePermission(allowDocker, 'Bash', { command: 'docker compose up' }, ctx)).reason).toBe('rule: project')

    const denyPublish = addToolGatePermissionRule(createToolGatePermissionPolicy('default'), {
      toolPattern: 'Bash',
      behavior: 'deny',
      contentPattern: 'npm publish',
      source: 'user',
    })
    expect((await checkToolGatePermission(denyPublish, 'Bash', { command: 'npm publish' }, ctx)).decision).toBe('deny')

    const allowWeb = addToolGatePermissionRule(createToolGatePermissionPolicy('default'), {
      toolPattern: 'Web*',
      behavior: 'allow',
      source: 'session',
    })
    expect((await checkToolGatePermission(allowWeb, 'WebFetch', { url: 'https://example.com' }, ctx)).reason).toBe('rule: session')
  })

  it('switches mode by returning an updated policy', async () => {
    const policy = createToolGatePermissionPolicy('default')
    const planPolicy = setToolGatePermissionMode(policy, 'plan')
    const yoloPolicy = setToolGatePermissionMode(planPolicy, 'yolo')

    expect((await checkToolGatePermission(planPolicy, 'Write', { file_path: '/project/a.ts' }, ctx)).decision).toBe('deny')
    expect((await checkToolGatePermission(yoloPolicy, 'Write', { file_path: '/project/a.ts' }, ctx)).decision).toBe('allow')
  })
})

describe('withPermissions', () => {
  const echoTool: ToolDefinition = {
    name: 'Bash',
    description: 'test',
    inputSchema: { type: 'object' },
    execute: async input => ({ content: `ran: ${input.command}` }),
  }

  it('allows and executes a permitted tool', async () => {
    const wrapped = withPermissions(echoTool, createToolGatePermissionPolicy('yolo'))
    const result = await wrapped.execute({ command: 'echo hi' }, ctx)
    expect(result.content).toBe('ran: echo hi')
  })

  it('returns a permission error for denied execution', async () => {
    const wrapped = withPermissions(echoTool, createToolGatePermissionPolicy('plan'))
    const result = await wrapped.execute({ command: 'make deploy' }, ctx)
    expect(result.content).toContain('Permission denied')
    expect(result.isError).toBe(true)
  })
})

describe('skill tool permissions', () => {
  it('classifies skill tools and routes decisions through the Tool Gate policy', async () => {
    expect(getToolSafetyLevel('skill__simplify')).toBe('safe')
    expect(getToolSafetyLevel('skill__review-pr')).toBe('safe')
    expect(getToolSafetyLevel('skill__pdf')).toBe('safe')
    expect(getToolSafetyLevel('skill__commit')).toBe('write')
    expect(getToolSafetyLevel('skill__skillify')).toBe('write')
    expect(getToolSafetyLevel('skill__update-config')).toBe('write')
    expect(getToolSafetyLevel('skill__unknown')).toBe('execute')

    const planPolicy = createToolGatePermissionPolicy('plan')
    expect((await checkToolGatePermission(planPolicy, 'skill__simplify', { args: 'content' }, ctx)).decision).toBe('allow')
    expect((await checkToolGatePermission(planPolicy, 'skill__commit', { args: 'commit' }, ctx)).decision).toBe('deny')
  })

  it('handles write and execute skill confirmation without a local skill runtime', async () => {
    const askCallback = vi.fn().mockResolvedValue(true)
    const policy = createToolGatePermissionPolicy('default', askCallback)

    expect((await checkToolGatePermission(policy, 'skill__commit', {
      args: `Commit message for ${ctx.cwd}/file.txt`,
    }, ctx)).reason).toContain('write skill within project')

    expect((await checkToolGatePermission(policy, 'skill__unknown-skill', {
      args: 'some arguments',
    }, ctx)).reason).toBe('user-approved')
    expect(askCallback).toHaveBeenCalledTimes(1)
  })
})
