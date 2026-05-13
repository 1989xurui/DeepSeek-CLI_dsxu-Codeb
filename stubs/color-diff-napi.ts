export type SyntaxTheme = {
  theme: string;
  source: string | null;
};

export class ColorDiff {
  constructor(
    _hunk: unknown,
    _firstLine: string | null,
    _filePath: string,
    _prefixContent?: string | null,
  ) {}

  render(_themeName: string, _width: number, _dim: boolean): string[] | null {
    return null;
  }
}

export class ColorFile {
  constructor(_code: string, _filePath: string) {}

  render(_themeName: string, _width: number, _dim: boolean): string[] | null {
    return null;
  }
}

export function getSyntaxTheme(themeName: string): SyntaxTheme {
  return { theme: themeName, source: null };
}
