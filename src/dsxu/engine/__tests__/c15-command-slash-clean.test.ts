import { describe, expect, test } from 'bun:test';
import {
  executeSlashCommand,
  getRegisteredCommands,
  isSlashCommand,
  parseSlashCommand,
} from '../slash-commands';

describe('C15 command/slash clean', () => {
  const context = {
    messages: [{ role: 'system', content: 'base' }, { role: 'user', content: 'hi' }] as any[],
    gear: 2,
    toolNames: ['Read', 'Edit'],
    sessionId: 'c15-session',
    cwd: 'D:/DSXU-code',
    callbacks: {
      setGear: () => {},
      compact: async () => ({ wasCompacted: true }),
      getCost: () => 'cost: 1.23',
      getDebugInfo: () => 'debug info',
      exit: () => {},
    },
  };

  test('1. slash command detection and parse are executable', () => {
    expect(isSlashCommand('/help')).toBeTrue();
    const parsed = parseSlashCommand('/gear 3');
    expect(parsed?.name).toBe('gear');
    expect(parsed?.args).toBe('3');
  });

  test('2. built-in slash command executes structured result', async () => {
    const result = await executeSlashCommand('/tools', context);
    expect(result).not.toBeNull();
    expect(result?.continueChat).toBeFalse();
    expect(result?.output).toContain('Available tools');
  });

  test('3. slash command can mutate context when needed', async () => {
    const before = context.messages.length;
    const result = await executeSlashCommand('/clear', context);
    expect(result?.contextModified).toBeTrue();
    expect(context.messages.length).toBeLessThan(before);
  });

  test('4. command registry is available for mainline usage', () => {
    const cmds = getRegisteredCommands();
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds.some((x) => x.name === 'help')).toBeTrue();
  });
});
