import { describe, expect, test } from 'bun:test';
import {
  DSXU_MASCOT_ANSI_VARIANTS,
  selectDsxuMascotAnsiVariant,
} from '../dsxuMascotAnsi.js';

describe('DSXU terminal mascot', () => {
  test('uses the DSXU-owned blue pixel kitten avatar for startup and TUI layouts', () => {
    expect(DSXU_MASCOT_ANSI_VARIANTS.map(variant => variant.name)).toEqual([
      'pixel-kitten',
    ]);
    expect(selectDsxuMascotAnsiVariant(9).name).toBe('pixel-kitten');
    expect(selectDsxuMascotAnsiVariant(80).name).toBe('pixel-kitten');
  });

  test('keeps terminal dimensions stable and reset-safe', () => {
    const stripAnsi = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, '');
    for (const variant of DSXU_MASCOT_ANSI_VARIANTS) {
      expect(variant.width).toBe(9);
      expect(variant.height).toBe(variant.lines.length);
      for (const line of variant.lines) {
        expect(stripAnsi(line).length).toBe(variant.width);
        expect(line.endsWith('\x1b[0m')).toBe(true);
      }
    }
  });
});
