import { env } from '../utils/env.js'

export const ASCII_TUI_MODE =
  process.env.DSXU_ASCII_TUI === '1' ||
  process.env.DSXU_TUI_HARNESS === '1' ||
  (Boolean(process.env.WSL_DISTRO_NAME) && process.env.DSXU_FORCE_UNICODE_TUI !== '1')

function tuiGlyph(unicodeGlyph: string, asciiGlyph: string): string {
  return ASCII_TUI_MODE ? asciiGlyph : unicodeGlyph
}

export const ASCII_TUI_BORDER_STYLE = 'classic'

export function tuiBorderStyle<T extends string>(
  unicodeBorderStyle: T,
): T | typeof ASCII_TUI_BORDER_STYLE {
  return ASCII_TUI_MODE ? ASCII_TUI_BORDER_STYLE : unicodeBorderStyle
}

// The former is better vertically aligned, but is not usually supported on Windows/Linux.
export const BLACK_CIRCLE = tuiGlyph(env.platform === 'darwin' ? '\u25cf' : '\u25cf', '*')
export const BULLET_OPERATOR = tuiGlyph('\u2219', '-')
export const TEARDROP_ASTERISK = tuiGlyph('\u2731', '*')
export const TEXT_SEPARATOR = tuiGlyph('\u00b7', '-')
export const UP_ARROW = tuiGlyph('\u2191', '^') // used for 1M merge notice
export const DOWN_ARROW = tuiGlyph('\u2193', 'v') // used for scroll hint
export const LIGHTNING_BOLT = tuiGlyph('\u21af', '~') // used for fast mode indicator
export const EFFORT_LOW = tuiGlyph('\u25cb', 'o') // effort level: low
export const EFFORT_MEDIUM = tuiGlyph('\u25d0', 'O') // effort level: medium
export const EFFORT_HIGH = tuiGlyph('\u25cf', '*') // effort level: high
export const EFFORT_MAX = tuiGlyph('\u25c9', '@') // effort level: max

// Media/trigger status indicators
export const PLAY_ICON = tuiGlyph('\u25b6', '>')
export const PAUSE_ICON = tuiGlyph('\u23f8', '||')

// MCP subscription indicators
export const REFRESH_ARROW = tuiGlyph('\u21bb', 'refresh') // used for resource update indicator
export const CHANNEL_ARROW = tuiGlyph('\u2190', '<-') // inbound channel message indicator
export const INJECTED_ARROW = tuiGlyph('\u2192', '->') // cross-session injected message indicator
export const FORK_GLYPH = tuiGlyph('\u2442', 'fork') // fork directive indicator

// Review status indicators
export const DIAMOND_OPEN = tuiGlyph('\u25c7', '<>') // running
export const DIAMOND_FILLED = tuiGlyph('\u25c6', '<#>') // completed/failed
export const REFERENCE_MARK = tuiGlyph('\u203b', '*') // away-summary recap marker

// Issue flag indicator
export const FLAG_ICON = tuiGlyph('\u2691', 'flag') // used for issue flag banner

// Blockquote indicator
export const BLOCKQUOTE_BAR = tuiGlyph('\u258e', '|') // left one-quarter block, used as blockquote line prefix
export const LIGHT_HORIZONTAL = tuiGlyph('\u2500', '-') // light box-drawing horizontal
export const HEAVY_HORIZONTAL = tuiGlyph('\u2501', '-') // heavy box-drawing horizontal

// Control plane status indicators
export const BRIDGE_SPINNER_FRAMES = [
  tuiGlyph('\u00b7|\u00b7', '-|-'),
  tuiGlyph('\u00b7/\u00b7', '-/-'),
  tuiGlyph('\u00b7-\u00b7', '---'),
  tuiGlyph('\u00b7\\\u00b7', '-\\-'),
]
export const BRIDGE_READY_INDICATOR = tuiGlyph('\u00b7\u2714\ufe0e\u00b7', 'ok')
export const BRIDGE_FAILED_INDICATOR = '\u00d7'
