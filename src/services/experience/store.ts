/**
 * R5-26 ExperienceStore — 存储 + 检索
 */

import type { ExperienceRecord, ExperienceStoreConfig } from './types';

export class ExperienceStore {
  private records: Map<string, ExperienceRecord> = new Map();
  private config: ExperienceStoreConfig;
  private initialized = false;

  constructor(config?: ExperienceStoreConfig) {
    this.config = { dbPath: '.dsxu/experience.db', mockMode: true, ...config };
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

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
    return id;
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
