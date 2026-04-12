/**
 * R5-35 Live A/B harness — G4 checker
 * bun run scripts/distill/g4-check-r35.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const { runAb } = await import(resolve(ROOT, 'src/services/eval/ab'));
  let p = 0, f = 0;
  const ck = (id: string, ok: boolean, m = '') => { if (ok) { console.log(`  ✅ ${id}`); p++; } else { console.log(`  ❌ ${id}: ${m}`); f++; } };

  // DSxu wins
  const r1 = await runAb('M2', ['t1', 't2', 't3'], {
    mockDsxuRunner: async (id) => ({ score: 90, patch: 'fix', durationMs: 1000, tokens: 500, cost: 0.01 }),
    mockOpusRunner: async (id) => ({ score: 80, patch: 'fix', durationMs: 2000, tokens: 800, cost: 0.05 }),
  });
  ck('ab-01', r1.dsxuWins === 3, `dsxu should win all 3, got ${r1.dsxuWins}`);
  ck('ab-02', r1.opusWins === 0, 'opus should win 0');
  ck('ab-03', r1.weightedGap < 0, `gap should be negative (dsxu ahead), got ${r1.weightedGap}`);
  ck('ab-04', r1.milestone === 'M2', 'milestone should be M2');
  ck('ab-05', r1.totalTasks === 3, 'total should be 3');

  // Opus wins
  const r2 = await runAb('M3', ['t1', 't2'], {
    mockDsxuRunner: async () => ({ score: 60, patch: '', durationMs: 5000, tokens: 1000, cost: 0.02 }),
    mockOpusRunner: async () => ({ score: 95, patch: 'better', durationMs: 3000, tokens: 600, cost: 0.08 }),
  });
  ck('ab-06', r2.opusWins === 2, `opus should win 2, got ${r2.opusWins}`);
  ck('ab-07', r2.weightedGap > 0, `gap should be positive (opus ahead), got ${r2.weightedGap}`);

  // Tie
  const r3 = await runAb('M4', ['t1'], {
    mockDsxuRunner: async () => ({ score: 85, patch: 'a', durationMs: 1000, tokens: 500, cost: 0.01 }),
    mockOpusRunner: async () => ({ score: 85, patch: 'b', durationMs: 2000, tokens: 500, cost: 0.05 }),
  });
  ck('ab-08', r3.ties === 1, 'should be a tie');
  ck('ab-09', r3.weightedGap === 0, `gap should be 0 for tie, got ${r3.weightedGap}`);

  // Empty tasks
  const r4 = await runAb('M5', [], {});
  ck('ab-10', r4.totalTasks === 0, 'empty tasks should have 0 total');
  ck('ab-11', typeof r4.generatedAt === 'string', 'should have generatedAt');

  console.log(`\n  R5-35 G4: ${p}/${p + f} passed\n`);
  process.exit(f > 0 ? 1 : 0);
}
main();
