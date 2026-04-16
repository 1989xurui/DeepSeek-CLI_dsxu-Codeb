import { describe, it, expect } from 'vitest'
import { CircuitBreaker } from '../circuit-breaker'

describe('CircuitBreaker', () => {
  it('should stay closed until the failure threshold is reached', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 })

    breaker.recordFailure(100)
    expect(breaker.getSnapshot().state).toBe('closed')

    breaker.recordFailure(200)
    expect(breaker.getSnapshot().state).toBe('closed')

    breaker.recordFailure(300)
    expect(breaker.getSnapshot().state).toBe('open')
  })

  it('should deny requests while open before cooldown expires', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000 })

    breaker.recordFailure(100)
    expect(breaker.canRequest(500)).toBe(false)
    expect(breaker.getSnapshot().state).toBe('open')
  })

  it('should transition to half_open after cooldown and close on success', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000 })

    breaker.recordFailure(100)
    expect(breaker.canRequest(1200)).toBe(true)
    expect(breaker.getSnapshot().state).toBe('half_open')

    breaker.recordSuccess()
    expect(breaker.getSnapshot().state).toBe('closed')
  })

  it('should reopen when a half_open probe fails', () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1000 })

    breaker.recordFailure(100)
    expect(breaker.canRequest(1200)).toBe(true)
    expect(breaker.getSnapshot().state).toBe('half_open')

    breaker.recordFailure(1300)
    expect(breaker.getSnapshot().state).toBe('open')
  })
})
