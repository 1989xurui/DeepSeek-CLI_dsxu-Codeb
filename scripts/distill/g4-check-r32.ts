/**
 * R5-32 MCP adapters — G4 checker
 * bun run scripts/distill/g4-check-r32.ts
 */
import { resolve } from 'path';
const ROOT = resolve(import.meta.dir, '..', '..');

async function main() {
  const { createAllAdapters, FilesystemAdapter, GitAdapter } = await import(resolve(ROOT, 'src/services/mcp/adapters'));
  let p = 0, f = 0;
  const ck = (id: string, ok: boolean, m = '') => { if (ok) { console.log(`  ✅ ${id}`); p++; } else { console.log(`  ❌ ${id}: ${m}`); f++; } };

  const mockConfig = {
    mockInvoke: async (tool: string, args: any) => ({ tool, args, result: 'mock' }),
    mockHealthCheck: async () => true,
  };

  // createAllAdapters
  const adapters = createAllAdapters(mockConfig);
  ck('all-01', adapters.length === 5, `should have 5 adapters, got ${adapters.length}`);
  ck('all-02', adapters.map(a => a.name).includes('filesystem'), 'should have filesystem');
  ck('all-03', adapters.map(a => a.name).includes('github'), 'should have github');

  // listTools
  for (const adapter of adapters) {
    const tools = await adapter.listTools();
    ck(`tools-${adapter.name}`, tools.length >= 3, `${adapter.name} should have >=3 tools, got ${tools.length}`);
  }

  // healthCheck
  for (const adapter of adapters) {
    const healthy = await adapter.healthCheck();
    ck(`health-${adapter.name}`, healthy === true, `${adapter.name} mock health should be true`);
  }

  // invoke
  const fs = new FilesystemAdapter(mockConfig);
  const r1 = await fs.invoke('read', { path: 'test.ts' });
  ck('invoke-01', r1.tool === 'read', 'should invoke read');

  const git = new GitAdapter(mockConfig);
  const r2 = await git.invoke('log', { n: 5 });
  ck('invoke-02', r2.tool === 'log', 'should invoke log');

  console.log(`\n  R5-32 G4: ${p}/${p + f} passed\n`);
  process.exit(f > 0 ? 1 : 0);
}
main();
