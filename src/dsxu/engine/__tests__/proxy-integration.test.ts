import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = process.cwd()
const INCIDENT_LOG = join(REPO_ROOT, '.dsevo', 'deepseek-400.log')

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHealth(port: number, timeoutMs: number = 10000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/health`)
      if (resp.ok) return
    } catch {
      // keep polling
    }
    await sleep(100)
  }

  throw new Error(`Proxy did not become healthy on port ${port} within ${timeoutMs}ms`)
}

describe('DeepSeek proxy integration', () => {
  it('should assemble messages in fixed order with XML wrapped sanitized tool results', async () => {
    const upstreamPort = 20000 + Math.floor(Math.random() * 1000)
    const port = 21000 + Math.floor(Math.random() * 1000)
    let capturedUpstreamBody: any = null

    const upstream = Bun.serve({
      port: upstreamPort,
      async fetch(req) {
        const url = new URL(req.url)
        if (req.method === 'GET' && url.pathname === '/health') {
          return Response.json({ ok: true })
        }
        if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
          capturedUpstreamBody = await req.json()
          return Response.json({
            id: 'stub-resp-order',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'ok' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 64, completion_tokens: 8, total_tokens: 72 },
          })
        }
        return new Response('not found', { status: 404 })
      },
    })

    const bunBin = process.execPath || 'bun'
    const proc = Bun.spawn([bunBin, 'run', 'deepseek-proxy.ts'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PROXY_PORT: String(port),
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'test-key',
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })

    try {
      await waitForHealth(port)

      const resp = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'placeholder',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: [
            { type: 'text', text: 'SYSTEM_BASE' },
            { type: 'text', text: 'GLOBAL_SPEC_RULES' },
          ],
          messages: [
            { role: 'user', content: 'history user question' },
            {
              role: 'assistant',
              content: [
                { type: 'text', text: 'assistant calls tool' },
                { type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: 'a.ts' } },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'call_1',
                  content: '2026-04-15T12:00:00.000Z 123e4567-e89b-12d3-a456-426614174000\n12 | C:\\tmp\\file.ts',
                },
                { type: 'text', text: 'current user request' },
              ],
            },
          ],
        }),
      })

      expect(resp.status).toBe(200)
      expect(capturedUpstreamBody).toBeTruthy()

      const msgs = capturedUpstreamBody.messages
      expect(msgs[0].role).toBe('system')
      expect(msgs[0].content).toContain('SYSTEM_BASE')
      expect(msgs[1].role).toBe('system')
      expect(msgs[1].content).toContain('GLOBAL_SPEC_RULES')

      const last = msgs[msgs.length - 1]
      expect(last.role).toBe('user')
      expect(last.content).toContain('current user request')

      const toolMsgIdx = msgs.findIndex((m: any) => m.role === 'tool')
      expect(toolMsgIdx).toBeGreaterThan(1)
      expect(toolMsgIdx).toBeLessThan(msgs.length - 1)

      const toolMsg = msgs[toolMsgIdx]
      expect(toolMsg.content).toContain('<tool_execution_result tool_name="Read">')
      expect(toolMsg.content).toContain('[TIMESTAMP]')
      expect(toolMsg.content).toContain('[UUID]')
      expect(toolMsg.content).not.toContain('12 |')
      expect(toolMsg.content).not.toContain('\\')
    } finally {
      proc.kill()
      await proc.exited
      upstream.stop(true)
    }
  }, 15000)

  it('should handle over-budget Anthropic requests via local guard (block or local clipping)', async () => {
    const upstreamPort = 18000 + Math.floor(Math.random() * 1000)
    const port = 19000 + Math.floor(Math.random() * 1000)
    const previousLogSize = existsSync(INCIDENT_LOG) ? statSync(INCIDENT_LOG).size : 0
    let upstreamCalls = 0

    const upstream = Bun.serve({
      port: upstreamPort,
      fetch(req) {
        const url = new URL(req.url)
        if (req.method === 'GET' && url.pathname === '/health') {
          return Response.json({ ok: true })
        }
        if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
          upstreamCalls += 1
          return Response.json({
            id: 'stub-resp',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'stubbed upstream success' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 128, completion_tokens: 8, total_tokens: 136 },
          })
        }
        return new Response('not found', { status: 404 })
      },
    })

    const bunBin = process.execPath || 'bun'
    const proc = Bun.spawn([bunBin, 'run', 'deepseek-proxy.ts'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PROXY_PORT: String(port),
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'test-key',
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })

    try {
      await waitForHealth(port)

      const hugePrompt = 'a'.repeat(500_000)
      const resp = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'placeholder',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: hugePrompt,
            },
          ],
        }),
      })

      const data = await resp.json()
      expect([200, 413]).toContain(resp.status)
      if (resp.status === 413) {
        expect(data.error.type).toBe('context_budget_exceeded')
        expect(data.error.message).toContain('LOCAL_BUDGET_GUARD_BLOCKED')
      } else {
        expect(data.type).toBe('message')
        expect(data.role).toBe('assistant')
        expect(upstreamCalls).toBe(1)
      }

      await sleep(150)

      if (resp.status === 413) {
        expect(existsSync(INCIDENT_LOG)).toBe(true)
        const updatedLog = readFileSync(INCIDENT_LOG, 'utf-8')
        const appended = updatedLog.slice(previousLogSize)
        expect(appended).toContain('LOCAL_BUDGET_GUARD_BLOCKED')
        expect(appended).toContain('"stillOverBudget": true')
      }
    } finally {
      proc.kill()
      await proc.exited
      upstream.stop(true)
    }
  }, 15000)
})
