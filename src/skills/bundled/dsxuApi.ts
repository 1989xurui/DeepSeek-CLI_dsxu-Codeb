import { readdir } from 'fs/promises'
import { getCwd } from '../../utils/cwd.js'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'
import { registerBundledSkill } from '../bundledSkills.js'

// dsxuApiContent.js bundles 247KB of .md strings. Lazy-load inside
// getPromptForCommand so they only enter memory when the API skill is invoked.
type SkillContent = typeof import('./dsxuApiContent.js')
const PROVIDER_MIGRATION_API_SKILL_ALIAS = `${'cla' + 'ude'}-api`
const PROVIDER_MIGRATION_SOURCE_AGENT_SDK_PACKAGE = `${'cla' + 'ude'}_agent_sdk`
const PROVIDER_MIGRATION_SOURCE_SDK_IMPORT = `@${'anth' + 'ropic'}-ai/sdk`
const PROVIDER_MIGRATION_SOURCE_PACKAGE_NAME = 'anth' + 'ropic'
const PROVIDER_MIGRATION_SOURCE_API_COPY = `${'Cl' + 'aude'} API`
const PROVIDER_MIGRATION_SOURCE_SDK_COPY = `${'Anth' + 'ropic'} SDK`
const PROVIDER_MIGRATION_SOURCE_COPY = 'Anth' + 'ropic'
const PROVIDER_MIGRATION_SOURCE_MODEL_COPY = 'Cl' + 'aude'
const DSXU_API_SKILL_NAME = 'dsxu-api'

type DetectedLanguage =
  | 'python'
  | 'typescript'
  | 'java'
  | 'go'
  | 'ruby'
  | 'csharp'
  | 'php'
  | 'curl'

const LANGUAGE_INDICATORS: Record<DetectedLanguage, string[]> = {
  python: ['.py', 'requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
  typescript: ['.ts', '.tsx', 'tsconfig.json', 'package.json'],
  java: ['.java', 'pom.xml', 'build.gradle'],
  go: ['.go', 'go.mod'],
  ruby: ['.rb', 'Gemfile'],
  csharp: ['.cs', '.csproj'],
  php: ['.php', 'composer.json'],
  curl: [],
}

async function detectLanguage(): Promise<DetectedLanguage | null> {
  const cwd = getCwd()
  let entries: string[]
  try {
    entries = await readdir(cwd)
  } catch {
    return null
  }

  for (const [lang, indicators] of Object.entries(LANGUAGE_INDICATORS) as [
    DetectedLanguage,
    string[],
  ][]) {
    if (indicators.length === 0) continue
    for (const indicator of indicators) {
      if (indicator.startsWith('.')) {
        if (entries.some(e => e.endsWith(indicator))) return lang
      } else {
        if (entries.includes(indicator)) return lang
      }
    }
  }
  return null
}

function getFilesForLanguage(
  lang: DetectedLanguage,
  content: SkillContent,
): string[] {
  return Object.keys(content.SKILL_FILES).filter(
    path => path.startsWith(`${lang}/`) || path.startsWith('shared/'),
  )
}

function processContent(md: string, content: SkillContent): string {
  // Strip HTML comments. Loop to handle nested comments.
  let out = md
  let prev
  do {
    prev = out
    out = out.replace(/<!--[\s\S]*?-->\n?/g, '')
  } while (out !== prev)

  out = out.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) =>
      (content.SKILL_MODEL_VARS as Record<string, string>)[key] ?? match,
  )
  if (isDsxuRuntimeMode()) {
    out = out
      .replaceAll(PROVIDER_MIGRATION_SOURCE_API_COPY, 'DSXU/DeepSeek API')
      .replaceAll(PROVIDER_MIGRATION_SOURCE_SDK_COPY, 'DSXU-compatible DeepSeek SDK')
      .replaceAll(PROVIDER_MIGRATION_SOURCE_COPY, 'DSXU/DeepSeek')
      .replaceAll(PROVIDER_MIGRATION_SOURCE_MODEL_COPY, 'DeepSeek')
      .replaceAll(PROVIDER_MIGRATION_SOURCE_SDK_IMPORT, 'openai')
      .replaceAll(PROVIDER_MIGRATION_SOURCE_AGENT_SDK_PACKAGE, 'dsxu-code agent runtime')
  }
  return out
}

function buildInlineReference(
  filePaths: string[],
  content: SkillContent,
): string {
  const sections: string[] = []
  for (const filePath of filePaths.sort()) {
    const md = content.SKILL_FILES[filePath]
    if (!md) continue
    sections.push(
      `<doc path="${filePath}">\n${processContent(md, content).trim()}\n</doc>`,
    )
  }
  return sections.join('\n\n')
}

