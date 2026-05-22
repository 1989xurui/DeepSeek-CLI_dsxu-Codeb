import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { useContext } from 'react';

/**
 * Context to indicate that shell output should be shown in full (not truncated).
 * Used to auto-expand the most recent user `!` command output.
 *
 * This follows the same pattern as MessageResponseContext and SubAgentContext -
 * a boolean context that child components can check to modify their behavior.
 */
const ExpandShellOutputContext = React.createContext(false);

export const MAX_AUTO_EXPAND_SHELL_OUTPUT_CHARS = 4000;
export const MAX_AUTO_EXPAND_SHELL_OUTPUT_LINES = 80;

export function shouldAutoExpandShellOutput(content: string): boolean {
  if (!content) return false;
  if (content.length > MAX_AUTO_EXPAND_SHELL_OUTPUT_CHARS) return false;

  let lineCount = 1;
  for (const char of content) {
    if (char === '\n') lineCount++;
    if (lineCount > MAX_AUTO_EXPAND_SHELL_OUTPUT_LINES) return false;
  }
  return true;
}

export function ExpandShellOutputProvider(t0) {
  const $ = _c(2);
  const {
    children
  } = t0;
  let t1;
  if ($[0] !== children) {
    t1 = <ExpandShellOutputContext.Provider value={true}>{children}</ExpandShellOutputContext.Provider>;
    $[0] = children;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  return t1;
}

/**
 * Returns true if this component is rendered inside an ExpandShellOutputProvider,
 * indicating the shell output should be shown in full rather than truncated.
 */
export function useExpandShellOutput() {
  return useContext(ExpandShellOutputContext);
}
