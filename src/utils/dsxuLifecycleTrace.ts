// Lightweight local trace for DSXU live tool/query lifecycle debugging.
// It is intentionally best-effort: tracing must never affect the main loop.
import { appendFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

type TraceData = Record<string, unknown>

function isTraceEnabled(): boolean {
  if (process.env.DSXU_CODE_LIFECYCLE_TRACE === '0') return false
  if (process.env.DSXU_CODE_LIFECYCLE_TRACE === '1') return true
  return process.env.DSXU_CODE_MODE === '1'
}

function getTracePath(): string {
  const baseDir =
    process.env.DSXU_CODE_LIFECYCLE_TRACE_DIR ??
    join(process.env.DSXU_CONFIG_DIR ?? join(homedir(), '.dsxu'), 'traces')
  return join(baseDir, `dsxu-lifecycle-${process.pid}.jsonl`)
}

function sanitize(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}...` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitize)
  if (typeof value === 'object') {
    const result: TraceData = {}
    for (const [key, entry] of Object.entries(value as TraceData).slice(0, 40)) {
      result[key] = sanitize(entry)
    }
    return result
  }
  return String(value)
}

export function traceDsxuLifecycle(event: string, data: TraceData = {}): void {
  if (!isTraceEnabled()) return
  try {
    const filePath = getTracePath()
    mkdirSync(dirname(filePath), { recursive: true })
    appendFileSync(
      filePath,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        pid: process.pid,
        event,
        ...sanitize(data),
      })}\n`,
      { mode: 0o600 },
    )
  } catch {
    // never let diagnostics perturb runtime behavior
  }
}
