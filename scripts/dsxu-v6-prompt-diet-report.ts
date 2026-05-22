import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildDSXUPromptSectionPlan } from '../src/dsxu/engine/prompt-section-router.js'
import { compileDSXUToolView } from '../src/dsxu/engine/tool-catalog-v1.js'

const ROOT = process.cwd()
const DATE = '20260519'
const OUT_JSON = join(ROOT, 'docs', 'generated', `DSXU_V6_PROMPT_DIET_REPORT_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_PROMPT_DIET_REPORT_${DATE}.md`)

async function main(): Promise<void> {
  const promptSource = await readFile(join(ROOT, 'src', 'constants', 'prompts.ts'), 'utf8')
  const baselineChars = promptSource.length
  const singleFileToolView = compileDSXUToolView({
    taskType: 'single_file_edit',
    tools: ['Read', 'Edit', 'Bash', 'Grep', 'MCPDocs', 'SkillRunner', 'SwarmCoordinator', 'TeamCreate'],
  })
  const singleFilePlan = buildDSXUPromptSectionPlan({
    taskType: 'single_file_edit',
    toolView: singleFileToolView,
    riskLevel: 'low',
  })
  const longTaskToolView = compileDSXUToolView({
    taskType: 'long_task',
    tools: ['Read', 'Grep', 'Todo', 'Agent', 'Bash', 'SkillRunner', 'MCPDocs'],
    explicitAllowToolIds: ['Agent'],
  })
  const longTaskPlan = buildDSXUPromptSectionPlan({
    taskType: 'long_task',
    toolView: longTaskToolView,
    riskLevel: 'high',
    taskContractAllows: ['agent.serial-worker', 'agent.parallel-fanout'],
    matchedSkillIds: ['code-review'],
    mcpResourceRefs: ['mcp://local/docs'],
  })
  const report = {
    schemaVersion: 'dsxu.v6.prompt-diet-report.v1',
    generatedAt: new Date().toISOString(),
    baselinePromptSourceChars: baselineChars,
    plans: {
      singleFileEdit: singleFilePlan,
      longTaskWithExperts: longTaskPlan,
    },
    status:
      singleFilePlan.guards.length === 0 &&
      singleFilePlan.promptChars < baselineChars &&
      singleFilePlan.forbiddenLongSectionsPresent.length === 0
        ? 'PASS_V6_PROMPT_SECTION_ROUTER'
        : 'BLOCKED_V6_PROMPT_SECTION_ROUTER',
  }
  await mkdir(join(ROOT, 'docs', 'generated'), { recursive: true })
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(
    OUT_MD,
    [
      `# DSXU V6 Prompt Diet Report - ${DATE}`,
      '',
      `- status: \`${report.status}\``,
      '',
      `- baselinePromptSourceChars: ${baselineChars}`,
      `- singleFilePromptChars: ${singleFilePlan.promptChars}`,
      `- singleFileForbiddenLongSections: ${singleFilePlan.forbiddenLongSectionsPresent.join(', ') || 'none'}`,
      `- longTaskPromptChars: ${longTaskPlan.promptChars}`,
      '',
    ].join('\n'),
    'utf8',
  )
  console.log(JSON.stringify({
    status: report.status,
    baselinePromptSourceChars: baselineChars,
    singleFilePromptChars: singleFilePlan.promptChars,
    longTaskPromptChars: longTaskPlan.promptChars,
    outputs: {
      json: 'docs/generated/DSXU_V6_PROMPT_DIET_REPORT_20260519.json',
      markdown: 'docs/DSXU_V6_PROMPT_DIET_REPORT_20260519.md',
    },
  }, null, 2))
}

await main()
