import * as React from 'react';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { PluginSettings } from './PluginSettings.js';
export async function call(onDone: LocalJSXCommandOnDone, _context: unknown, args?: string): Promise<React.ReactNode> {
  return <PluginSettings onComplete={onDone} args={args} />;
}

// V14 lifecycle shim: plugin
export function processPluginLifecycle(input) {
  void input
  const state = 'plugin-state'
  const lifecycle = 'plugin:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
