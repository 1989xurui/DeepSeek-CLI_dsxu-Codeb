import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../../src/constants/prompts';
import { collectCacheRealityRun } from '../dsxu-cache-reality-run';

function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'dsxu-cache-reality-run-'));
}

describe('cache reality run', () => {
  test('writes a raw local prefix export plus a hash-only public report', async () => {
    const root = makeTempRoot();
    try {
      const rawPrefixExportPath = join(root, '.dsxu', 'trace', 'cache-prefix-export.json');
      const publicReportPath = join(root, 'docs', 'generated', 'cache-reality.json');
      const report = await collectCacheRealityRun({
        rawPrefixExportPath,
        publicReportPath,
        systemPromptSections: [
          '# DSXU Code Prompt Profile',
          '# DSXU DeepSeek Tool-Use Contract',
          '# DSXU Prompt Governance Contract',
          SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
          'Primary working directory: D:/DSXU-code',
        ],
      });

      expect(report.status).toBe('PASS_CACHE_REALITY_DRY_RUN');
      expect(report.prefix.boundaryFound).toBe(true);
      expect(report.prefix.stablePrefixHash).toEqual(expect.any(String));
      expect(report.redaction.publicReportHashOnly).toBe(true);
      expect(report.liveAb.didCallProvider).toBe(false);
      expect(report.publicClaimAllowed).toBe(false);
      expect(existsSync(rawPrefixExportPath)).toBe(true);
      expect(existsSync(publicReportPath)).toBe(true);

      const rawPrefixExport = readFileSync(rawPrefixExportPath, 'utf8');
      const publicReport = readFileSync(publicReportPath, 'utf8');
      expect(rawPrefixExport).toContain('DSXU Prompt Governance Contract');
      expect(publicReport).not.toContain('DSXU Prompt Governance Contract');
      expect(publicReport).not.toContain('DSXU DeepSeek Tool-Use Contract');
      expect(publicReport).not.toContain('Primary working directory');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks reports when the prompt boundary is missing', async () => {
    const root = makeTempRoot();
    try {
      const report = await collectCacheRealityRun({
        rawPrefixExportPath: join(root, '.dsxu', 'trace', 'cache-prefix-export.json'),
        publicReportPath: join(root, 'docs', 'generated', 'cache-reality.json'),
        systemPromptSections: ['# DSXU Prompt Governance Contract'],
      });

      expect(report.status).toBe('BLOCKED_CACHE_REALITY_RUN');
      expect(report.blockers).toContain('SYSTEM_PROMPT_DYNAMIC_BOUNDARY missing');
      expect(report.blockers).toContain('stable prefix is empty');
      expect(report.prefix.stablePrefixHash).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('can pass live mode with mocked provider cache improvement', async () => {
    const root = makeTempRoot();
    try {
      let calls = 0;
      const report = await collectCacheRealityRun({
        rawPrefixExportPath: join(root, '.dsxu', 'trace', 'cache-prefix-export.json'),
        publicReportPath: join(root, 'docs', 'generated', 'cache-reality.json'),
        executeLive: true,
        systemPromptSections: [
          'stable rules '.repeat(256),
          SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
          'Primary working directory: D:/DSXU-code',
        ],
        fetchImpl: (async () => {
          calls += 1;
          const hit = calls === 1 ? 0 : 800;
          const miss = calls === 1 ? 1000 : 200;
          return new Response(JSON.stringify({
            choices: [{ message: { content: 'OK' } }],
            usage: {
              prompt_tokens: hit + miss,
              completion_tokens: 1,
              prompt_cache_hit_tokens: hit,
              prompt_cache_miss_tokens: miss,
            },
          }), { status: 200 });
        }) as typeof fetch,
      });

      expect(report.status).toBe('PASS_CACHE_REALITY_LIVE');
      expect(report.liveAb.didCallProvider).toBe(true);
      expect(report.liveAb.hitRateDeltaPct).toBeGreaterThan(0);
      expect(report.blockers).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('does not leak DSXU_CODE_MODE when it builds the runtime prompt itself', async () => {
    const root = makeTempRoot();
    const originalMode = process.env.DSXU_CODE_MODE;
    try {
      delete process.env.DSXU_CODE_MODE;
      const report = await collectCacheRealityRun({
        rawPrefixExportPath: join(root, '.dsxu', 'trace', 'cache-prefix-export.json'),
        publicReportPath: join(root, 'docs', 'generated', 'cache-reality.json'),
      });

      expect(report.status).toBe('PASS_CACHE_REALITY_DRY_RUN');
      expect(process.env.DSXU_CODE_MODE).toBeUndefined();
    } finally {
      if (originalMode === undefined) delete process.env.DSXU_CODE_MODE;
      else process.env.DSXU_CODE_MODE = originalMode;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
