import React from 'react'
import type { CommandResultDisplay } from '../commands.js'
import { Box, Text, useInput } from '../ink.js'

type Props = {
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}

export function DesktopHandoff({ onDone }: Props): React.ReactNode {
  useInput(() => {
    onDone('DSXU desktop handoff is provider-migration-isolated. Use dsxu-code CLI or the DSXU workbench entrypoint.', { display: 'system' })
  })

  return (
    <Box flexDirection="column" paddingX={2}>
      <Text color="warning">DSXU desktop handoff is provider-migration-isolated.</Text>
      <Text>
        Use <Text bold>dsxu-code</Text> for the active DSXU Code CLI, or start the DSXU workbench entrypoint when available.
      </Text>
      <Text dimColor>Press any key to continue.</Text>
    </Box>
  )
}
