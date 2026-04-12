/**
 * R5-30 Property-based test — 类型契约
 */

export type PropertyTemplate =
  | 'idempotent'    // f(f(x)) === f(x)
  | 'invertible'    // decode(encode(x)) === x
  | 'monotonic'     // x < y → f(x) ≤ f(y)
  | 'invariant'     // len(insert(arr, x)) === len(arr) + 1
  | 'commutative'   // f(a, b) === f(b, a)
  | 'associative';  // f(f(a, b), c) === f(a, f(b, c))

export interface PbtSuggestion {
  functionName: string;
  filePath: string;
  applicableTemplates: PropertyTemplate[];
  generatedCode: string;
  confidence: number;      // 0-1
}

export interface PbtResult {
  passed: boolean;
  runs: number;
  counterexample?: any;
  shrinkSteps?: number;
  error?: string;
}

export interface PbtConfig {
  runs?: number;           // 默认 100
  /** Mock purity checker for G4 */
  mockPurityCheck?: (funcName: string, source: string) => boolean;
  /** Mock PBT runner for G4 */
  mockRunner?: (testCode: string, runs: number) => Promise<PbtResult>;
  /** Mock source reader for G4 */
  mockSourceReader?: (filePath: string) => Promise<string>;
}
