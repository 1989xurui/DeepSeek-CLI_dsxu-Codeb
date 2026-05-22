/**
 * R5-17 MessageEnvelope 工具函数
 */
import { MessageEnvelope, RoleName } from './contract';

export function createEnvelope(
  from: RoleName | 'orchestrator',
  to: RoleName | 'orchestrator',
  type: MessageEnvelope['type'],
  payload: Record<string, unknown>,
  turnIndex: number
): MessageEnvelope {
  return { from: from as RoleName, to, type, payload, timestamp: Date.now(), turnIndex };
}

export function filterInbox(messages: MessageEnvelope[], recipient: RoleName): MessageEnvelope[] {
  return messages.filter(m => m.to === recipient || m.to === 'orchestrator');
}

export function extractPayload<T = Record<string, unknown>>(msg: MessageEnvelope): T {
  return msg.payload as T;
}
