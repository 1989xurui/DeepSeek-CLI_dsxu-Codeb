import { createHash } from 'node:crypto'

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  new RegExp(`\\b(dsxu|deepseek|openai|${['anth', 'ropic'].join('')}|github|ghp)_[A-Za-z0-9_-]{12,}\\b`, 'gi'),
  /\b[A-Za-z0-9+/]{32,}={0,2}\b/g,
  /(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi,
]

export interface RedactedTextSnapshot {
  chars: number
  hash: string
  preview: string
  redacted: true
  secretLike: boolean
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 16)
}

export function containsSecretLikeText(value: string): boolean {
  return SECRET_PATTERNS.some(pattern => {
    pattern.lastIndex = 0
    return pattern.test(value)
  })
}

export function redactSecretLikeText(value: string): string {
  let redacted = value
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0
    redacted = redacted.replace(pattern, '[REDACTED_SECRET]')
  }
  return redacted
}

export function snapshotText(value: unknown, maxPreviewChars = 160): RedactedTextSnapshot | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const secretLike = containsSecretLikeText(value)
  const redacted = redactSecretLikeText(value)
  return {
    chars: value.length,
    hash: stableHash(value),
    preview: redacted.slice(0, maxPreviewChars),
    redacted: true,
    secretLike,
  }
}

export function summarizeArtifactText(value: unknown): string | undefined {
  const snapshot = snapshotText(value)
  if (!snapshot) return undefined
  return `${snapshot.preview}${snapshot.chars > snapshot.preview.length ? '...' : ''}`
}

export function redactPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/[A-Za-z]:\/Users\/[^/]+/g, '$HOME')
}
