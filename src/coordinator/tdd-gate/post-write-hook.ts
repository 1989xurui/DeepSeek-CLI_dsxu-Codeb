import type { TDDGateConfig, TDDGateResult } from './contract';
import { tddGate } from './gate';

export type TddGateChangeType = 'write' | 'edit';
export type TddGateInvokeStatus = 'SKIPPED' | 'PASS' | 'FAIL' | 'PARTIAL';

export interface TddGateInvokeInput {
  filePath: string;
  changeType: TddGateChangeType;
  oldContent?: string | null;
  newContent: string;
  repoRoot?: string;
  taskDescription?: string;
  existingTests?: string[];
  currentPatch?: string;
}

export interface TddGateInvokeConfig extends Partial<TDDGateConfig> {
  enabled?: boolean;
  mode?: 'post-mutation-verification' | 'full-test' | 'compile-only' | 'lint-only';
  blocking?: boolean;
}

export interface TddGateInvokeResult {
  status: TddGateInvokeStatus;
  blocking: boolean;
  passed: boolean;
  durationMs: number;
  semantics: 'skipped' | 'post-mutation-verification' | 'full-test';
  error?: string;
  detail?: TDDGateResult;
}

export class TddGate {
  constructor(private readonly config: TddGateInvokeConfig = {}) {}

  async invoke(input: TddGateInvokeInput): Promise<TddGateInvokeResult> {
    return invokePostWriteTddGate(input, this.config);
  }
}

export async function invokePostWriteTddGate(
  input: TddGateInvokeInput,
  config: TddGateInvokeConfig = {},
): Promise<TddGateInvokeResult> {
  const startTime = Date.now();
  const enabled =
    config.enabled ??
    !isEnvExplicitFalse(process.env.DSXU_TDD_POST_WRITE_GATE);
  const blocking = config.blocking ?? isEnvTruthy(process.env.DSXU_TDD_POST_WRITE_GATE_BLOCKING);

  if (!enabled) {
    return {
      status: 'SKIPPED',
      blocking,
      passed: true,
      durationMs: Date.now() - startTime,
      semantics: 'skipped',
    };
  }

  const mode =
    config.mode ?? process.env.DSXU_TDD_POST_WRITE_GATE_MODE ?? 'post-mutation-verification';
  if (mode !== 'full-test') {
    return {
      status: 'PARTIAL',
      blocking,
      passed: true,
      durationMs: Date.now() - startTime,
      semantics: 'post-mutation-verification',
      error:
        `TDD mode "${mode}" is recorded as post-mutation verification. ` +
        'Full red/green TDD requires an explicit pre-edit test contract.',
    };
  }

  try {
    const cwd = config.cwd ?? input.repoRoot ?? process.cwd();
    const result = await tddGate(
      {
        taskDescription:
          input.taskDescription ?? `${input.changeType} verification for ${input.filePath}`,
        targetFiles: [input.filePath],
        cwd,
        existingTests: input.existingTests ?? [],
        currentPatch: input.currentPatch ?? summarizeContentChange(input),
      },
      {
        ...config,
        cwd,
        testCommand: config.testCommand ?? process.env.DSXU_TDD_GATE_TEST_COMMAND ?? 'bun test {file}',
        redTimeoutMs: config.redTimeoutMs ?? readIntEnv('DSXU_TDD_GATE_RED_TIMEOUT_MS', 30_000),
        greenTimeoutMs:
          config.greenTimeoutMs ?? readIntEnv('DSXU_TDD_GATE_GREEN_TIMEOUT_MS', 30_000),
      },
    );

    return {
      status: result.passed ? 'PASS' : 'FAIL',
      blocking,
      passed: result.passed,
      durationMs: result.durationMs,
      semantics: 'full-test',
      error: result.error,
      detail: result,
    };
  } catch (error) {
    return {
      status: 'FAIL',
      blocking,
      passed: false,
      durationMs: Date.now() - startTime,
      semantics: 'full-test',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeContentChange(input: TddGateInvokeInput): string {
  const oldLength = input.oldContent?.length ?? 0;
  const newLength = input.newContent.length;
  return `${input.changeType} ${input.filePath}: ${oldLength} chars -> ${newLength} chars`;
}

function isEnvTruthy(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

function isEnvExplicitFalse(value: string | undefined): boolean {
  return value === '0' || value?.toLowerCase() === 'false' || value?.toLowerCase() === 'no';
}

function readIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
