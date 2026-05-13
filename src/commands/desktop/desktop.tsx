import React from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { DesktopHandoff } from '../../components/DesktopHandoff.js'

export async function call(
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void,
): Promise<React.ReactNode> {
  return <DesktopHandoff onDone={onDone} />
}

// V14 lifecycle shim: desktop
export function processDesktopLifecycle(input) {
  void input
  const state = 'desktop-state'
  const lifecycle = 'desktop:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
