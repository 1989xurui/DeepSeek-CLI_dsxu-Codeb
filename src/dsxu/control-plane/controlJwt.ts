export type DsxuDecodedJwt = {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  expiresAt?: number
  subject?: string
}

function decodeBase64UrlJson(part: string): Record<string, unknown> {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
  const text = Buffer.from(padded, 'base64').toString('utf8')
  const parsed = JSON.parse(text)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

export function decodeDsxuControlJwt(token: string): DsxuDecodedJwt | null {
  const parts = token.split('.')
  if (parts.length < 2 || !parts[0] || !parts[1]) return null
  try {
    const header = decodeBase64UrlJson(parts[0])
    const payload = decodeBase64UrlJson(parts[1])
    return {
      header,
      payload,
      expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
      subject: typeof payload.sub === 'string' ? payload.sub : undefined,
    }
  } catch {
    return null
  }
}
