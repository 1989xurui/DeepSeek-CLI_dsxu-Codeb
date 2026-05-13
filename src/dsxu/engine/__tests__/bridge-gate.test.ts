import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  BridgeAdapter,
  BridgeToolErrorType,
  BridgeToolEventType,
} = await import('../adapters/bridge-adapter')

const createDefaultGateConfig =
  BridgeAdapter.createDefaultGateConfig.bind(BridgeAdapter)
const createVerificationGateCheck =
  BridgeAdapter.createVerificationGateCheck.bind(BridgeAdapter)

describe('BridgeGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('error and event types', () => {
    it('defines stable error types', () => {
      expect(BridgeToolErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED')
      expect(BridgeToolErrorType.VALIDATION_FAILED).toBe('VALIDATION_FAILED')
      expect(BridgeToolErrorType.EXECUTION_FAILED).toBe('EXECUTION_FAILED')
      expect(BridgeToolErrorType.TIMEOUT).toBe('TIMEOUT')
      expect(BridgeToolErrorType.UNKNOWN).toBe('UNKNOWN')
    })

    it('defines stable event types', () => {
      expect(BridgeToolEventType.TOOL_STARTED).toBe('bridge_tool_started')
      expect(BridgeToolEventType.TOOL_COMPLETED).toBe('bridge_tool_completed')
      expect(BridgeToolEventType.TOOL_FAILED).toBe('bridge_tool_failed')
      expect(BridgeToolEventType.GATE_CHECK).toBe('bridge_gate_check')
    })
  })

  describe('gate config', () => {
    it('creates default gate config', () => {
      const config = createDefaultGateConfig()

      expect(config.enabled).toBe(true)
      expect(config.gatedTools).toEqual(
        expect.arrayContaining([
          'FileEdit',
          'Bash',
          'FileWrite',
          'PowerShell',
          'REPL',
        ]),
      )
      expect(config.gateCheck).toBeDefined()
    })

    it('supports custom verification callbacks', async () => {
      const verificationCallback = vi.fn().mockResolvedValue(true)
      const config = createDefaultGateConfig(verificationCallback)

      const result = await config.gateCheck?.('Bash', { command: 'ls' }, {})

      expect(result?.allowed).toBe(true)
      expect(verificationCallback).toHaveBeenCalledWith('Bash', {
        command: 'ls',
      })
    })
  })

  describe('security gate checks', () => {
    it('rejects dangerous shell commands', async () => {
      const gateCheck = createVerificationGateCheck()
      const dangerousCommands = [
        'rm -rf /',
        'rm -rf /*',
        'sudo rm -rf',
        'dd if=/dev/zero of=/dev/sda',
        'chmod 777 /etc/passwd',
      ]

      for (const command of dangerousCommands) {
        const result = await gateCheck('Bash', { command }, {})
        expect(result.allowed).toBe(false)
        expect(result.errorType).toBe(BridgeToolErrorType.PERMISSION_DENIED)
        expect(result.reason).toBeTruthy()
      }
    })

    it('allows safe shell commands', async () => {
      const gateCheck = createVerificationGateCheck()

      for (const command of ['ls -la', 'pwd', 'echo "hello"', 'git status']) {
        const result = await gateCheck('Bash', { command }, {})
        expect(result.allowed).toBe(true)
      }
    })

    it('rejects sensitive file edits', async () => {
      const gateCheck = createVerificationGateCheck()
      const sensitiveFiles = [
        '/etc/passwd',
        '/etc/shadow',
        '.env.production',
        '.git/config',
        '/bin/bash',
      ]

      for (const filePath of sensitiveFiles) {
        const result = await gateCheck('FileEdit', { file_path: filePath }, {})
        expect(result.allowed).toBe(false)
        expect(result.errorType).toBe(BridgeToolErrorType.PERMISSION_DENIED)
        expect(result.reason).toBeTruthy()
      }
    })

    it('allows ordinary file edits', async () => {
      const gateCheck = createVerificationGateCheck()

      for (const filePath of ['src/index.ts', 'package.json', 'README.md']) {
        const result = await gateCheck('FileEdit', { file_path: filePath }, {})
        expect(result.allowed).toBe(true)
      }
    })

    it('handles callback denial and exceptions', async () => {
      const denied = createVerificationGateCheck(vi.fn().mockResolvedValue(false))
      const deniedResult = await denied('Bash', { command: 'test' }, {})
      expect(deniedResult.allowed).toBe(false)
      expect(deniedResult.errorType).toBe(BridgeToolErrorType.VALIDATION_FAILED)

      const thrown = createVerificationGateCheck(
        vi.fn().mockRejectedValue(new Error('callback failed')),
      )
      const thrownResult = await thrown('Bash', { command: 'test' }, {})
      expect(thrownResult.allowed).toBe(false)
      expect(thrownResult.errorType).toBe(BridgeToolErrorType.VALIDATION_FAILED)
      expect(thrownResult.reason).toBeTruthy()
    })
  })
})
