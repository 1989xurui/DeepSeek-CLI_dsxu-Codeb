import { describe, it, expect } from 'bun:test'
import {
  RUNTIME_STATES,
  STATE_DESCRIPTIONS,
  STATE_TRANSITIONS,
  MAIN_CHAIN_TRANSITIONS,
  FAILURE_TRANSITIONS,
  isValidTransition,
  isMainChainTransition,
  isFailureTransition,
  getAllowedNextStates,
  getMainChainNextState,
  getFailureStates,
  createInitialState,
  createStateTransition,
} from '../../runtime-state-machine'
import type { RuntimeState } from '../../types'

describe('Runtime State Machine', () => {
  describe('1. 状态集合存在', () => {
    it('应该包含所有8个状态', () => {
      expect(RUNTIME_STATES.PLAN).toBe('plan')
      expect(RUNTIME_STATES.RETRIEVE).toBe('retrieve')
      expect(RUNTIME_STATES.EDIT).toBe('edit')
      expect(RUNTIME_STATES.EXECUTE).toBe('execute')
      expect(RUNTIME_STATES.VERIFY).toBe('verify')
      expect(RUNTIME_STATES.REVIEW).toBe('review')
      expect(RUNTIME_STATES.COMMIT).toBe('commit')
      expect(RUNTIME_STATES.ROLLBACK).toBe('rollback')
    })

    it('应该有状态描述', () => {
      expect(STATE_DESCRIPTIONS.plan).toBeDefined()
      expect(STATE_DESCRIPTIONS.retrieve).toBeDefined()
      expect(STATE_DESCRIPTIONS.edit).toBeDefined()
      expect(STATE_DESCRIPTIONS.execute).toBeDefined()
      expect(STATE_DESCRIPTIONS.verify).toBeDefined()
      expect(STATE_DESCRIPTIONS.review).toBeDefined()
      expect(STATE_DESCRIPTIONS.commit).toBeDefined()
      expect(STATE_DESCRIPTIONS.rollback).toBeDefined()
    })
  })

  describe('2. 主链转移有效', () => {
    it('plan -> retrieve 应该有效', () => {
      expect(isValidTransition('plan', 'retrieve')).toBe(true)
      expect(isMainChainTransition('plan', 'retrieve')).toBe(true)
      expect(getMainChainNextState('plan')).toBe('retrieve')
    })

    it('retrieve -> edit 应该有效', () => {
      expect(isValidTransition('retrieve', 'edit')).toBe(true)
      expect(isMainChainTransition('retrieve', 'edit')).toBe(true)
      expect(getMainChainNextState('retrieve')).toBe('edit')
    })

    it('edit -> execute 应该有效', () => {
      expect(isValidTransition('edit', 'execute')).toBe(true)
      expect(isMainChainTransition('edit', 'execute')).toBe(true)
      expect(getMainChainNextState('edit')).toBe('execute')
    })

    it('execute -> verify 应该有效', () => {
      expect(isValidTransition('execute', 'verify')).toBe(true)
      expect(isMainChainTransition('execute', 'verify')).toBe(true)
      expect(getMainChainNextState('execute')).toBe('verify')
    })

    it('verify -> review 应该有效', () => {
      expect(isValidTransition('verify', 'review')).toBe(true)
      expect(isMainChainTransition('verify', 'review')).toBe(true)
      expect(getMainChainNextState('verify')).toBe('review')
    })

    it('review -> commit 应该有效', () => {
      expect(isValidTransition('review', 'commit')).toBe(true)
      expect(isMainChainTransition('review', 'commit')).toBe(true)
      expect(getMainChainNextState('review')).toBe('commit')
    })
  })

  describe('3. 非法转移无效', () => {
    it('commit -> edit 应该无效', () => {
      expect(isValidTransition('commit', 'edit')).toBe(false)
      expect(getAllowedNextStates('commit')).toEqual([])
    })

    it('commit -> rollback 应该无效', () => {
      expect(isValidTransition('commit', 'rollback')).toBe(false)
    })

    it('retrieve -> commit 应该无效', () => {
      expect(isValidTransition('retrieve', 'commit')).toBe(false)
    })

    it('review -> execute 应该无效', () => {
      expect(isValidTransition('review', 'execute')).toBe(false)
    })
  })

  describe('4. 失败/回退转移有效', () => {
    it('edit -> rollback 应该有效', () => {
      expect(isValidTransition('edit', 'rollback')).toBe(true)
      expect(isFailureTransition('edit', 'rollback')).toBe(true)
      expect(getFailureStates('edit')).toContain('rollback')
    })

    it('execute -> rollback 应该有效', () => {
      expect(isValidTransition('execute', 'rollback')).toBe(true)
      expect(isFailureTransition('execute', 'rollback')).toBe(true)
      expect(getFailureStates('execute')).toContain('rollback')
    })

    it('verify -> rollback 应该有效', () => {
      expect(isValidTransition('verify', 'rollback')).toBe(true)
      expect(isFailureTransition('verify', 'rollback')).toBe(true)
      expect(getFailureStates('verify')).toContain('rollback')
    })

    it('rollback -> plan 应该有效', () => {
      expect(isValidTransition('rollback', 'plan')).toBe(true)
      expect(getAllowedNextStates('rollback')).toContain('plan')
    })
  })

  describe('5. 状态转移映射表', () => {
    it('应该有正确的状态转移定义', () => {
      expect(STATE_TRANSITIONS.plan).toEqual(['retrieve', 'rollback'])
      expect(STATE_TRANSITIONS.retrieve).toEqual(['edit', 'rollback'])
      expect(STATE_TRANSITIONS.edit).toEqual(['execute', 'rollback'])
      expect(STATE_TRANSITIONS.execute).toEqual(['verify', 'rollback'])
      expect(STATE_TRANSITIONS.verify).toEqual(['review', 'rollback'])
      expect(STATE_TRANSITIONS.review).toEqual(['commit', 'rollback'])
      expect(STATE_TRANSITIONS.commit).toEqual([])
      expect(STATE_TRANSITIONS.rollback).toEqual(['plan'])
    })

    it('应该有正确的主链转移映射', () => {
      expect(MAIN_CHAIN_TRANSITIONS.plan).toBe('retrieve')
      expect(MAIN_CHAIN_TRANSITIONS.retrieve).toBe('edit')
      expect(MAIN_CHAIN_TRANSITIONS.edit).toBe('execute')
      expect(MAIN_CHAIN_TRANSITIONS.execute).toBe('verify')
      expect(MAIN_CHAIN_TRANSITIONS.verify).toBe('review')
      expect(MAIN_CHAIN_TRANSITIONS.review).toBe('commit')
      expect(MAIN_CHAIN_TRANSITIONS.commit).toBeNull()
      expect(MAIN_CHAIN_TRANSITIONS.rollback).toBe('plan')
    })

    it('应该有正确的失败转移映射', () => {
      expect(FAILURE_TRANSITIONS.plan).toEqual(['rollback'])
      expect(FAILURE_TRANSITIONS.retrieve).toEqual(['rollback'])
      expect(FAILURE_TRANSITIONS.edit).toEqual(['rollback'])
      expect(FAILURE_TRANSITIONS.execute).toEqual(['rollback'])
      expect(FAILURE_TRANSITIONS.verify).toEqual(['rollback'])
      expect(FAILURE_TRANSITIONS.review).toEqual(['rollback'])
      expect(FAILURE_TRANSITIONS.commit).toEqual([])
      expect(FAILURE_TRANSITIONS.rollback).toEqual(['plan'])
    })
  })

  describe('6. 状态对象创建', () => {
    it('应该能创建初始状态对象', () => {
      const state = createInitialState('plan')
      expect(state.currentState).toBe('plan')
      expect(state.previousState).toBeNull()
      expect(state.reason).toBe('initial')
      expect(state.isCompleted).toBe(false)
      expect(state.result).toBe('pending')
      expect(state.attemptCount).toBe(0)
    })

    it('应该能创建状态转移', () => {
      const initialState = createInitialState('plan')
      const nextState = createStateTransition(initialState, 'retrieve', 'plan_completed')

      expect(nextState.currentState).toBe('retrieve')
      expect(nextState.previousState).toBe('plan')
      expect(nextState.reason).toBe('plan_completed')
      expect(nextState.isCompleted).toBe(false)
      expect(nextState.result).toBe('pending')
    })
  })
})
