// Hand-tuned 9x3 terminal mascot. The pixel grid is 9x6, rendered two
// vertical pixels per terminal cell with upper-half blocks.
export type DsxuMascotAnsiVariant = {
  readonly name: 'small'
  readonly width: number
  readonly height: number
  readonly lines: readonly string[]
}

type Rgb = readonly [number, number, number]

const PALETTE: Readonly<Record<string, Rgb>> = {
  '0': [0, 0, 0],
  B: [66, 139, 255],
  C: [145, 197, 255],
  E: [14, 14, 16],
}

const DSXU_MASCOT_PIXELS = [
  '0B00000B0',
  'BBB000BBB',
  'BBBBBBBBB',
  'BBEBBBEBB',
  'BBCCBCCBB',
  '0BBBEBBB0',
] as const

function colorFor(key: string): Rgb {
  const color = PALETTE[key]
  if (!color) throw new Error(`Unknown DSXU mascot color key: ${key}`)
  return color
}

function ansiCell(topKey: string, bottomKey: string): string {
  const top = colorFor(topKey)
  const bottom = colorFor(bottomKey)
  return `\x1b[38;2;${top[0]};${top[1]};${top[2]};48;2;${bottom[0]};${bottom[1]};${bottom[2]}m\u2580`
}

function renderHalfBlocks(grid: readonly string[]): readonly string[] {
  const lines: string[] = []
  for (let row = 0; row < grid.length; row += 2) {
    const top = grid[row]!
    const bottom = grid[row + 1]!
    let line = ''
    for (let col = 0; col < top.length; col++) {
      line += ansiCell(top[col]!, bottom[col]!)
    }
    lines.push(`${line}\x1b[0m`)
  }
  return lines
}

const DSXU_MASCOT_ANSI_SMALL_LINES = renderHalfBlocks(DSXU_MASCOT_PIXELS)

export const DSXU_MASCOT_ANSI_VARIANTS = [
  { name: 'small', width: 9, height: 3, lines: DSXU_MASCOT_ANSI_SMALL_LINES },
] as const satisfies readonly DsxuMascotAnsiVariant[]

export const DSXU_MASCOT_ANSI_DEFAULT = DSXU_MASCOT_ANSI_VARIANTS[0]

export function selectDsxuMascotAnsiVariant(maxWidth: number): DsxuMascotAnsiVariant {
  void maxWidth
  return DSXU_MASCOT_ANSI_DEFAULT
}
