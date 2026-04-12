/**
 * R5-25 代码切块器
 *
 * 按函数/类边界切分源码为 CodeChunk。
 * 简化版本使用正则检测边界（真实版本用 tree-sitter）。
 */

import type { CodeChunk, ChunkerConfig } from './contract';

const DEFAULT_CHUNK_SIZE = 384;
const DEFAULT_OVERLAP = 64;

/**
 * 将源码切分为 CodeChunk 列表
 */
export function chunkSourceCode(
  content: string,
  file: string,
  language: string,
  config?: ChunkerConfig
): CodeChunk[] {
  const chunkSize = config?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = config?.overlap ?? DEFAULT_OVERLAP;
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  // 1. 找函数/类边界
  const boundaries = findBoundaries(lines, language);

  if (boundaries.length > 0) {
    // 按边界切块
    for (const boundary of boundaries) {
      const chunkContent = lines.slice(boundary.startLine, boundary.endLine + 1).join('\n');
      const tokens = estimateTokens(chunkContent);

      if (tokens <= chunkSize) {
        chunks.push({
          id: `${file}:${boundary.startLine + 1}-${boundary.endLine + 1}`,
          file,
          startLine: boundary.startLine + 1,
          endLine: boundary.endLine + 1,
          symbol: boundary.symbol,
          language,
          content: chunkContent,
        });
      } else {
        // 大函数 → 按 chunkSize 切分（带 overlap）
        const subChunks = splitLargeBlock(lines, boundary, file, language, chunkSize, overlap);
        chunks.push(...subChunks);
      }
    }
  } else {
    // 无边界 → 按行数切分
    const linesPerChunk = Math.max(10, Math.floor(chunkSize / 4)); // ~4 tokens/line
    for (let start = 0; start < lines.length; start += linesPerChunk - Math.floor(overlap / 4)) {
      const end = Math.min(start + linesPerChunk, lines.length);
      const chunkContent = lines.slice(start, end).join('\n');
      chunks.push({
        id: `${file}:${start + 1}-${end}`,
        file,
        startLine: start + 1,
        endLine: end,
        language,
        content: chunkContent,
      });
      if (end >= lines.length) break;
    }
  }

  return chunks;
}

interface Boundary {
  startLine: number;
  endLine: number;
  symbol?: string;
}

/** 找函数/类边界（简化版正则） */
function findBoundaries(lines: string[], language: string): Boundary[] {
  const boundaries: Boundary[] = [];

  const patterns: Record<string, RegExp[]> = {
    typescript: [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^\s*(?:export\s+)?class\s+(\w+)/,
      /^\s*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
    ],
    javascript: [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^\s*(?:export\s+)?class\s+(\w+)/,
    ],
    python: [
      /^\s*def\s+(\w+)/,
      /^\s*class\s+(\w+)/,
    ],
    go: [
      /^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/,
      /^\s*type\s+(\w+)\s+struct/,
    ],
  };

  const langPatterns = patterns[language] ?? patterns.typescript ?? [];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of langPatterns) {
      const m = lines[i].match(pattern);
      if (m) {
        const endLine = findBlockEnd(lines, i, language);
        boundaries.push({
          startLine: i,
          endLine,
          symbol: m[1],
        });
        break;
      }
    }
  }

  return boundaries;
}

/** 找块结束行（简化：匹配大括号或缩进） */
function findBlockEnd(lines: string[], startLine: number, language: string): number {
  if (language === 'python') {
    // Python: 缩进结束
    const baseIndent = lines[startLine].search(/\S/);
    for (let i = startLine + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      const indent = line.search(/\S/);
      if (indent <= baseIndent && i > startLine + 1) return i - 1;
    }
    return lines.length - 1;
  }

  // 大括号语言
  let braceCount = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { braceCount++; foundOpen = true; }
      if (ch === '}') braceCount--;
    }
    if (foundOpen && braceCount <= 0) return i;
  }
  return Math.min(startLine + 50, lines.length - 1);
}

function splitLargeBlock(
  lines: string[],
  boundary: Boundary,
  file: string,
  language: string,
  chunkSize: number,
  overlap: number
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const linesPerChunk = Math.max(10, Math.floor(chunkSize / 4));
  const overlapLines = Math.floor(overlap / 4);

  for (let start = boundary.startLine; start <= boundary.endLine; start += linesPerChunk - overlapLines) {
    const end = Math.min(start + linesPerChunk, boundary.endLine + 1);
    chunks.push({
      id: `${file}:${start + 1}-${end}`,
      file,
      startLine: start + 1,
      endLine: end,
      symbol: boundary.symbol,
      language,
      content: lines.slice(start, end).join('\n'),
    });
    if (end > boundary.endLine) break;
  }

  return chunks;
}

/** 估算 token 数（简化：~4 chars/token） */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
