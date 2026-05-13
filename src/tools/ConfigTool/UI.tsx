import React from 'react';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Text } from '../../ink.js';
import { jsonStringify } from '../../utils/slowOperations.js';
import type { Input, Output } from './ConfigTool.js';
export function renderToolUseMessage(input: Partial<Input>): React.ReactNode {
  if (!input.setting) return null;
  if (input.value === undefined) {
    return <Text dimColor>Getting {input.setting}</Text>;
  }
  return <Text dimColor>
      Setting {input.setting} to {jsonStringify(input.value)}
    </Text>;
}
export function renderToolResultMessage(content: Output): React.ReactNode {
  if (!content.success) {
    return <MessageResponse>
        <Text color="error">Failed: {content.error}</Text>
      </MessageResponse>;
  }
  if (content.operation === 'get') {
    return <MessageResponse>
        <Text>
          <Text bold>{content.setting}</Text> = {jsonStringify(content.value)}
        </Text>
      </MessageResponse>;
  }
  return <MessageResponse>
      <Text>
        Set <Text bold>{content.setting}</Text> to{' '}
        <Text bold>{jsonStringify(content.newValue)}</Text>
      </Text>
    </MessageResponse>;
}
export function renderToolUseRejectedMessage(): React.ReactNode {
  return <Text color="warning">Config change rejected</Text>;
}

// V14 strict lifecycle shim: tools-ConfigTool-UI
export function processToolsConfigToolUIStrictLifecycle(input) {
  void input
  const state = 'tools-ConfigTool-UI-state'
  const lifecycle = 'tools-ConfigTool-UI:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsConfigToolUIStrict(input) {
  return processToolsConfigToolUIStrictLifecycle(input)
}
