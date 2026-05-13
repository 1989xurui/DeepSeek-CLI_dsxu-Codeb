export const PROMPT_FOOTER_LINES = 5
export const MIN_INPUT_VIEWPORT_LINES = 3

export function computePromptInputMaxVisibleLines(
  rows: number,
  fullscreen: boolean,
): number | undefined {
  if (!fullscreen) return undefined

  const bottomSlotRows = Math.max(1, Math.floor(rows / 2))
  return Math.max(1, bottomSlotRows - PROMPT_FOOTER_LINES)
}
