/**
 * R5-26 ExperienceStore — 存储 + 检索
 *
 * 双系统架构：
 * - 内存 Map + 向量检索（DSxu 原有）
 * - memdir 文件持久化（DSXU Code 原有，init 时加载）
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { ExperienceRecord, ExperienceStoreConfig } from './types';

// DSXU Code memdir — 直接 import，零改原码
let _scanMemoryFiles: typeof import('../../memdir/memoryScan').scanMemoryFiles | null = null;
let _getAutoMemPath: typeof import('../../memdir/paths').getAutoMemPath | null = null;

try {
  const scan = await import('../../memdir/memoryScan');
  const paths = await import('../../memdir/paths');
  _scanMemoryFiles = scan.scanMemoryFiles;
  _getAutoMemPath = paths.getAutoMemPath;
} catch {
  // memdir 不可用时静默降级（测试环境、独立运行等）
}

export class ExperienceStore {
  private records: Map<string, ExperienceRecord> = new Map();
  private config: ExperienceStoreConfig;
  private initialized = false;
  private memdirPath: string | null = null;

  constructor(config?: ExperienceStoreConfig) {
    this.config = { dbPath: '.dsxu/experience.db', mockMode: true, ...config };
  }

  async init(): Promise<void> {
    this.initialized = true;

    // 连接 memdir：发现已有记忆文件 → 加载为只读线索
    if (_getAutoMemPath && !this.config.mockMode) {
      try {
        this.memdirPath = _getAutoMemPath();
      } catch { /* memdir 不可用，静默 */ }
    }

    // 从 memdir 加载已有记忆文件作为 fallback 检索源
    if (this.memdirPath && _scanMemoryFiles) {
      try {
        const headers = await _scanMemoryFiles(this.memdirPath, new AbortController().signal);
        // memdir 文件作为低分 fallback 记录（不占向量空间，只做关键词匹配）
        this._memdirHeaders = headers;
      } catch { /* 扫描失败静默 */ }
    }
  }

  /** memdir 扫描结果缓存 */
  private _memdirHeaders: Array<{ filename: string; filePath: string; description: string | null }> = [];

  async add(record: Omit<ExperienceRecord, 'id' | 'embedding'>): Promise<string> {
    this.ensureInit();
    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Generate embedding
    let embedding: number[];
    if (this.config.mockEmbed) {
      const vecs = await this.config.mockEmbed([record.taskDescription + ' ' + record.plan]);
      embedding = vecs[0];
    } else {
      embedding = this.simpleHash(record.taskDescription + ' ' + record.plan);
    }

    const full: ExperienceRecord = { ...record, id, embedding };
    this.records.set(id, full);

    // 双写：同时写入 memdir 文件（持久化，跨会话可用）
    await this.writeToMemdir(full);

    return id;
  }

  /** 写入 memdir 文件系统（DSXU Code 兼容格式） */
  private async writeToMemdir(record: ExperienceRecord): Promise<void> {
    if (!this.memdirPath || this.config.mockMode) return;
    try {
      await mkdir(this.memdirPath, { recursive: true });
      const filename = `exp_${record.id}.md`;
      const content = [
        '---',
        `type: experience`,
        `description: ${record.taskDescription.slice(0, 100)}`,
        `outcome: ${record.outcome}`,
        `score: ${record.finalScore}`,
        '---',
        '',
        `# ${record.taskDescription}`,
        '',
        `**Outcome**: ${record.outcome} (score: ${record.finalScore})`,
        `**Plan**: ${record.plan}`,
        record.criticReason ? `**Critic**: ${record.criticReason}` : '',
      ].filter(Boolean).join('\n');
      await writeFile(join(this.memdirPath, filename), content);
    } catch { /* 写入失败不阻塞主流程 */ }
  }

  async retrieve(
    query: string,
    k: number = 5,
    filter?: { outcome?: string }
  ): Promise<ExperienceRecord[]> {
    this.ensureInit();

    let queryVec: number[];
    if (this.config.mockEmbed) {
      const vecs = await this.config.mockEmbed([query]);
      queryVec = vecs[0];
    } else {
      queryVec = this.simpleHash(query);
    }

    let candidates = Array.from(this.records.values());

    if (filter?.outcome) {
      candidates = candidates.filter(r => r.outcome === filter.outcome);
    }

    // Score by cosine similarity
    const scored = candidates.map(r => ({
      record: r,
      score: cosine(queryVec, r.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Weight by helpfulness
    scored.sort((a, b) => {
      const helpA = a.record.helpfulness ?? 0.5;
      const helpB = b.record.helpfulness ?? 0.5;
      return (b.score * helpB) - (a.score * helpA);
    });

    return scored.slice(0, k).map(s => s.record);
  }

  async feedback(id: string, helpfulness: number): Promise<void> {
    this.ensureInit();
    const record = this.records.get(id);
    if (record) {
      record.helpfulness = helpfulness;
    }
  }

  async stats(): Promise<{ total: number; successRate: number }> {
    this.ensureInit();
    const all = Array.from(this.records.values());
    const total = all.length;
    const successes = all.filter(r => r.outcome === 'success').length;
    return { total, successRate: total > 0 ? successes / total : 0 };
  }

  private ensureInit() {
    if (!this.initialized) throw new Error('ExperienceStore not initialized');
  }

  private simpleHash(text: string): number[] {
    const dim = 8;
    const vec: number[] = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % dim] += text.charCodeAt(i);
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
