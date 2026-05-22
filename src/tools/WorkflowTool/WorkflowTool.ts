import { z } from 'zod/v4'
import { buildTool, type ToolDef, type ToolUseContext } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { WORKFLOW_TOOL_NAME } from './constants.js'
import { DESCRIPTION, PROMPT } from './prompt.js'
import {
  type WorkflowRuntimePlan,
  findWorkflowDefinition,
  loadWorkflowDefinitions,
  renderWorkflowRuntime,
} from './registry.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum(['list', 'plan', 'render'])
      .optional()
      .describe(
        'Workflow runtime action. list shows workflows, plan returns structured execution plan, render returns full executable prompt.',
      ),
    workflow: z
      .string()
      .optional()
      .describe('Workflow name, for example "code-review" or "security"'),
    goal: z
      .string()
      .optional()
      .describe('Optional user goal to help select or document the workflow run'),
    arguments: z
      .string()
      .optional()
      .describe('Optional raw argument string used to fill workflow placeholders'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const workflowSummarySchema = z.object({
  name: z.string(),
  description: z.string(),
  filePath: z.string(),
  source: z.string(),
  allowedTools: z.array(z.string()).optional(),
  argumentNames: z.array(z.string()).optional(),
})

const workflowRuntimeStepSchema = z.object({
  index: z.number(),
  kind: z.enum(['heading', 'ordered', 'checkbox', 'bullet', 'body']),
  title: z.string(),
})

const workflowArgumentStatusSchema = z.object({
  required: z.array(z.string()),
  provided: z.array(z.string()),
  missing: z.array(z.string()),
})

const workflowRuntimePlanSchema = z.object({
  action: z.enum(['list', 'plan', 'render']),
  status: z.enum(['ready', 'needs_arguments']),
  name: z.string(),
  description: z.string(),
  source: z.string(),
  filePath: z.string(),
  allowedTools: z.array(z.string()),
  executionPolicy: z.object({
    enforceAllowedTools: z.boolean(),
    allowedTools: z.array(z.string()),
    blockedTools: z.array(z.string()),
    policyHint: z.string(),
  }),
  executionStrategy: z.object({
    phases: z.array(z.enum(['inspect', 'test', 'delegate', 'edit', 'recover', 'verify', 'compact'])),
    requiresRecovery: z.boolean(),
    requiresVerification: z.boolean(),
    requiresCompactBrief: z.boolean(),
    routeHint: z.string(),
  }),
  argumentStatus: workflowArgumentStatusSchema,
  steps: z.array(workflowRuntimeStepSchema),
  nextAction: z.string(),
})

const outputSchema = lazySchema(() =>
  z.object({
    action: z.enum(['list', 'plan', 'render']).optional(),
    status: z
      .enum(['ready', 'needs_arguments', 'not_found'])
      .optional(),
    workflow: workflowSummarySchema.optional(),
    runtime: workflowRuntimePlanSchema.optional(),
    prompt: z.string().optional(),
    availableWorkflows: z.array(workflowSummarySchema).optional(),
    error: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

function summarizeWorkflow(workflow: Awaited<ReturnType<typeof loadWorkflowDefinitions>>[number]) {
  return {
    name: workflow.name,
    description: workflow.description,
    filePath: workflow.filePath,
    source: workflow.source,
    allowedTools: workflow.allowedTools,
    argumentNames: workflow.argumentNames,
  }
}

function renderAvailableWorkflows(workflows: Array<{
  name: string
  description: string
  allowedTools?: string[]
  argumentNames?: string[]
}>): string {
  if (workflows.length === 0) return 'No workflows found.'
  return [
    'Available DSXU workflows:',
    ...workflows.map(workflow => {
      const argumentNames = workflow.argumentNames ?? []
      const allowedTools = workflow.allowedTools ?? []
      const args = argumentNames.length
        ? ` args=${argumentNames.join(',')}`
        : ''
      const tools = allowedTools.length
        ? ` tools=${allowedTools.join(',')}`
        : ''
      return `- ${workflow.name}: ${workflow.description}${args}${tools}`
    }),
  ].join('\n')
}

export const WorkflowTool = buildTool({
  name: WORKFLOW_TOOL_NAME,
  searchHint: 'run repeatable DSXU workflows',
  maxResultSizeChars: 100_000,
  runtimeMetadata: {
    owner: 'DSXU Workflow Planner',
    sideEffects: [
      'context-policy-projection',
      'workflow-prompt-rendering',
    ],
    permission: 'read-only workflow planning; execution remains through allowed tools',
    evidence: [
      'workflow definition source',
      'executionPolicy output',
      'executionStrategy output',
      'argumentStatus output',
    ],
    uiProjection: 'workflow plan, allowed tools, and next action',
  },
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'Workflow'
  },
  shouldDefer: true,
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    return [input.action, input.workflow, input.goal, input.arguments]
      .filter(Boolean)
      .join(' ')
  },
  renderToolUseMessage() {
    return null
  },
  async call({ action = 'plan', workflow, arguments: args }) {
    const workflows = await loadWorkflowDefinitions()
    if (action === 'list') {
      return {
        data: {
          action,
          status: 'ready',
          availableWorkflows: workflows.map(summarizeWorkflow),
        },
      }
    }

    if (!workflow?.trim()) {
      return {
        data: {
          action,
          status: 'not_found',
          error: 'Workflow name is required unless action is "list".',
          availableWorkflows: workflows.map(summarizeWorkflow),
        },
      }
    }

    const definition = findWorkflowDefinition(workflows, workflow)
    if (!definition) {
      return {
        data: {
          action,
          status: 'not_found',
          error: `Workflow not found: ${workflow}`,
          availableWorkflows: workflows.map(summarizeWorkflow),
        },
      }
    }

    const runtime = renderWorkflowRuntime(definition, args, action)
    return {
      data: {
        action,
        status: runtime.plan.status,
        workflow: summarizeWorkflow(definition),
        runtime: runtime.plan,
        prompt: runtime.prompt,
      },
      contextModifier:
        runtime.plan.status === 'ready' &&
        runtime.plan.executionPolicy.enforceAllowedTools
          ? (context: ToolUseContext) => ({
              ...context,
              workflowExecutionPolicy: {
                ...runtime.plan.executionPolicy,
                workflowName: runtime.plan.name,
              },
            })
          : undefined,
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const output = content as Output
    if (output.error) {
      const available = output.availableWorkflows?.length
        ? '\n\nAvailable workflows:\n' +
          output.availableWorkflows
            .map(workflow => `- ${workflow.name}: ${workflow.description}`)
            .join('\n')
        : ''
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: output.error + available,
        is_error: true,
      }
    }
    if (output.availableWorkflows && !output.workflow) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: renderAvailableWorkflows(output.availableWorkflows as never),
      }
    }
    if (output.runtime?.status === 'needs_arguments') {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [
          `Workflow ${output.runtime.name} needs arguments before execution.`,
          `Missing: ${output.runtime.argumentStatus.missing.join(', ')}`,
          '',
          output.prompt ?? '',
        ].join('\n'),
        is_error: true,
      }
    }
    if (output.runtime && output.action === 'plan') {
      const planLines = [
        `Workflow runtime plan: ${output.runtime.name}`,
        `Status: ${output.runtime.status}`,
        output.runtime.allowedTools.length
          ? `Allowed tools: ${output.runtime.allowedTools.join(', ')}`
          : 'Allowed tools: inherit current DSXU tool policy',
        `Tool policy: ${output.runtime.executionPolicy.policyHint}`,
        `Execution route: ${output.runtime.executionStrategy.phases.join(' -> ')}`,
        output.runtime.executionStrategy.requiresRecovery
          ? 'Recovery: required by workflow strategy'
          : 'Recovery: not required unless execution fails',
        output.runtime.executionStrategy.requiresVerification
          ? 'Verification: required by workflow strategy'
          : 'Verification: inherit current DSXU verification policy',
        output.runtime.executionStrategy.requiresCompactBrief
          ? 'Compact brief: required by workflow strategy'
          : 'Compact brief: optional',
        'Steps:',
        ...output.runtime.steps.map(step => `${step.index}. ${step.title}`),
        '',
        output.runtime.nextAction,
        '',
        output.prompt ?? '',
      ]
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: planLines.join('\n'),
      }
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: output.prompt ?? 'Workflow loaded.',
    }
  },
} satisfies ToolDef<InputSchema, Output>)
