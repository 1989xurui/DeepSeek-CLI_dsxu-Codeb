/**
 * DSxu 自调优 Hook 框架
 *
 * 定义接口 + 注册机制。实际调优逻辑由本地 AI 实现。
 * 这里只是 "骨架"：
 * - TuningHook 接口
 * - HookRegistry 注册/触发
 * - 预置 hook 占位符
 *
 * 用法:
 *   const registry = new HookRegistry();
 *   registry.register('post-eval', myHook);
 *   await registry.trigger('post-eval', { evalResult });
 */

// ── 接口 ──

export type HookPhase =
  | 'pre-plan'       // DAG 规划前
  | 'post-plan'      // DAG 规划后
  | 'pre-execute'    // 节点执行前
  | 'post-execute'   // 节点执行后
  | 'post-eval'      // G1-G4 评估后
  | 'post-ab'        // A/B 对照后
  | 'post-incident'  // HITL 事件后
  | 'periodic';      // 定期触发

export interface TuningHook {
  id: string;
  phase: HookPhase;
  /** 优先级，越小越先执行 */
  priority: number;
  /** 执行 hook */
  execute: (context: HookContext) => Promise<HookResult>;
  /** 是否启用 */
  enabled: boolean;
}

export interface HookContext {
  phase: HookPhase;
  timestamp: number;
  data: Record<string, any>;
  /** 前序 hook 的结果 */
  previousResults?: HookResult[];
}

export interface HookResult {
  hookId: string;
  action: 'noop' | 'adjust' | 'alert' | 'retrain';
  adjustments?: Record<string, any>;
  message?: string;
}

// ── Registry ──

export class HookRegistry {
  private hooks: Map<HookPhase, TuningHook[]> = new Map();

  register(hook: TuningHook): void {
    const list = this.hooks.get(hook.phase) ?? [];
    list.push(hook);
    list.sort((a, b) => a.priority - b.priority);
    this.hooks.set(hook.phase, list);
  }

  unregister(hookId: string): void {
    for (const [phase, list] of this.hooks) {
      this.hooks.set(phase, list.filter(h => h.id !== hookId));
    }
  }

  async trigger(phase: HookPhase, data: Record<string, any>): Promise<HookResult[]> {
    const list = (this.hooks.get(phase) ?? []).filter(h => h.enabled);
    const results: HookResult[] = [];

    for (const hook of list) {
      const ctx: HookContext = {
        phase,
        timestamp: Date.now(),
        data,
        previousResults: [...results],
      };
      try {
        const r = await hook.execute(ctx);
        results.push(r);
      } catch (err: any) {
        results.push({
          hookId: hook.id,
          action: 'alert',
          message: `Hook error: ${err.message}`,
        });
      }
    }

    return results;
  }

  list(phase?: HookPhase): TuningHook[] {
    if (phase) return this.hooks.get(phase) ?? [];
    return Array.from(this.hooks.values()).flat();
  }

  clear(): void {
    this.hooks.clear();
  }
}

// ── 预置 hook 占位符（本地 AI 实现具体逻辑）──

export function createPlaceholderHooks(): TuningHook[] {
  return [
    {
      id: 'temperature-adjuster',
      phase: 'post-eval',
      priority: 10,
      enabled: false, // 本地 AI 启用
      execute: async (ctx) => ({
        hookId: 'temperature-adjuster',
        action: 'noop' as const,
        message: 'Placeholder: adjust temperature based on eval score',
      }),
    },
    {
      id: 'prompt-cache-optimizer',
      phase: 'post-execute',
      priority: 20,
      enabled: false,
      execute: async (ctx) => ({
        hookId: 'prompt-cache-optimizer',
        action: 'noop' as const,
        message: 'Placeholder: optimize prompt caching strategy',
      }),
    },
    {
      id: 'cost-budget-monitor',
      phase: 'post-execute',
      priority: 5,
      enabled: false,
      execute: async (ctx) => ({
        hookId: 'cost-budget-monitor',
        action: 'noop' as const,
        message: 'Placeholder: monitor cost against budget',
      }),
    },
    {
      id: 'ab-gap-tracker',
      phase: 'post-ab',
      priority: 10,
      enabled: false,
      execute: async (ctx) => ({
        hookId: 'ab-gap-tracker',
        action: 'noop' as const,
        message: 'Placeholder: track A/B gap trend and alert on regression',
      }),
    },
  ];
}
