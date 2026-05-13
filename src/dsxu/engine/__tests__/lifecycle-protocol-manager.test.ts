import { describe, it, expect, beforeEach } from 'vitest';
import {
  LifecycleProtocolManagerImpl,
  DEFAULT_LIFECYCLE_PROTOCOL,
  createLifecycleProtocolManager
} from '../lifecycle-protocol-manager';

describe('LifecycleProtocolManager', () => {
  let manager: LifecycleProtocolManagerImpl;

  beforeEach(() => {
    manager = new LifecycleProtocolManagerImpl();
  });

  describe('protocol management', () => {
    it('should register default protocol on initialization', () => {
      const protocols = manager.listProtocols();
      expect(protocols).toHaveLength(1);
      expect(protocols[0].name).toBe('default');
    });

    it('should register custom protocol', () => {
      const customProtocol = {
        ...DEFAULT_LIFECYCLE_PROTOCOL,
        name: 'custom-protocol',
        version: '2.0.0'
      };

      manager.registerProtocol(customProtocol);

      const protocol = manager.getProtocol('custom-protocol');
      expect(protocol).toBeDefined();
      expect(protocol?.name).toBe('custom-protocol');
      expect(protocol?.version).toBe('2.0.0');
    });

    it('should list all registered protocols', () => {
      const customProtocol = {
        ...DEFAULT_LIFECYCLE_PROTOCOL,
        name: 'custom-protocol'
      };

      manager.registerProtocol(customProtocol);

      const protocols = manager.listProtocols();
      expect(protocols).toHaveLength(2);
      expect(protocols.map(p => p.name)).toContain('default');
      expect(protocols.map(p => p.name)).toContain('custom-protocol');
    });
  });

  describe('state management', () => {
    it('should get current state', () => {
      const state = manager.getCurrentState('default');
      expect(state).toBe('initialized');
    });

    it('should transition between valid states', () => {
      // 从 initialized 到 planning
      expect(manager.transitionTo('default', 'planning')).toBe(true);
      expect(manager.getCurrentState('default')).toBe('planning');

      // 从 planning 到 executing
      expect(manager.transitionTo('default', 'executing')).toBe(true);
      expect(manager.getCurrentState('default')).toBe('executing');
    });

    it('should reject invalid transitions', () => {
      // 从 initialized 不能直接到 executing
      expect(manager.transitionTo('default', 'executing')).toBe(false);
      expect(manager.getCurrentState('default')).toBe('initialized');
    });

    it('should check if transition is possible', () => {
      expect(manager.canTransition('default', 'planning')).toBe(true);
      expect(manager.canTransition('default', 'executing')).toBe(false);
    });
  });

  describe('checkpoint management', () => {
    it('should validate checkpoints in correct state', () => {
      // 在 initialized 状态，没有检查点
      expect(manager.getCheckpoints('default')).toHaveLength(0);

      // 过渡到 planning 状态
      manager.transitionTo('default', 'planning');

      const checkpoints = manager.getCheckpoints('default');
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].name).toBe('planning-complete');
    });

    it('should validate checkpoint', () => {
      manager.transitionTo('default', 'planning');

      expect(manager.validateCheckpoint('default', 'planning-complete')).toBe(true);
    });

    it('should reject checkpoint validation in wrong state', () => {
      // 在 initialized 状态尝试验证 planning-complete 检查点
      expect(manager.validateCheckpoint('default', 'planning-complete')).toBe(false);
    });
  });

  describe('recovery strategies', () => {
    it('should get applicable recovery strategies', () => {
      // 在 failed 状态
      manager.transitionTo('default', 'failed');

      const strategies = manager.getRecoveryStrategies('default', 'failed');
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.map(s => s.name)).toContain('retry-execution');
    });

    it('should apply recovery strategy', () => {
      manager.transitionTo('default', 'failed');

      expect(manager.applyRecovery('default', 'retry-execution')).toBe(true);
    });

    it('should reject inapplicable recovery strategy', () => {
      // 在 initialized 状态尝试应用恢复策略
      expect(manager.applyRecovery('default', 'retry-execution')).toBe(false);
    });
  });

  describe('metrics collection', () => {
    it('should collect initial metrics', () => {
      const metrics = manager.collectMetrics('default');

      expect(metrics).toMatchObject({
        branchSuccessRate: 0,
        escalationFrequency: 0,
        recoverySuccessRate: 0,
        totalBranches: 0,
        completedBranches: 0,
        failedBranches: 0,
        escalations: 0,
        recoveries: 0
      });
    });

    it('should update metrics', () => {
      manager.updateMetrics('default', {
        totalBranches: 10,
        completedBranches: 8,
        failedBranches: 2
      });

      const metrics = manager.collectMetrics('default');

      expect(metrics.totalBranches).toBe(10);
      expect(metrics.completedBranches).toBe(8);
      expect(metrics.failedBranches).toBe(2);
      expect(metrics.branchSuccessRate).toBe(80); // 8/10 * 100
    });

    it('should calculate success rates', () => {
      manager.updateMetrics('default', {
        totalBranches: 20,
        completedBranches: 18,
        escalations: 2,
        recoveries: 1
      });

      const metrics = manager.collectMetrics('default');

      expect(metrics.branchSuccessRate).toBe(90); // 18/20 * 100
      expect(metrics.escalationFrequency).toBe(10); // 2/20 * 100
      expect(metrics.recoverySuccessRate).toBe(100); // 简化计算
    });
  });

  describe('factory function', () => {
    it('should create manager via factory function', () => {
      const manager = createLifecycleProtocolManager();
      expect(manager).toBeDefined();
      expect(manager.listProtocols()).toHaveLength(1);
    });
  });
});
