export type CircuitBreakerState = 'closed' | 'open' | 'half_open'

export interface CircuitBreakerConfig {
  failureThreshold?: number
  successThreshold?: number
  cooldownMs?: number
}

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState
  consecutiveFailures: number
  consecutiveSuccesses: number
  openedAt: number | null
}

const DEFAULT_FAILURE_THRESHOLD = 3
const DEFAULT_SUCCESS_THRESHOLD = 1
const DEFAULT_COOLDOWN_MS = 5 * 60_000

export class CircuitBreaker {
  private readonly failureThreshold: number
  private readonly successThreshold: number
  private readonly cooldownMs: number

  private state: CircuitBreakerState = 'closed'
  private consecutiveFailures = 0
  private consecutiveSuccesses = 0
  private openedAt: number | null = null

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD
    this.successThreshold = config?.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD
    this.cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS
  }

  canRequest(now = Date.now()): boolean {
    if (this.state === 'closed' || this.state === 'half_open') {
      return true
    }

    if (this.openedAt !== null && now - this.openedAt >= this.cooldownMs) {
      this.state = 'half_open'
      this.consecutiveSuccesses = 0
      return true
    }

    return false
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0

    if (this.state === 'half_open') {
      this.consecutiveSuccesses += 1
      if (this.consecutiveSuccesses >= this.successThreshold) {
        this.close()
      }
      return
    }

    this.consecutiveSuccesses = 0
    this.state = 'closed'
    this.openedAt = null
  }

  recordFailure(now = Date.now()): void {
    this.consecutiveSuccesses = 0

    if (this.state === 'half_open') {
      this.trip(now)
      return
    }

    this.consecutiveFailures += 1
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.trip(now)
    }
  }

  forceClose(): void {
    this.close()
  }

  getSnapshot(): CircuitBreakerSnapshot {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      openedAt: this.openedAt,
    }
  }

  private trip(now: number): void {
    this.state = 'open'
    this.openedAt = now
    this.consecutiveFailures = this.failureThreshold
  }

  private close(): void {
    this.state = 'closed'
    this.consecutiveFailures = 0
    this.consecutiveSuccesses = 0
    this.openedAt = null
  }
}
