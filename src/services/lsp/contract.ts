/**
 * R5-31 IDE LSP 插件 — 类型契约
 */

export type LspMethod = 'hover' | 'completion' | 'codeAction' | 'diagnostics' | 'references' | 'definition';

export interface LspRequest {
  method: LspMethod;
  params: {
    textDocument: { uri: string };
    position: { line: number; character: number };
    context?: any;
  };
}

export interface LspResponse {
  method: LspMethod;
  result: any;
  durationMs: number;
}

export interface LspServerConfig {
  port?: number;
  /** Mock handler for G4 testing */
  mockHandler?: (req: LspRequest) => Promise<any>;
}
