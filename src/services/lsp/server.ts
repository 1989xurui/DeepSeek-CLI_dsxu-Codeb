/**
 * R5-31 LSP Server — 主入口
 */

import type { LspRequest, LspResponse, LspServerConfig, LspMethod } from './contract';

const HANDLERS: Record<LspMethod, (params: any, config?: LspServerConfig) => Promise<any>> = {
  hover: handleHover,
  completion: handleCompletion,
  codeAction: handleCodeAction,
  diagnostics: handleDiagnostics,
  references: handleReferences,
  definition: handleDefinition,
};

export async function handleRequest(req: LspRequest, config?: LspServerConfig): Promise<LspResponse> {
  const start = Date.now();

  if (config?.mockHandler) {
    const result = await config.mockHandler(req);
    return { method: req.method, result, durationMs: Date.now() - start };
  }

  const handler = HANDLERS[req.method];
  if (!handler) {
    return { method: req.method, result: null, durationMs: Date.now() - start };
  }

  const result = await handler(req.params, config);
  return { method: req.method, result, durationMs: Date.now() - start };
}

async function handleHover(params: any): Promise<any> {
  return {
    contents: { kind: 'markdown', value: `Hover info for position ${params.position.line}:${params.position.character}` },
    range: { start: params.position, end: { ...params.position, character: params.position.character + 10 } },
  };
}

async function handleCompletion(params: any): Promise<any> {
  return {
    isIncomplete: false,
    items: [
      { label: 'suggestion1', kind: 1, detail: 'Auto-generated completion' },
      { label: 'suggestion2', kind: 1, detail: 'Auto-generated completion' },
    ],
  };
}

async function handleCodeAction(params: any): Promise<any> {
  return [
    { title: 'Fix: Add null check', kind: 'quickfix', isPreferred: true },
    { title: 'Refactor: Extract function', kind: 'refactor.extract' },
  ];
}

async function handleDiagnostics(params: any): Promise<any> {
  return { uri: params.textDocument.uri, diagnostics: [] };
}

async function handleReferences(params: any): Promise<any> {
  return [];
}

async function handleDefinition(params: any): Promise<any> {
  return { uri: params.textDocument.uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
}
