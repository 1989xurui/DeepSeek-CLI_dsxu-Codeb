import { basename, dirname, relative, sep } from 'path'
import {
  parseArguments,
  parseArgumentNames,
  substituteArguments,
} from '../../utils/argumentSubstitution.js'
import { pwd } from '../../utils/cwd.js'
import {
  coerceDescriptionToString,
  type FrontmatterData,
} from '../../utils/frontmatterParser.js'
import {
  loadMarkdownFilesForSubdir,
  parseSlashCommandToolsFromFrontmatter,
  type MarkdownFile,
} from '../../utils/markdownConfigLoader.js'

export type WorkflowDefinition = {
  name: string
  description: string
  filePath: string
  source: MarkdownFile['source']
  content: string
  argumentNames: string[]
  allowedTools: string[]
}

export type WorkflowRuntimeStep = {
  index: number
  kind: 'heading' | 'ordered' | 'checkbox' | 'bullet' | 'body'
  title: string
}

export type WorkflowArgumentStatus = {
  required: string[]
  provided: string[]
  missing: string[]
}

export type WorkflowRuntimePlan = {
  action: 'list' | 'plan' | 'render'
  status: 'ready' | 'needs_arguments'
  name: string
  description: string
  source: MarkdownFile['source']
  filePath: string
  allowedTools: string[]
  executionPolicy: WorkflowExecutionPolicy
  executionStrategy: WorkflowExecutionStrategy
  argumentStatus: WorkflowArgumentStatus
  steps: WorkflowRuntimeStep[]
  nextAction: string
}

export type WorkflowExecutionPolicy = {
  enforceAllowedTools: boolean
  allowedTools: string[]
  blockedTools: string[]
  policyHint: string
}

export type WorkflowExecutionStrategy = {
  phases: Array<'inspect' | 'test' | 'delegate' | 'edit' | 'recover' | 'verify' | 'compact'>
  requiresRecovery: boolean
  requiresVerification: boolean
  requiresCompactBrief: boolean
  routeHint: string
}

function workflowNameForFile(filePath: string, baseDir: string): string {
  const fileName = basename(filePath).replace(/\.md$/, '')
  const fileDir = dirname(filePath)
  const namespace = relative(baseDir, fileDir)
    .split(sep)
    .filter(Boolean)
    .join(':')
  return namespace && namespace !== '.' ? `${namespace}:${fileName}` : fileName
}

function descriptionFromFrontmatter(
  frontmatter: FrontmatterData,
  content: string,
): string {
  const coerced = coerceDescriptionToString(frontmatter.description)
  if (coerced) return coerced
  const firstLine = content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)
  return firstLine?.replace(/^#+\s*/, '') || 'DSXU workflow'
}

export async function loadWorkflowDefinitions(
  cwd: string = pwd(),
): Promise<WorkflowDefinition[]> {
  const files = await loadMarkdownFilesForSubdir('workflows', cwd)
  return files.map(file => ({
    name: workflowNameForFile(file.filePath, file.baseDir),
    description: descriptionFromFrontmatter(file.frontmatter, file.content),
    filePath: file.filePath,
    source: file.source,
    content: file.content,
    argumentNames: parseArgumentNames(file.frontmatter.arguments),
    allowedTools: parseSlashCommandToolsFromFrontmatter(file.frontmatter.tools),
  }))
}

export function findWorkflowDefinition(
  workflows: WorkflowDefinition[],
  name: string,
): WorkflowDefinition | undefined {
  const normalized = name.trim().toLowerCase()
  return workflows.find(workflow => workflow.name.toLowerCase() === normalized)
}

export function renderWorkflowPrompt(
  workflow: WorkflowDefinition,
  args: string | undefined,
): string {
  const body = substituteArguments(
    workflow.content,
    args,
    true,
    workflow.argumentNames,
  )
  return [
    `# Workflow: ${workflow.name}`,
    `Source: ${workflow.filePath}`,
    workflow.allowedTools.length > 0
      ? `Allowed tools: ${workflow.allowedTools.join(', ')}`
      : undefined,
    '',
    body,
  ]
    .filter(line => line !== undefined)
    .join('\n')
}

function cleanStepTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function extractWorkflowSteps(content: string): WorkflowRuntimeStep[] {
  const steps: WorkflowRuntimeStep[] = []
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const heading = trimmed.match(/^#{2,6}\s+(.+)$/)
    if (heading?.[1]) {
      steps.push({
        index: steps.length + 1,
        kind: 'heading',
        title: cleanStepTitle(heading[1]),
      })
      continue
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (ordered?.[1]) {
      steps.push({
        index: steps.length + 1,
        kind: 'ordered',
        title: cleanStepTitle(ordered[1]),
      })
      continue
    }

    const checkbox = trimmed.match(/^[-*]\s+\[[ xX]\]\s+(.+)$/)
    if (checkbox?.[1]) {
      steps.push({
        index: steps.length + 1,
        kind: 'checkbox',
        title: cleanStepTitle(checkbox[1]),
      })
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(Step\s+\d+[:.)-]?\s*)?(.+)$/i)
    if (bullet?.[1] && bullet[2]) {
      steps.push({
        index: steps.length + 1,
        kind: 'bullet',
        title: cleanStepTitle(bullet[2]),
      })
    }
  }

  if (steps.length === 0) {
    const firstInstruction = lines
      .map(line => line.trim())
      .find(line => line && !line.startsWith('---'))
    return [
      {
        index: 1,
        kind: 'body',
        title: cleanStepTitle(firstInstruction || 'Execute workflow instructions'),
      },
    ]
  }

  return steps.slice(0, 24).map((step, index) => ({
    ...step,
    index: index + 1,
  }))
}

