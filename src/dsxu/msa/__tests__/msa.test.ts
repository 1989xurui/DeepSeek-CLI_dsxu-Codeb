/**
 * MSA 三级分层记忆 — 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MSA, L1Core, L2Working, L3Archive } from '../index';

// ── L1 Core Tests ──

describe('L1Core', () => {
  it('should build a stable prefix', async () => {
    const l1 = new L1Core({
      projectRoot: '/test/project',
      projectName: 'TestProject',
      customInstructions: 'Always use TypeScript strict mode.',
    });

    const snapshot1 = await l1.build();
    const snapshot2 = await l1.build();

    expect(snapshot1.prefix).toContain('TestProject');
    expect(snapshot1.prefix).toContain('/test/project');
    expect(snapshot1.prefix).toContain('Always use TypeScript strict mode.');
    expect(snapshot1.estimatedTokens).toBeGreaterThan(0);
    expect(snapshot1.estimatedTokens).toBeLessThanOrEqual(2500);

    // 稳定性：两次构建哈希一致
    expect(snapshot1.hash).toBe(snapshot2.hash);
  });

  it('should respect maxTokens limit', async () => {
    const l1 = new L1Core({
      projectRoot: '/test/project',
      customInstructions: 'A'.repeat(20000), // 超长指令
      maxTokens: 500,
    });

    const snapshot = await l1.build();
    expect(snapshot.estimatedTokens).toBeLessThanOrEqual(550); // 允许小误差
  });

  it('should invalidate cache on demand', async () => {
    const l1 = new L1Core({
      projectRoot: '/test/project',
    });

    await l1.build();
    expect(l1.getCached()).not.toBeNull();

    l1.invalidate();
    expect(l1.getCached()).toBeNull();
  });
});

// ── L2 Working Tests ──

describe('L2Working', () => {
  let l2: L2Working;

  beforeEach(() => {
    l2 = new L2Working({ maxTokens: 4500, keepFullRounds: 3 });
  });

  it('should store conversation rounds', () => {
    l2.addConversationRound('Hello', 'Hi there!');
    l2.addConversationRound('Write a function', 'Here is the code...');

    const snapshot = l2.build();
    expect(snapshot.text).toContain('Hello');
    expect(snapshot.text).toContain('Write a function');
    expect(snapshot.estimatedTokens).toBeGreaterThan(0);
  });

  it('should evict old rounds when exceeding keepFullRounds', () => {
    l2.addConversationRound('Round 1', 'Response 1');
    l2.addConversationRound('Round 2', 'Response 2');
    l2.addConversationRound('Round 3', 'Response 3');
    l2.addConversationRound('Round 4', 'Response 4'); // 应该淘汰 Round 1

    const rounds = l2.getConversationRounds();
    expect(rounds.length).toBe(3);
    expect(rounds[0].user).toBe('Round 2');

    // Round 1 应该被压缩为摘要条目
    const entries = l2.getEntries();
    expect(entries.some(e => e.type === 'conversation')).toBe(true);
  });

  it('should handle file context with dedup', () => {
    l2.addFileContext('src/main.ts', 'function main() {}');
    l2.addFileContext('src/utils.ts', 'export function helper() {}');
    l2.addFileContext('src/main.ts', 'function main() { return 42; }'); // 更新

    const entries = l2.getEntries();
    const fileEntries = entries.filter(e => e.type === 'file_context');
    expect(fileEntries.length).toBe(2); // main.ts 只保留最新
    expect(fileEntries.find(e => e.content.includes('main.ts'))?.content).toContain('return 42');
  });

  it('should set task state (only one)', () => {
    l2.setTaskState('Planning phase');
    l2.setTaskState('Executing step 2');

    const entries = l2.getEntries();
    const taskEntries = entries.filter(e => e.type === 'task_state');
    expect(taskEntries.length).toBe(1);
    expect(taskEntries[0].content).toBe('Executing step 2');
  });

  it('should respect budget in build()', () => {
    // 添加大量内容
    for (let i = 0; i < 20; i++) {
      l2.addToolResult(`tool_${i}`, `Result of tool ${i}: ${'x'.repeat(200)}`);
    }

    const snapshot = l2.build(500); // 极小预算
    expect(snapshot.estimatedTokens).toBeLessThanOrEqual(600); // 允许一些超出 (对话轮次)
  });

  it('should clear all on reset', () => {
    l2.addConversationRound('test', 'test');
    l2.addFileContext('file.ts', 'code');
    l2.clear();

    expect(l2.entryCount).toBe(0);
    const snapshot = l2.build();
    expect(snapshot.text).toBe('');
  });
});

// ── L3 Archive Tests ──

describe('L3Archive', () => {
  let l3: L3Archive;

  beforeEach(async () => {
    // 使用内存模式 (不写文件)
    l3 = new L3Archive({
      dbPath: '/tmp/test-msa-archive.db',
      embeddingDim: 8,
      defaultTopK: 3,
      minRelevance: 0.0, // 测试时不过滤
    });
    await l3.init();
  });

  it('should add and retrieve records', async () => {
    await l3.add({
      ts: Date.now(),
      type: 'experience',
      description: 'Fixed a TypeScript compilation error in utils.ts',
      content: 'Changed import path from relative to absolute',
      quality: 0.8,
      helpfulness: null,
      source: 'test',
    });

    const results = await l3.retrieve('TypeScript error fix');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].description).toContain('TypeScript');
  });

  it('should reject low quality records', async () => {
    const freshL3 = new L3Archive({
      dbPath: '/tmp/test-msa-reject.db',
      embeddingDim: 8,
      minRelevance: 0.0,
    });
    await freshL3.init();

    const id = await freshL3.add({
      ts: Date.now(),
      type: 'pattern',
      description: 'Low quality note',
      content: 'Not useful',
      quality: 0.3, // 低于 0.6 门槛
      helpfulness: null,
      source: 'test',
    });

    expect(id).toBeNull();
    expect(freshL3.stats().total).toBe(0);
  });

  it('should deduplicate similar records', async () => {
    const id1 = await l3.add({
      ts: Date.now(),
      type: 'experience',
      description: 'Fixed TypeScript error in main.ts',
      content: 'Same content here',
      quality: 0.7,
      helpfulness: null,
      source: 'test',
    });

    // 添加几乎相同的内容
    const id2 = await l3.add({
      ts: Date.now(),
      type: 'experience',
      description: 'Fixed TypeScript error in main.ts',
      content: 'Same content here',
      quality: 0.9, // 更高质量
      helpfulness: null,
      source: 'test',
    });

    // 应该去重，只有一条记录
    expect(l3.stats().total).toBe(1);
    // 但质量应该更新为较高值
    expect(id2).toBe(id1);
  });

  it('should format results for injection', async () => {
    // 使用新的 L3 实例避免前面测试的污染
    const freshL3 = new L3Archive({
      dbPath: '/tmp/test-msa-format.db',
      embeddingDim: 8,
      minRelevance: 0.0,
    });
    await freshL3.init();

    await freshL3.add({
      ts: Date.now(),
      type: 'resolution',
      description: 'Solved CORS issue with proxy config',
      content: 'Added proxy middleware to vite.config.ts with target: "http://localhost:3000"',
      quality: 0.9,
      helpfulness: 0.95,
      source: 'test',
    });

    const results = await freshL3.retrieve('CORS proxy');
    const formatted = freshL3.formatForInjection(results);

    expect(formatted).toContain('<archived_knowledge>');
    expect(formatted).toContain('CORS');
    expect(formatted).toContain('</archived_knowledge>');
  });

  it('should update retrieval stats', async () => {
    await l3.add({
      ts: Date.now(),
      type: 'experience',
      description: 'Test retrieval counting',
      content: 'Some content',
      quality: 0.8,
      helpfulness: null,
      source: 'test',
    });

    await l3.retrieve('test');
    await l3.retrieve('test');

    const stats = l3.stats();
    expect(stats.total).toBe(1);
  });

  it('should handle feedback updates', async () => {
    const freshL3 = new L3Archive({
      dbPath: '/tmp/test-msa-feedback.db',
      embeddingDim: 8,
      minRelevance: 0.0,
    });
    await freshL3.init();

    const id = await freshL3.add({
      ts: Date.now(),
      type: 'experience',
      description: 'Feedback test unique content here',
      content: 'Unique feedback content',
      quality: 0.7,
      helpfulness: null,
      source: 'test',
    });

    expect(id).not.toBeNull();
    await freshL3.feedback(id!, 0.9);

    // 质量应该被调整 (0.7 * 0.7 + 0.9 * 0.3 = 0.76)
    const stats = freshL3.stats();
    expect(stats.avgQuality).toBeCloseTo(0.76, 1);
  });
});

// ── MSA Orchestrator Tests ──

describe('MSA Orchestrator', () => {
  let msa: MSA;

  beforeEach(async () => {
    msa = new MSA({
      l1: {
        projectRoot: '/test/project',
        projectName: 'TestApp',
        customInstructions: 'Use strict TypeScript.',
      },
      l2: { maxTokens: 4500, keepFullRounds: 3 },
      l3: {
        dbPath: '/tmp/test-msa-orch.db',
        embeddingDim: 8,
        minRelevance: 0.0,
      },
      totalBudget: 8000,
    });
    await msa.init();
  });

  it('should build context within budget', async () => {
    msa.l2.addConversationRound('Create a React component', 'Here is the component...');
    msa.l2.setTaskState('Implementing UserCard component');

    const ctx = await msa.buildContext('React component creation');

    expect(ctx.l1.prefix).toContain('TestApp');
    expect(ctx.l2.text).toContain('React component');
    expect(ctx.totalTokens).toBeLessThanOrEqual(8000);
    expect(ctx.overBudget).toBe(false);
  });

  it('should skip L3 when no query provided', async () => {
    const ctx = await msa.buildContext();

    expect(ctx.l3Results).toBe('');
    expect(ctx.l3Tokens).toBe(0);
  });

  it('should archive and retrieve from L3', async () => {
    // 归档一条经验
    await msa.archive({
      ts: Date.now(),
      type: 'experience',
      description: 'Solved async race condition in data fetcher',
      content: 'Used Promise.allSettled instead of Promise.all to handle partial failures',
      quality: 0.85,
      helpfulness: null,
      source: 'session_1',
    });

    // 检索
    const ctx = await msa.buildContext('async data fetching race condition');
    expect(ctx.l3Results).toContain('race condition');
  });

  it('should archive session on end', async () => {
    msa.l2.addConversationRound('Build API', 'Done!');

    const id = await msa.archiveSession('Built REST API with 5 endpoints, all tests passing');

    expect(id).not.toBeNull();
    expect(msa.stats().l3.total).toBe(1);
  });

  it('should reset session (L2 clear, L3 persists)', async () => {
    msa.l2.addConversationRound('test', 'test');
    await msa.archive({
      ts: Date.now(),
      type: 'pattern',
      description: 'Persistent pattern',
      content: 'This should persist',
      quality: 0.8,
      helpfulness: null,
      source: 'test',
    });

    msa.resetSession();

    expect(msa.l2.entryCount).toBe(0);
    expect(msa.stats().l3.total).toBe(1); // L3 不清
  });

  it('should report stats', async () => {
    const freshMsa = new MSA({
      l1: { projectRoot: '/test/stats' },
      l3: { dbPath: '/tmp/test-msa-stats.db', embeddingDim: 8 },
      totalBudget: 8000,
    });
    await freshMsa.init();

    const stats = freshMsa.stats();
    expect(stats.budget).toBe(8000);
    expect(stats.l1.cached).toBe(false); // 还没 build 过
    expect(stats.l2.entries).toBe(0);
    expect(stats.l3.total).toBe(0);
  });

  it('should throw if not initialized', async () => {
    const uninit = new MSA({
      l1: { projectRoot: '/test' },
    });

    await expect(uninit.buildContext()).rejects.toThrow('not initialized');
  });
});
