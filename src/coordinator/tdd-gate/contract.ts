/**
 * R5-21 Test-Driven Gate — Interface Contract
 */

export interface TestSpec {
  filePath: string;
  content: string;
  targetName: string;
  testDescriptions: string[];
}

export interface TDDContext {
  taskDescription: string;
  targetFiles: string[];
  cwd: string;
  existingTests: string[];
  currentPatch?: string;
}

export interface RedPhaseResult {
  success: boolean;
  testSpec: TestSpec;
  output?: string;
  error?: string;
}

export interface GreenPhaseResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface TDDGateResult {
  passed: boolean;
  redPhase: RedPhaseResult;
  greenPhase?: GreenPhaseResult;
  durationMs: number;
  error?: string;
}

export interface TDDGateConfig {
  testCommand: string;
  cwd: string;
  redTimeoutMs: number;
  greenTimeoutMs: number;
  mockTestRunner?: (testFilePath: string) => Promise<{ passed: boolean; output: string }>;
  mockTestGenerator?: (context: TDDContext) => Promise<TestSpec>;
}
