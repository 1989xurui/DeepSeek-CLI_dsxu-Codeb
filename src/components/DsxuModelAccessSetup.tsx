import React, { useCallback, useState } from 'react'
import { resetCostState } from '../bootstrap/state.js'
import { Box, Text } from '../ink.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import { saveApiKey } from '../services/auth/dsxuProviderAuth.js'
import { saveGlobalConfig } from '../utils/config.js'
import { Dialog } from './design-system/Dialog.js'
import TextInput from './TextInput.js'
import { WelcomeV2 } from './LogoV2/WelcomeV2.js'

type SetupProps = {
  onDone: (success: boolean) => void
  showWelcome?: boolean
}

export function DsxuModelAccessSetup({
  onDone,
  showWelcome = false,
}: SetupProps): React.ReactNode {
  const columns = useTerminalSize().columns
  const [apiKey, setApiKey] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setError('DeepSeek API key is required before model requests can run.')
        return
      }

      setSaving(true)
      setError(null)
      try {
        await saveApiKey(trimmed)
        saveGlobalConfig(current => ({
          ...current,
          hasCompletedOnboarding: true,
        }))
        resetCostState()
        onDone(true)
      } catch (err) {
        setSaving(false)
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [onDone],
  )

  const inputColumns = Math.max(24, Math.min(columns - 6, 88))

  return (
    <Box flexDirection="column" gap={1}>
      {showWelcome ? <WelcomeV2 /> : null}
      <Text bold>Configure DSXU model access</Text>
      <Text>
        Default route: DeepSeek V4 Flash. Flash-MAX / Pro are admitted only
        for explicit high-risk review, recovery, or failed verification gates.
      </Text>
      <Text dimColor>
        Paste your DeepSeek API key. It is stored as a local DSXU credential
        and is never printed to the transcript.
      </Text>
      <Box flexDirection="column">
        <Text dimColor>DeepSeek API key</Text>
        <TextInput
          value={apiKey}
          onChange={value => {
            setApiKey(value)
            setError(null)
          }}
          onPaste={value => {
            setApiKey(value)
            setCursorOffset(value.length)
            setError(null)
          }}
          onSubmit={handleSubmit}
          placeholder="sk-..."
          mask="*"
          focus
          showCursor
          columns={inputColumns}
          cursorOffset={cursorOffset}
          onChangeCursorOffset={setCursorOffset}
        />
      </Box>
      {saving ? <Text dimColor>Saving local credential...</Text> : null}
      {error ? <Text color="error">{error}</Text> : null}
    </Box>
  )
}

export function DsxuModelAccessSetupDialog({
  onDone,
  showWelcome = false,
}: SetupProps): React.ReactNode {
  return (
    <Dialog
      title="DSXU model access"
      subtitle="DeepSeek key required before model requests"
      onCancel={() => onDone(false)}
      color="permission"
    >
      <DsxuModelAccessSetup onDone={onDone} showWelcome={showWelcome} />
    </Dialog>
  )
}
