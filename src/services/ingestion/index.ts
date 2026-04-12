/**
 * R5-34 文档 ingestion + web search
 */

export interface IngestionTask {
  url: string;
  format: 'auto' | 'markdown' | 'html' | 'pdf' | 'openapi';
  namespace: string;
  ttlDays?: number;
}

export interface IngestionResult {
  chunksCreated: number;
  bytesProcessed: number;
  durationMs: number;
}

export interface IngestionConfig {
  mockFetcher?: (url: string) => Promise<string>;
  mockParser?: (content: string, format: string) => string[];
}

/**
 * Ingest 外部文档到向量库
 */
export async function ingest(task: IngestionTask, config?: IngestionConfig): Promise<IngestionResult> {
  const start = Date.now();

  // 1. Fetch
  let content: string;
  if (config?.mockFetcher) {
    content = await config.mockFetcher(task.url);
  } else {
    const resp = await fetch(task.url);
    content = await resp.text();
  }

  // 2. Detect format
  const format = task.format === 'auto' ? detectFormat(task.url, content) : task.format;

  // 3. Parse into chunks
  let chunks: string[];
  if (config?.mockParser) {
    chunks = config.mockParser(content, format);
  } else {
    chunks = parseContent(content, format);
  }

  return {
    chunksCreated: chunks.length,
    bytesProcessed: content.length,
    durationMs: Date.now() - start,
  };
}

/**
 * Refresh namespace（重新 ingest）
 */
export async function refresh(namespace: string, config?: IngestionConfig): Promise<void> {
  // 预留：查找该 namespace 下的所有 task，重新 ingest
}

function detectFormat(url: string, content: string): string {
  if (url.endsWith('.md')) return 'markdown';
  if (url.endsWith('.pdf')) return 'pdf';
  if (url.endsWith('.yaml') || url.endsWith('.yml')) return 'openapi';
  if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) return 'html';
  return 'markdown';
}

function parseContent(content: string, format: string): string[] {
  switch (format) {
    case 'markdown':
      return content.split(/\n#{1,3}\s/).filter(s => s.trim().length > 0);
    case 'html':
      return content.split(/<\/(?:p|div|section|article)>/i).filter(s => s.trim().length > 0);
    case 'pdf':
      return [content]; // pdf-parse 预留
    case 'openapi':
      return content.split(/\npaths:|components:/i).filter(s => s.trim().length > 0);
    default:
      return [content];
  }
}
