import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  applyDsxuSubprocessProxyEnv,
  buildDsxuRelayProxyRequest,
  filterDsxuRelayProxyHeaders,
  shouldAllowDsxuUpstreamRelay,
} from '../../network'

describe('DSXU Network Facade V1', () => {
  test('denies upstream relay by default', () => {
    expect(
      shouldAllowDsxuUpstreamRelay('https://api.example.test/v1/messages'),
    ).toEqual({ allowed: false, reason: 'relay_disabled' })
  })

  test('allows only explicit HTTP(S) upstream hosts', () => {
    const policy = {
      allowApiProxy: true,
      allowedHosts: ['api.example.test'],
    }

    expect(
      shouldAllowDsxuUpstreamRelay('https://api.example.test/v1/messages', policy),
    ).toMatchObject({ allowed: true, host: 'api.example.test' })
    expect(
      shouldAllowDsxuUpstreamRelay('https://evil.example.test/v1/messages', policy),
    ).toEqual({ allowed: false, reason: 'host_not_allowed' })
    expect(
      shouldAllowDsxuUpstreamRelay('file:///tmp/secrets', policy),
    ).toEqual({ allowed: false, reason: 'non_http_url' })
  })

  test('filters headers with an allowlist and secret denylist', () => {
    const filtered = filterDsxuRelayProxyHeaders(
      {
        Accept: 'application/json',
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
        'X-Api-Key': 'secret',
        'X-Request-Id': 'req-1',
        'X-Dsxu-Session-Id': 'session-1',
        'X-Custom-Token': 'secret',
        'X-Not-Allowed': 'drop',
      },
      { allowedHeaderNames: ['accept', 'x-request-id', 'x-dsxu-session-id'] },
    )

    expect(filtered).toEqual({
      accept: 'application/json',
      'x-request-id': 'req-1',
      'x-dsxu-session-id': 'session-1',
    })
  })

  test('builds a sanitized proxy request without performing network IO', () => {
    const request = buildDsxuRelayProxyRequest({
      url: 'https://api.example.test/v1/messages',
      method: 'post',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer secret',
      },
      body: { ok: true },
      policy: {
        allowApiProxy: true,
        allowedHosts: ['api.example.test'],
      },
    })

    expect(request).toEqual({
      ok: true,
      url: 'https://api.example.test/v1/messages',
      method: 'POST',
      headers: { accept: 'application/json' },
      body: { ok: true },
    })
  })

  test('injects subprocess proxy env only when explicitly enabled', () => {
    const denied = applyDsxuSubprocessProxyEnv({
      env: { PATH: '/bin' },
      policy: { proxyUrl: 'http://127.0.0.1:8080' },
    })
    expect(denied).toEqual({
      env: { PATH: '/bin' },
      applied: false,
      reason: 'proxy_env_disabled',
    })

    const applied = applyDsxuSubprocessProxyEnv({
      env: { PATH: '/bin', HTTP_PROXY: 'http://existing.proxy:8080' },
      policy: {
        allowSubprocessProxyEnv: true,
        proxyUrl: 'http://127.0.0.1:8080',
        noProxy: 'localhost,127.0.0.1',
      },
    })

    expect(applied.applied).toBe(true)
    expect(applied.env.HTTP_PROXY).toBe('http://existing.proxy:8080')
    expect(applied.env.HTTPS_PROXY).toBe('http://127.0.0.1:8080')
    expect(applied.env.NO_PROXY).toBe('localhost,127.0.0.1')
  })

  test('does not restore legacy bridge, remote, or upstreamproxy directories', () => {
    const root = process.cwd()

    expect(existsSync(join(root, 'src/bridge'))).toBe(false)
    expect(existsSync(join(root, 'src/remote'))).toBe(false)
    expect(existsSync(join(root, 'src/upstreamproxy'))).toBe(false)
  })
})
