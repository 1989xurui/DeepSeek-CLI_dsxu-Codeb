import { getSessionId } from '../bootstrap/state.js'
import { getCwd } from './cwd.js'

export type DesktopInstallStatus =
  | { status: 'not-installed' }
  | { status: 'version-too-old'; version: string }
  | { status: 'ready'; version: string }

export function buildDsxuDesktopDeepLink(sessionId = getSessionId()): string {
  const url = new URL('dsxu://resume')
  url.searchParams.set('session', sessionId)
  url.searchParams.set('cwd', getCwd())
  return url.toString()
}

export async function getDesktopInstallStatus(): Promise<DesktopInstallStatus> {
  return { status: 'not-installed' }
}

export async function openCurrentSessionInDesktop(): Promise<{
  success: boolean
  error?: string
  deepLinkUrl?: string
}> {
  return {
    success: false,
    error:
      'DSXU desktop handoff is legacy-isolated. Use dsxu-code CLI or the DSXU workbench entrypoint.',
    deepLinkUrl: buildDsxuDesktopDeepLink(),
  }
}
