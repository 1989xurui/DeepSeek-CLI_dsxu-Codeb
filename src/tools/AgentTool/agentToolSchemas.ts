import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'

export const agentEvidencePacketSchema = lazySchema(() =>
  z.object({
    files_read: z.array(z.string()),
    files_changed: z.array(z.string()),
    commands_run: z.array(z.string()),
    tests_passed: z.array(z.string()),
    tests_failed: z.array(z.string()),
    unresolved_risks: z.array(z.string()),
    completion_claim: z.enum(['complete', 'partial', 'unknown']),
  }),
)

export type AgentEvidencePacket = z.input<
  ReturnType<typeof agentEvidencePacketSchema>
>

export const agentToolResultSchema = lazySchema(() =>
  z.object({
    agentId: z.string(),
    // Optional: older persisted sessions won't have this (resume replays
    // results verbatim without re-validation). Used to gate the sync
    // result trailer ...one-shot built-ins skip the SendMessage hint.
    agentType: z.string().optional(),
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
    evidencePacket: agentEvidencePacketSchema().optional(),
    runtimeEvidence: z.object({
      taskId: z.string(),
      taskType: z.literal('local_agent'),
      owner: z.string(),
      writeScope: z.array(z.string()),
      cwd: z.string().optional(),
      isolation: z.enum([
        'none',
        'cwd_override',
        'worktree_isolation',
        'remote_gated_isolation',
        'fork_context_inheritance',
      ]),
      recoverPath: z.enum([
        'send_message_continuation',
        'task_output_then_sendmessage',
        'partial_result_notification',
      ]),
      lifecycleState: z.enum([
        'pending',
        'running',
        'completed',
        'failed',
        'killed',
      ]),
      placement: z.enum(['foreground', 'background']),
      outputPath: z.string(),
      progressEventCount: z.number(),
      canAbort: z.boolean(),
      canRecover: z.boolean(),
    }).optional(),
    totalToolUseCount: z.number(),
    totalDurationMs: z.number(),
    totalTokens: z.number(),
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().nullable(),
      cache_read_input_tokens: z.number().nullable(),
      server_tool_use: z
        .object({
          web_search_requests: z.number(),
          web_fetch_requests: z.number(),
        })
        .nullable(),
      service_tier: z.enum(['standard', 'priority', 'batch']).nullable(),
      cache_creation: z
        .object({
          ephemeral_1h_input_tokens: z.number(),
          ephemeral_5m_input_tokens: z.number(),
        })
        .nullable(),
    }),
  }),
)

export type AgentToolResult = z.input<ReturnType<typeof agentToolResultSchema>>
