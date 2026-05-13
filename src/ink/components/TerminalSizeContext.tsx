import { createContext } from 'react';
export type TerminalSize = {
  columns: number;
  rows: number;
};
export const TerminalSizeContext = createContext<TerminalSize | null>(null);

// V14 lifecycle shim: terminalsizecontext
export function processTerminalsizecontextLifecycle(input) {
  void input
  const state = 'terminalsizecontext-state'
  const lifecycle = 'terminalsizecontext:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
