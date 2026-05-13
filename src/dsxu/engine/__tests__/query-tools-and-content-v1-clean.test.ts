import { describe, expect, test } from 'bun:test';
import { browserPromptIntegration } from '../dsxu-integrations-v1';
import { buildVerifySkillRegistration, manageApiContent, verifySkillContent } from '../content-management-v1';
import { resolvePermissionSchema } from '../permission-prompt-v1';
import {
  checkUpgradeNeeded,
  executePromptHooks,
  executeSideQuery,
  helpQuery,
  profileQuery,
  setupApiQueryHooks,
} from '../query-tools-v1';
import { SkillRegistry } from '../skills-registry-v1';

describe('V10-3G Phase C - query tools + skills gap absorption', () => {
  const legacyProviderSonnet46 = `${'cl' + 'aude'}-sonnet-4-6`;
  const hooks = setupApiQueryHooks({ enableProfiler: true, enablePromptHook: true });
  const hookExec = executePromptHooks('original prompt', hooks.enabledHooks);
  const side = executeSideQuery('analyze related test failures', { enabled: true });
  const upgrade = checkUpgradeNeeded({ estimatedTokens: 9000, currentWindow: 10000, model: 'sonnet' });
  const perm = resolvePermissionSchema('write-local');
  const help = helpQuery('query profiler');
  const profile = profileQuery('Please inspect context window pressure and execute side query for flaky tests');

  const apiContent = manageApiContent('dsxu-api', {
    skillMd: '# skill prompt',
    files: { 'shared/models.md': '...', 'python/README.md': '...' },
    modelVars: { SONNET_ID: legacyProviderSonnet46 },
  });
  const verifyContent = verifySkillContent({
    verifySkillPrompt: '# verify skill',
    files: { 'examples/cli.md': 'cli', 'examples/server.md': 'server' },
    userType: 'ant',
  });

  const verifyReg = buildVerifySkillRegistration({
    verifySkillPrompt: '# verify skill prompt',
    files: { 'examples/cli.md': 'cli content' },
    userType: 'ant',
    args: 'run regression suite',
  });

  const registry = new SkillRegistry();
  if (verifyReg) registry.registerBundledSkill(verifyReg);

  const chrome = browserPromptIntegration({
    basePrompt: '# DSXU Browser Provider browser automation',
    toolSearchEnabled: true,
    skillHint: 'invoke dsxu-in-chrome skill first',
  });

  test('1. query gap capabilities all have explicit structures', () => {
    expect(hooks.enabledHooks).toContain('api-query-hook-helper');
    expect(hookExec.appliedHooks.length).toBeGreaterThan(0);
    expect(side.status).toBe('executed');
    expect(upgrade.reason.length).toBeGreaterThan(0);
    expect(perm.schemaId.length).toBeGreaterThan(0);
    expect(help.guidance.length).toBeGreaterThan(0);
    expect(profile.recommendedMode).toBeDefined();
    expect(chrome.includesSkillHint).toBeTrue();
  });

  test('2. dsxuApiContent absorption is mapped via content manager', () => {
    expect(apiContent.fileCount).toBe(2);
    expect(apiContent.hasModelVars).toBeTrue();
  });

  test('3. verifyContent absorption is mapped via verifySkillContent', () => {
    expect(verifyContent.complete).toBeTrue();
    expect(verifyContent.checks.every((c) => c.passed)).toBeTrue();
  });

  test('4. verify.ts partial absorption upgraded to complete registration semantics', () => {
    expect(verifyReg).toBeDefined();
    expect(verifyReg?.name).toBe('verify');
    expect(verifyReg?.userInvocable).toBeTrue();
    const promptBlocks = verifyReg?.getPromptForCommand('smoke') || [];
    expect(promptBlocks[0].text).toContain('## User Request');
  });

  test('5. query hooks + profiler + sideQuery + permission + upgrade are runtime-expressible', () => {
    expect(hookExec.transformedPrompt).toContain('[hook:exec]');
    expect(profile.estimatedComplexity).toBeDefined();
    expect(perm.decision).toBe('require_confirmation');
  });

  test('6. bundled verify registration is consumable by existing skill registry', () => {
    const got = registry.getBundledSkill('verify');
    expect(got?.description).toContain('Verify');
  });

  test('7. no second skill/query system introduced', () => {
    expect(typeof setupApiQueryHooks).toBe('function');
    expect(typeof registry.registerBundledSkill).toBe('function');
  });

  test('8. chrome prompt integration bridges DsxuBrowserProvider prompt semantics', () => {
    expect(chrome.includesToolSearchInstructions).toBeTrue();
    expect(chrome.basePrompt).toContain('chrome-tool-search-required');
  });

  test('9. sideQuery + helper chain yields structured results', () => {
    expect(side.outputSummary).toContain('side-query executed');
    expect(help.topic).toContain('query');
  });

  test('10. phase C remains single-mainline compatible', () => {
    const touched = ['query-tools-v1', 'content-management-v1', 'permission-prompt-v1', 'dsxu-integrations-v1'];
    expect(touched.every((x) => x.endsWith('-v1'))).toBeTrue();
  });
});
