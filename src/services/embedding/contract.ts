/**
 * R5-25 voyage-code-3 + 持久向量库 — 类型契约
 */

export interface EmbedRequest {
  texts: string[];
  inputType: 'document' | 'query';
}

export interface EmbedResponse {
  vectors: number[][];
}

export interface CodeChunk {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  symbol?: string;       // 函数名/类名
  language: string;
  content: string;
  vector?: number[];
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;         // cosine similarity
}

export interface VectorStoreConfig {
  /** DB 路径 */
  dbPath?: string;        // 默认 .dsxu/vectors.db
  /** embedding 维度 */
  dimension?: number;     // 默认 1024
  /** Mock embedding for G4 testing */
  mockEmbed?: (req: EmbedRequest) => Promise<EmbedResponse>;
  /** Mock store for G4 (in-memory) */
  mockMode?: boolean;
}

export interface ChunkerConfig {
  /** Chunk 大小（tokens 近似） */
  chunkSize?: number;     // 默认 384
  /** 重叠 */
  overlap?: number;       // 默认 64
}

export interface IndexStats {
  chunks: number;
  files: number;
  sizeBytes: number;
}
