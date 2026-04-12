/**
 * DSxu Self-Tuning Hook Framework — bun:test
 */
import { describe, test, expect } from 'bun:test';
import { HookRegistry, createPlaceholderHooks, type TuningHook } from '../index';

describe('HookRegistry', () => {
  test('register and list', () => {
    const registry = new HookRegistry();
    const hook: TuningHook = {
      id: 'test-hook',
      phase: 'post-eval',
      priority: 10,
      enabled: true,
      execute: async () => ({ hookId: 'test-hook', action: 'noop' }),
    };
    registry.register(hook);
    expect(registry.list('post-eval')).toHaveLength(1);
  });

  test('unregister removes hook', () => {
    const registry = new HookRegistry();
    registry.register({
      id: 'remove-me', phase: 'post-eval', priority: 1, enabled: true,
      execute: async () => ({ hookId: 'remove-me', action: 'noop' }),
    });
    registry.unregister('remove-me');
    expect(registry.list('post-eval')).toHaveLength(0);
  });

  test('trigger executes enabled hooks in priority order', async () => {
    const registry = new HookRegistry();
    const order: string[] = [];
    registry.register({
      id: 'second', phase: 'post-eval', priority: 20, enabled: true,
      execute: async () => { order.push('second'); return { hookId: 'second', action: 'noop' }; },
    });
    registry.register({
      id: 'first', phase: 'post-eval', priority: 10, enabled: true,
      execute: async () => { order.push('first'); return { hookId: 'first', action: 'noop' }; },
    });
    await registry.trigger('post-eval', {});
    expect(order).toEqual(['first', 'second']);
  });

  test('trigger skips disabled hooks', async () => {
    const registry = new HookRegistry();
    registry.register({
      id: 'disabled', phase: 'post-eval', priority: 1, enabled: false,
      execute: async () => { throw new Error('should not run'); },
    });
    const results = await registry.trigger('post-eval', {});
    expect(results).toHaveLength(0);
  });

  test('trigger catches errors and returns alert', async () => {
    const registry = new HookRegistry();
    registry.register({
      id: 'broken', phase: 'post-eval', priority: 1, enabled: true,
      execute: async () => { throw new Error('boom'); },
    });
    const results = await registry.trigger('post-eval', {});
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe('alert');
    expect(results[0].message).toContain('boom');
  });

  test('clear removes all hooks', () => {
    const registry = new HookRegistry();
    registry.register({
      id: 'a', phase: 'post-eval', priority: 1, enabled: true,
      execute: async () => ({ hookId: 'a', action: 'noop' }),
    });
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});

describe('createPlaceholderHooks', () => {
  test('returns 4 placeholder hooks', () => {
    const hooks = createPlaceholderHooks();
    expect(hooks).toHaveLength(4);
  });

  test('all placeholders are disabled', () => {
    const hooks = createPlaceholderHooks();
    for (const h of hooks) {
      expect(h.enabled).toBe(false);
    }
  });

  test('placeholder IDs are unique', () => {
    const hooks = createPlaceholderHooks();
    const ids = hooks.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
