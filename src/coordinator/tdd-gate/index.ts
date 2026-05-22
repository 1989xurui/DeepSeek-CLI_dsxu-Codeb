/**
 * R5-21 Test-Driven Gate — 统一导出
 */

export * from './contract';
export { extractTestTargets } from './extractor';
export { generateTestSpec } from './generator';
export { runRedPhase, runGreenPhase } from './runner';
export { tddGate } from './gate';
export { TddGate, invokePostWriteTddGate } from './post-write-hook';
