/**
 * R5-01+ ast-grep + BM25 三级 fallback — 类型契约
 */

export type SearchTier = 'ast-grep' | 'bm25' | 'ripgrep';

export interface SearchHit {
  file: string;
  line: number;
  col: number;
  context: string;
  score: number;
  tier: SearchTier;
}

export interface SearchOptions {
  query: string;
  language?: string;      // ts/py/go ...
  forcedTier?: SearchTier;
  maxResults?: number;    // 默认 20
  rootDir?: string;       // 搜索根目录
}

export interface SearchConfig {
  /** Mock ast-grep for G4 testing */
  mockAstGrep?: (query: string, language?: string) => Promise<SearchHit[]>;
  /** Mock ripgrep for G4 testing */
  mockRipgrep?: (query: string) => Promise<SearchHit[]>;
  /** Pre-built BM25 index for testing */
  mockBm25Index?: BM25Index;
}

export interface BM25Index {
  /** 文档列表 */
  documents: BM25Document[];
  /** 倒排索引: token → docId[] */
  invertedIndex: Map<string, number[]>;
  /** 文档频率 */
  df: Map<string, number>;
  /** 平均文档长度 */
  avgDl: number;
  /** 总文档数 */
  N: number;
}

export interface BM25Document {
  id: number;
  file: string;
  line: number;
  content: string;
  tokens: string[];
  length: number;
}