export function analyzeWorkflowArguments(
  workflow: WorkflowDefinition,
  args: string | undefined,
): WorkflowArgumentStatus {
  const provided = parseArguments(args ?? '')
  const missing = workflow.argumentNames.slice(provided.length)
  return {
    required: workflow.argumentNames,
    provided,
    missing,
  }
}

export function buildWorkflowExecutionPolicy(
  workflow: WorkflowDefinition,
  availableTools: string[] = [
    'Read',
    'Grep',
    'Edit',
    'Write',
    'Bash',
    'workflow',
    'Task',
    'MCP',
  ],
): WorkflowExecutionPolicy {
  const allowed = [...new Set(workflow.allowedTools.map(tool => tool.trim()).filter(Boolean))]
  const enforceAllowedTools = allowed.length > 0
  const blockedTools = enforceAllowedTools
    ? availableTools.filter(tool => !allowed.includes(tool))
    : []
  return {
    enforceAllowedTools,
    allowedTools: allowed,
    blockedTools,
    policyHint: enforceAllowedTools
      ? `Only use workflow-declared tools: ${allowed.join(', ')}. Block other tools unless the user explicitly expands scope.`
      : 'Workflow did not declare tools; inherit the current DSXU tool policy.',
  }
}

export function buildWorkflowExecutionStrategy(
  workflow: WorkflowDefinition,
  steps: WorkflowRuntimeStep[],
): WorkflowExecutionStrategy {
  const text = [workflow.name, workflow.description, workflow.content, ...steps.map(step => step.title)]
    .join('\n')
    .toLowerCase()
  const phases: WorkflowExecutionStrategy['phases'] = []
  const addPhase = (phase: WorkflowExecutionStrategy['phases'][number]) => {
    if (!phases.includes(phase)) phases.push(phase)
  }

  addPhase('inspect')
  if (/\b(test|tdd|red failure|regression|bun test|pytest|verify)\b/.test(text)) {
    addPhase('test')
  }
  if (/\b(agent|delegate|subagent|reviewer|parallel)\b/.test(text)) {
    addPhase('delegate')
  }
  if (/\b(edit|write|fix|modify|implement|patch)\b/.test(text)) {
    addPhase('edit')
  }
  const requiresRecovery = /\b(recover|failure|retry|rollback|classify)\b/.test(text)
  if (requiresRecovery) addPhase('recover')
  const requiresVerification = /\b(test|verify|retest|green|acceptance|review)\b/.test(text)
  if (requiresVerification) addPhase('verify')
  const requiresCompactBrief = /\b(compact|resume brief|brief|summary)\b/.test(text)
  if (requiresCompactBrief) addPhase('compact')

  return {
    phases,
    requiresRecovery,
    requiresVerification,
    requiresCompactBrief,
    routeHint: `Workflow route: ${phases.join(' -> ')}.`,
  }
}

export function buildWorkflowRuntimePlan(
  workflow: WorkflowDefinition,
  args: string | undefined,
  action: WorkflowRuntimePlan['action'] = 'plan',
): WorkflowRuntimePlan {
  const body = substituteArguments(
    workflow.content,
    args,
    true,
    workflow.argumentNames,
  )
  const argumentStatus = analyzeWorkflowArguments(workflow, args)
  const status =
    argumentStatus.missing.length > 0 ? 'needs_arguments' : 'ready'
  const steps = extractWorkflowSteps(body)
  return {
    action,
    status,
    name: workflow.name,
    description: workflow.description,
    source: workflow.source,
    filePath: workflow.filePath,
    allowedTools: workflow.allowedTools,
    executionPolicy: buildWorkflowExecutionPolicy(workflow),
    executionStrategy: buildWorkflowExecutionStrategy(workflow, steps),
    argumentStatus,
    steps,
    nextAction:
      status === 'needs_arguments'
        ? `Ask for missing workflow argument(s): ${argumentStatus.missing.join(', ')}`
        : 'Execute the rendered workflow prompt with normal DSXU tools while respecting allowedTools and the executionStrategy route.',
  }
}

export function renderWorkflowRuntime(
  workflow: WorkflowDefinition,
  args: string | undefined,
  action: WorkflowRuntimePlan['action'] = 'plan',
): { prompt: string; plan: WorkflowRuntimePlan } {
  return {
    prompt: renderWorkflowPrompt(workflow, args),
    plan: buildWorkflowRuntimePlan(workflow, args, action),
  }
}
