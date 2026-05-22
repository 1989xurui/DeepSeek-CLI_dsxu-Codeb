import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createHash } from 'crypto';

export type DeepSeekTrajectoryEvent =
  | 'request_plan'
  | 'request_messages'
  | 'json_response'
  | 'stream_response'
  | 'response_usage'
  | 'repair_signal_admission';

export interface DeepSeekTrajectoryRecord {
  ts: string;
  event: DeepSeekTrajectoryEvent;
  requestTag: string;
  requestId?: string;
  redacted: true;
  [key: string]: unknown;
}

interface ToolSnapshot {
  id?: string;
  name?: string;
  argumentChars?: number;
  argumentHash?: string;
  argumentKeys?: string[];
}

interface TextSnapshot {
  chars: number;
  hash: string;
}

export class DeepSeekTrajectoryStore {
  static tracePath(): string | null {
    const path = process.env.DSXU_DEEPSEEK_TRAJECTORY_FILE?.trim();
    return path && path.length > 0 ? path : null;
  }

  static createRequestTag(): string {
    const source = `${Date.now()}:${Math.random()}`;
    return `dsxu-deepseek-${DeepSeekTrajectoryStore.shortHash(source)}`;
  }

  static textSnapshot(value: unknown): TextSnapshot | undefined {
    if (typeof value !== 'string' || value.length === 0) return undefined;
    return {
      chars: value.length,
      hash: DeepSeekTrajectoryStore.shortHash(value),
    };
  }

  static summarizeMessages(messages: unknown[]): Record<string, unknown> {
    const roleCounts: Record<string, number> = {};
    const toolResults: Array<Record<string, unknown>> = [];
    const assistantToolCalls: ToolSnapshot[] = [];
    let systemChars = 0;
    let userChars = 0;
    let assistantTextChars = 0;
    let assistantReasoningChars = 0;

    for (const message of messages) {
      if (!message || typeof message !== 'object') continue;
      const msg = message as Record<string, unknown>;
      const role = typeof msg.role === 'string' ? msg.role : 'unknown';
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;

      if (role === 'system' && typeof msg.content === 'string') {
        systemChars += msg.content.length;
      } else if (role === 'user' && typeof msg.content === 'string') {
        userChars += msg.content.length;
      } else if (role === 'tool') {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
        toolResults.push({
          toolCallId: typeof msg.tool_call_id === 'string' ? msg.tool_call_id : undefined,
          contentChars: content.length,
          contentHash: DeepSeekTrajectoryStore.shortHash(content),
        });
      } else if (role === 'assistant') {
        if (typeof msg.content === 'string') assistantTextChars += msg.content.length;
        if (typeof msg.reasoning_content === 'string') {
          assistantReasoningChars += msg.reasoning_content.length;
        }
        const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
        for (const call of calls) {
          assistantToolCalls.push(DeepSeekTrajectoryStore.toolSnapshot(call));
        }
      }
    }

    return {
      messageCount: messages.length,
      roleCounts,
      systemChars,
      userChars,
      assistantTextChars,
      assistantReasoningChars,
      assistantToolCalls,
      toolResults,
      toolResultCount: toolResults.length,
      rawContentStored: false,
    };
  }

  static responseSnapshot(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== 'object') return { choiceCount: 0 };
    const root = data as Record<string, unknown>;
    const choices = Array.isArray(root.choices) ? root.choices : [];
    const content: TextSnapshot[] = [];
    const reasoning: TextSnapshot[] = [];
    const toolCalls: ToolSnapshot[] = [];
    const finishReasons: unknown[] = [];

    for (const choice of choices) {
      if (!choice || typeof choice !== 'object') continue;
      const choiceRecord = choice as Record<string, unknown>;
      finishReasons.push(choiceRecord.finish_reason);
      const message = choiceRecord.message as Record<string, unknown> | undefined;
      if (!message) continue;
      const contentSnapshot = DeepSeekTrajectoryStore.textSnapshot(message.content);
      if (contentSnapshot) content.push(contentSnapshot);
      const reasoningSnapshot = DeepSeekTrajectoryStore.textSnapshot(message.reasoning_content);
      if (reasoningSnapshot) reasoning.push(reasoningSnapshot);
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      for (const call of calls) toolCalls.push(DeepSeekTrajectoryStore.toolSnapshot(call));
    }

    return {
      responseModel: typeof root.model === 'string' ? root.model : undefined,
      responseId: typeof root.id === 'string' ? root.id : undefined,
      choiceCount: choices.length,
      finishReasons,
      content,
      reasoning,
      toolCalls,
      rawContentStored: false,
    };
  }

  static streamSnapshot(input: {
    responseModel?: unknown;
    reasoningContent?: string;
    toolCalls?: ToolSnapshot[];
    finalUsage?: unknown;
  }): Record<string, unknown> {
    return {
      responseModel: typeof input.responseModel === 'string' ? input.responseModel : undefined,
      reasoning: DeepSeekTrajectoryStore.textSnapshot(input.reasoningContent),
      toolCalls: input.toolCalls ?? [],
      usage: input.finalUsage,
      rawContentStored: false,
    };
  }

  static toolSnapshot(call: unknown): ToolSnapshot {
    if (!call || typeof call !== 'object') return {};
    const record = call as Record<string, unknown>;
    const fn = record.function && typeof record.function === 'object'
      ? record.function as Record<string, unknown>
      : {};
    const args = typeof fn.arguments === 'string' ? fn.arguments : undefined;
    const argumentKeys = args ? DeepSeekTrajectoryStore.argumentKeys(args) : [];
    return {
      id: typeof record.id === 'string' ? record.id : undefined,
      name: typeof fn.name === 'string'
        ? fn.name
        : typeof record.name === 'string'
          ? record.name
          : undefined,
      argumentChars: args?.length ?? 0,
      argumentHash: args ? DeepSeekTrajectoryStore.shortHash(args) : undefined,
      argumentKeys,
    };
  }

  static append(record: Omit<DeepSeekTrajectoryRecord, 'ts' | 'redacted'>): void {
    const path = DeepSeekTrajectoryStore.tracePath();
    if (!path) return;
    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(
        path,
        `${JSON.stringify({
          ts: new Date().toISOString(),
          redacted: true,
          ...record,
        })}\n`,
        'utf8',
      );
    } catch {
      // Diagnostic trajectory tracing must never affect model calls.
    }
  }

  private static shortHash(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  private static argumentKeys(args: string): string[] {
    try {
      const parsed = JSON.parse(args);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
      return Object.keys(parsed).sort();
    } catch {
      return [];
    }
  }
}
