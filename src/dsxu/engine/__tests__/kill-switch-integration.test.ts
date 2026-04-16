import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const REPO_ROOT = process.cwd()
const TEST_DSEVO_DIR = join(REPO_ROOT, '.dsevo-kill-switch-test')
const KILL_FILE = join(TEST_DSEVO_DIR, 'KILL')

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
      // continue polling
    }
    await sleep(100)
  }

  throw new Error(`Proxy did not become healthy on port ${port} within ${timeoutMs}ms`)
}

function snapshotFile(path: string): { existed: boolean; content: string } {
  if (!existsSync(path)) {
    return { existed: false, content: '' }
  }

  return { existed: true, content: readFileSync(path, 'utf-8') }
}

function restoreFile(path: string, snapshot: { existed: boolean; content: string }) {
  if (!snapshot.existed) {
    rmSync(path, { force: true })
    return
  }

  writeFileSync(path, snapshot.content)
}

describe('DeepSeek proxy kill switch integration', () => {
  it('should write .dsevo/KILL after consecutive upstream 400s at night', async () => {
    mkdirSync(TEST_DSEVO_DIR, { recursive: true })
    const killSnapshot = snapshotFile(KILL_FILE)
    rmSync(KILL_FILE, { force: true })

    const upstreamPort = 20000 + Math.floor(Math.random() * 1000)
    const proxyPort = upstreamPort + 1000
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
          return new Response('stubbed upstream 400', { status: 400 })
        }
        return new Response('not found', { status: 404 })
      },
    })

    const bunBin = process.execPath || 'bun'
    const proc = Bun.spawn([bunBin, 'run', 'deepseek-proxy.ts'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PROXY_PORT: String(proxyPort),
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'test-key',
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
        BUDGET_GUARD_NOW: '2026-04-13T01:00:00+08:00',
        DSEVO_DIR: TEST_DSEVO_DIR,
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })

    try {
      await waitForHealth(proxyPort)

      const payload = {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'hello from kill switch test',
          },
        ],
      }

      const first = await fetch(`http://127.0.0.1:${proxyPort}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'placeholder',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      })

      const second = await fetch(`http://127.0.0.1:${proxyPort}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'placeholder',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      })

      expect(first.status).toBe(400)
      expect(second.status).toBe(400)
      expect(upstreamCalls).toBe(2)

      await sleep(150)

      expect(existsSync(KILL_FILE)).toBe(true)
      const content = readFileSync(KILL_FILE, 'utf-8')
      expect(content).toContain('deepseek_400_budget_guard')
      expect(content).toContain('"killThreshold": 2')
      expect(content).toContain('"consecutive400s": 2')
    } finally {
      proc.kill()
      await proc.exited
      upstream.stop(true)
      restoreFile(KILL_FILE, killSnapshot)
    }
  }, 15000)

  it('should arm the kill switch for streaming requests after consecutive upstream 400s at night', async () => {
    mkdirSync(TEST_DSEVO_DIR, { recursive: true })
    const killSnapshot = snapshotFile(KILL_FILE)
    rmSync(KILL_FILE, { force: true })

    const upstreamPort = 22000 + Math.floor(Math.random() * 1000)
    const proxyPort = upstreamPort + 1000
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
          return new Response('stubbed streaming upstream 400', { status: 400 })
        }
        return new Response('not found', { status: 404 })
      },
    })

    const bunBin = process.execPath || 'bun'
    const proc = Bun.spawn([bunBin, 'run', 'deepseek-proxy.ts'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PROXY_PORT: String(proxyPort),
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'test-key',
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
        BUDGET_GUARD_NOW: '2026-04-13T01:00:00+08:00',
        DSEVO_DIR: TEST_DSEVO_DIR,
      },
      stdout: 'ignore',
      stderr: 'ignore',
    })

    try {
      await waitForHealth(proxyPort)

      const payload = {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        stream: true,
        messages: [
          {
            role: 'user',
            content: 'hello from streaming kill switch test',
          },
        ],
      }

      const first = await fetch(`http://127.0.0.1:${proxyPort}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'placeholder',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      })

      const second = await fetch(`http://127.0.0.1:${proxyPort}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'placeholder',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      })

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
      expect(await first.text()).toContain('stubbed streaming upstream 400')
      expect(await second.text()).toContain('stubbed streaming upstream 400')
      expect(upstreamCalls).toBe(2)

      await sleep(150)

      expect(existsSync(KILL_FILE)).toBe(true)
      const content = readFileSync(KILL_FILE, 'utf-8')
      expect(content).toContain('deepseek_400_budget_guard')
      expect(content).toContain('"killThreshold": 2')
      expect(content).toContain('"consecutive400s": 2')
    } finally {
      proc.kill()
      await proc.exited
      upstream.stop(true)
      restoreFile(KILL_FILE, killSnapshot)
    }
  }, 15000)
})