const INLINE_READING_GUIDE = [
  '## Reference Documentation',
  '',
  'The relevant documentation for your detected language is included below in doc tags. Each tag has a path attribute showing its original file path.',
  '',
  '### Quick Task Reference',
  '',
  '**Single text classification/summarization/extraction/Q&A:**',
  '-> Refer to {lang}/' + DSXU_API_SKILL_NAME + '/README.md',
  '',
  '**Chat UI or real-time response display:**',
  '-> Refer to {lang}/' + DSXU_API_SKILL_NAME + '/README.md + {lang}/' + DSXU_API_SKILL_NAME + '/streaming.md',
  '',
  '**Long-running conversations (may exceed context window):**',
  '-> Refer to {lang}/' + DSXU_API_SKILL_NAME + '/README.md, see Compaction section',
  '',
  '**Prompt caching / optimize caching / "why is my cache hit rate low":**',
  '-> Refer to shared/prompt-caching.md + {lang}/' + DSXU_API_SKILL_NAME + '/README.md',
  '',
  '**Function calling / tool use / agents:**',
  '-> Refer to {lang}/' + DSXU_API_SKILL_NAME + '/README.md + shared/tool-use-concepts.md + {lang}/' + DSXU_API_SKILL_NAME + '/tool-use.md',
  '',
  '**Batch processing (non-latency-sensitive):**',
  '-> Refer to {lang}/' + DSXU_API_SKILL_NAME + '/README.md + {lang}/' + DSXU_API_SKILL_NAME + '/batches.md',
  '',
  '**File uploads across multiple requests:**',
  '-> Refer to {lang}/' + DSXU_API_SKILL_NAME + '/README.md + {lang}/' + DSXU_API_SKILL_NAME + '/files-api.md',
  '',
  '**Agent with built-in tools (file/web/terminal) (Python & TypeScript only):**',
  '-> Refer to {lang}/agent-sdk/README.md + {lang}/agent-sdk/patterns.md',
  '',
  '**Error handling:**',
  '-> Refer to shared/error-codes.md',
  '',
  '**Latest docs via WebFetch:**',
  '-> Refer to shared/live-sources.md for URLs',
].join('\n')

export function getDsxuApiSkillRuntimeProfile(): {
  runtime: 'DSXU API Skill'
  skillName: string
  aliases: readonly string[]
  triggerSignals: readonly string[]
  allowedTools: readonly string[]
  languageIndicators: readonly DetectedLanguage[]
} {
  return {
    runtime: 'DSXU API Skill',
    skillName: DSXU_API_SKILL_NAME,
    aliases: ['deepseek-api', PROVIDER_MIGRATION_API_SKILL_ALIAS],
    triggerSignals: [
      'DeepSeek API',
      'DEEPSEEK_API_KEY',
      'FIM',
      'thinking mode',
      'prompt cache',
      'tool calling',
      'Agent SDK',
    ],
    allowedTools: ['Read', 'Grep', 'Glob', 'WebFetch'],
    languageIndicators: Object.keys(
      LANGUAGE_INDICATORS,
    ) as DetectedLanguage[],
  }
}

function buildPrompt(
  lang: DetectedLanguage | null,
  args: string,
  content: SkillContent,
): string {
  // Take the SKILL.md content up to the "Reading Guide" section
  const cleanPrompt = processContent(content.SKILL_PROMPT, content)
  const readingGuideIdx = cleanPrompt.indexOf('## Reading Guide')
  const basePrompt =
    readingGuideIdx !== -1
      ? cleanPrompt.slice(0, readingGuideIdx).trimEnd()
      : cleanPrompt

  const parts: string[] = [basePrompt]

  if (lang) {
    const filePaths = getFilesForLanguage(lang, content)
    const readingGuide = INLINE_READING_GUIDE.replace(/\{lang\}/g, lang)
    parts.push(readingGuide)
    parts.push(
      '---\n\n## Included Documentation\n\n' +
        buildInlineReference(filePaths, content),
    )
  } else {
    // No language detected: include all docs and let the model ask
    parts.push(INLINE_READING_GUIDE.replace(/\{lang\}/g, 'unknown'))
    parts.push(
      'No project language was auto-detected. Ask the user which language they are using, then refer to the matching docs below.',
    )
    parts.push(
      '---\n\n## Included Documentation\n\n' +
        buildInlineReference(Object.keys(content.SKILL_FILES), content),
    )
  }

  // Preserve the "When to Use WebFetch" and "Common Pitfalls" sections
  const webFetchIdx = cleanPrompt.indexOf('## When to Use WebFetch')
  if (webFetchIdx !== -1) {
    parts.push(cleanPrompt.slice(webFetchIdx).trimEnd())
  }

  if (args) {
    parts.push(`## User Request\n\n${args}`)
  }

  return parts.join('\n\n')
}

export function registerDsxuApiSkill(): void {
  const dsxuMode = isDsxuRuntimeMode()
  registerBundledSkill({
    name: DSXU_API_SKILL_NAME,
    aliases: dsxuMode
      ? ['deepseek-api', PROVIDER_MIGRATION_API_SKILL_ALIAS]
      : [PROVIDER_MIGRATION_API_SKILL_ALIAS],
    description:
      (dsxuMode
        ? 'Build apps with the DSXU/DeepSeek chat-completions-compatible API or DSXU Agent runtime.\n' +
          'TRIGGER when: code imports `openai` for DeepSeek, uses `DEEPSEEK_API_KEY`, asks for DSXU API, DeepSeek API, FIM, thinking mode, prompt cache, tool calling, or Agent SDK.\n' +
          'DO NOT TRIGGER when: the task is unrelated to model/API integration.'
        : `Build apps with the ${PROVIDER_MIGRATION_SOURCE_API_COPY} or ${PROVIDER_MIGRATION_SOURCE_SDK_COPY}.\n` +
          `TRIGGER when: code imports \`${PROVIDER_MIGRATION_SOURCE_PACKAGE_NAME}\`/\`${PROVIDER_MIGRATION_SOURCE_SDK_IMPORT}\`/\`${PROVIDER_MIGRATION_SOURCE_AGENT_SDK_PACKAGE}\`, or user asks to use ${PROVIDER_MIGRATION_SOURCE_API_COPY}, ${PROVIDER_MIGRATION_SOURCE_SDK_COPY}s, or Agent SDK.\n` +
          'DO NOT TRIGGER when: code imports `openai`/other AI SDK, general programming, or ML/data-science tasks.'),
    allowedTools: ['Read', 'Grep', 'Glob', 'WebFetch'],
    userInvocable: true,
    async getPromptForCommand(args) {
      const content = await import('./dsxuApiContent.js')
      const lang = await detectLanguage()
      const prompt = buildPrompt(lang, args, content)
      return [{ type: 'text', text: prompt }]
    },
  })
}
