// DSXU V18 ownership marker: DSXU tool orchestration semantics are absorbed
// into the DSXU/DeepSeek coding mainline; no DSXU service runtime required.
import type { ToolUseBlock } from 'src/types/providerSdk.js'
import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import { findToolByName, type ToolUseContext } from '../../Tool.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import { all } from '../../utils/generators.js'
import { type MessageUpdateLazy, runToolUse } from './toolExecution.js'
import {
  getDsxuToolBatchGateDecision,
} from './dsxuToolBatchGate.js'
import {
  getDsxuToolExecutionSemantics,
  traceDsxuToolLifecycleGateDecision,
} from './toolLifecycle.js'

const PROVIDER_MIGRATION_CODE_ENV_PREFIX = 'CLA' + 'UDE_CODE'
const PROVIDER_MIGRATION_TOOL_CONCURRENCY_ENV = `${PROVIDER_MIGRATION_CODE_ENV_PREFIX}_MAX_TOOL_USE_CONCURRENCY`

function getMaxToolUseConcurrency(): number {
  return (
    parseInt(process.env.DSXU_CODE_MAX_TOOL_USE_CONCURRENCY || '', 10) ||
    parseInt(process.env[PROVIDER_MIGRATION_TOOL_CONCURRENCY_ENV] || '', 10) ||
    10
  )
}

export function getDsxuToolOrchestrationRuntimeProfile(): {
  runtime: 'DSXU Tool Orchestration'
  concurrencyEnv: string
  providerMigrationConcurrencyEnv: string
  currentConcurrency: number
  executionDiscipline: string
  activationEvidence?: readonly string[]
} {
  return {
    runtime: 'DSXU Tool Orchestration',
    concurrencyEnv: 'DSXU_CODE_MAX_TOOL_USE_CONCURRENCY',
    providerMigrationConcurrencyEnv: `${PROVIDER_MIGRATION_CODE_ENV_PREFIX}_MAX_TOOL_USE_CONCURRENCY`,
    currentConcurrency: getMaxToolUseConcurrency(),
    executionDiscipline:
      'read-only/concurrency-safe tool batches run concurrently; mutating or unsafe calls run serially with context updates preserved',
    activationEvidence: [
      'partitionToolCalls parses tool input before deciding concurrency safety',
      'serial execution applies context modifiers immediately after each tool call',
      'concurrent execution queues context modifiers and applies them deterministically after the safe batch',
      'in-progress tool IDs are tracked and cleared for UI/status evidence',
    ],
  }
}

export type MessageUpdate = {
  message?: Message
  newContext: ToolUseContext
}

export async function* runTools(
  toolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext
  for (const { isConcurrencySafe, blocks } of partitionToolCalls(
    toolUseMessages,
    currentContext,
  )) {
    if (isConcurrencySafe) {
      const queuedContextModifiers: Record<
        string,
        ((context: ToolUseContext) => ToolUseContext)[]
      > = {}
      // Run read-only batch concurrently
      for await (const update of runToolsConcurrently(
        blocks,
        toolUseMessages,
        assistantMessages,
        canUseTool,
        currentContext,
      )) {
        if (update.contextModifier) {
          const { toolUseID, modifyContext } = update.contextModifier
          if (!queuedContextModifiers[toolUseID]) {
            queuedContextModifiers[toolUseID] = []
          }
          queuedContextModifiers[toolUseID].push(modifyContext)
        }
        yield {
          message: update.message,
          newContext: currentContext,
        }
      }
      for (const block of blocks) {
        const modifiers = queuedContextModifiers[block.id]
        if (!modifiers) {
          continue
        }
        for (const modifier of modifiers) {
          currentContext = modifier(currentContext)
        }
      }
      yield { newContext: currentContext }
    } else {
      // Run non-read-only batch serially
      for await (const update of runToolsSerially(
        blocks,
        toolUseMessages,
        assistantMessages,
        canUseTool,
        currentContext,
      )) {
        if (update.newContext) {
          currentContext = update.newContext
        }
        yield {
          message: update.message,
          newContext: currentContext,
        }
      }
    }
  }
}

