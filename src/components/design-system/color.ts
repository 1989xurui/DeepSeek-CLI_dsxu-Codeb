import { type ColorType, colorize } from '../../ink/colorize.js'
import type { Color } from '../../ink/styles.js'
import { getTheme, type Theme, type ThemeName } from '../../utils/theme.js'

/**
 * Curried theme-aware color function. Resolves theme keys to raw color
 * values before delegating to the ink renderer's colorize.
 */
export function color(
  c: keyof Theme | Color | undefined,
  theme: ThemeName,
  type: ColorType = 'foreground',
): (text: string) => string {
  return text => {
    if (!c) {
      return text
    }
    // Raw color values bypass theme lookup
    if (
      c.startsWith('rgb(') ||
      c.startsWith('#') ||
      c.startsWith('ansi256(') ||
      c.startsWith('ansi:')
    ) {
      return colorize(text, c, type)
    }
    // Theme key lookup
    return colorize(text, getTheme(theme)[c as keyof Theme], type)
  }
}

export function processColorLifecycle(input: {
  colorKey: keyof Theme | Color | undefined
  theme: ThemeName
  text: string
}): {
  state: 'empty' | 'colored'
  lifecycle: string
  output: string
} {
  const output = color(input.colorKey, input.theme)(input.text)
  const state = input.colorKey ? 'colored' : 'empty'
  return {
    state,
    lifecycle: `color:${state}`,
    output,
  }
}
