import React from 'react';
import { Box, Text } from 'src/ink.js';
import { DsxuMascot } from './DsxuMascot.js';

const WELCOME_V2_WIDTH = 58;
const DSXU_WELCOME_MESSAGE = 'Welcome to DSXU Code';

function versionLabel(): string {
  return typeof MACRO !== 'undefined' ? MACRO.VERSION : 'dev';
}

export function WelcomeV2() {
  return (
    <Box width={WELCOME_V2_WIDTH} flexDirection="column" alignItems="center" gap={1}>
      <Text>
        <Text color="brand">{DSXU_WELCOME_MESSAGE}</Text>{' '}
        <Text dimColor={true}>v{versionLabel()}</Text>
      </Text>
      <DsxuMascot maxWidth={17} />
      <Text dimColor={true}>DeepSeek-first coding workspace</Text>
    </Box>
  );
}