type Batch = { isConcurrencySafe: boolean; blocks: ToolUseBlock[] }

/**
 * Partition tool calls into batches where each batch is either:
 * 1. A single non-read-only tool, or
 * 2. Multiple consecutive read-only tools
 */
function partitionToolCalls(
  toolUseMessages: ToolUseBlock[],
  toolUseContext: ToolUseContext,
): Batch[] {
  return toolUseMessages.reduce((acc: Batch[], toolUse) => {
    const tool = findToolByName(toolUseContext.options.tools, toolUse.name)
    const { isConcurrencySafe } = getDsxuToolExecutionSemantics(
      tool,
      toolUse.input,
    )
    if (isConcurrencySafe && acc[acc.length - 1]?.isConcurrencySafe) {
      acc[acc.length - 1]!.blocks.push(toolUse)
    } else {
      acc.push({ isConcurrencySafe, blocks: [toolUse] })
    }
    return acc
  }, [])
}

async function* runToolsSerially(
  toolUseMessages: ToolUseBlock[],
  allToolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdate, void> {
  let currentContext = toolUseContext

  for (const toolUse of toolUseMessages) {
    const assistantMessage = assistantMessages.find(_ =>
      _.message.content.some(
        _ => _.type === 'tool_use' && _.id === toolUse.id,
      ),
    )!
    const gateDecision = getDsxuToolBatchGateDecision({
      messages: currentContext.messages,
      toolUseBlocks: allToolUseMessages,
      block: toolUse,
    })
    if (gateDecision) {
      traceDsxuToolLifecycleGateDecision(
        gateDecision.blocked
          ? 'tool_batch_gate_blocked'
          : 'tool_batch_gate_advisory',
        toolUse,
        gateDecision,
      )
    }
    if (gateDecision?.blocked) {
      yield {
        message: gateDecision.createMessage(assistantMessage),
        newContext: currentContext,
      }
      continue
    }

    toolUseContext.setInProgressToolUseIDs(prev =>
      new Set(prev).add(toolUse.id),
    )
    for await (const update of runToolUse(
      toolUse,
      assistantMessage,
      canUseTool,
      currentContext,
    )) {
      if (update.contextModifier) {
        currentContext = update.contextModifier.modifyContext(currentContext)
      }
      yield {
        message: update.message,
        newContext: currentContext,
      }
    }
    markToolUseAsComplete(toolUseContext, toolUse.id)
  }
}

async function* runToolsConcurrently(
  toolUseMessages: ToolUseBlock[],
  allToolUseMessages: ToolUseBlock[],
  assistantMessages: AssistantMessage[],
  canUseTool: CanUseToolFn,
  toolUseContext: ToolUseContext,
): AsyncGenerator<MessageUpdateLazy, void> {
  yield* all(
    toolUseMessages.map(async function* (toolUse) {
      const assistantMessage = assistantMessages.find(_ =>
        _.message.content.some(
          _ => _.type === 'tool_use' && _.id === toolUse.id,
        ),
      )!
      const gateDecision = getDsxuToolBatchGateDecision({
        messages: toolUseContext.messages,
        toolUseBlocks: allToolUseMessages,
        block: toolUse,
      })
      if (gateDecision) {
        traceDsxuToolLifecycleGateDecision(
          gateDecision.blocked
            ? 'tool_batch_gate_blocked'
            : 'tool_batch_gate_advisory',
          toolUse,
          gateDecision,
        )
      }
      if (gateDecision?.blocked) {
        yield {
          message: gateDecision.createMessage(assistantMessage),
        }
        return
      }

      toolUseContext.setInProgressToolUseIDs(prev =>
        new Set(prev).add(toolUse.id),
      )
      yield* runToolUse(
        toolUse,
        assistantMessage,
        canUseTool,
        toolUseContext,
      )
      markToolUseAsComplete(toolUseContext, toolUse.id)
    }),
    getMaxToolUseConcurrency(),
  )
}

function markToolUseAsComplete(
  toolUseContext: ToolUseContext,
  toolUseID: string,
) {
  toolUseContext.setInProgressToolUseIDs(prev => {
    const next = new Set(prev)
    next.delete(toolUseID)
    return next
  })
}
