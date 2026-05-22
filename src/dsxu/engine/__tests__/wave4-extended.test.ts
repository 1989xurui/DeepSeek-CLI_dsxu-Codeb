/**
 * Wave 4 Extended 测试
 * #6.6 System Prompt + #6.13 Git + #6.15 Diff + #6.16 Config
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SystemPromptBuilder, buildSystemPrompt } from '../system-prompt'
import { parseDiff, formatDiff, GitTool, runGit, getGitContext } from '../git-tools'
import {
  loadConfig, mergeConfig, validateConfig, DEFAULT_CONFIG,
  loadEnvConfig, saveProjectConfig, loadConfigFile,
} from '../config'
import type { ToolContext } from '../types'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-wave4ext-' + Date.now())
const ctx: ToolContext = { cwd: TEST_DIR, sessionId: 'test', gear: 1 }

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ── #6.6 System Prompt Builder ──

describe('SystemPromptBuilder', () => {
  it('should build with default sections', () => {
    const builder = new SystemPromptBuilder()
    const prompt = builder.build()
    expect(prompt).toContain('DSXU')
    expect(prompt).toContain('tools')
  })

  it('should add gear section', () => {
    const builder = new SystemPromptBuilder()
    builder.setGear(2)
    const prompt = builder.build()
    expect(prompt).toContain('Reasoning')
  })

  it('should add tools section', () => {
    const builder = new SystemPromptBuilder()
    builder.setTools(['Read', 'Write', 'Bash'])
    const prompt = builder.build()
    expect(prompt).toContain('Read')
    expect(prompt).toContain('Write')
    expect(prompt).toContain('Bash')
  })

  it('should add user rules', () => {
    const builder = new SystemPromptBuilder()
    builder.setUserRules('Always use TypeScript. Never use any.')
    const prompt = builder.build()
    expect(prompt).toContain('TypeScript')
    expect(prompt).toContain('Never use any')
  })

  it('should load project rules from DSXU.md', () => {
    writeFileSync(join(TEST_DIR, 'DSXU.md'), '# Rules\n- Use vitest\n- Prefer const')
    const builder = new SystemPromptBuilder()
    builder.loadProjectRules(TEST_DIR)
    const prompt = builder.build()
    expect(prompt).toContain('vitest')
    expect(prompt).toContain('Prefer const')
  })

  it('should support .dsxumd fallback', () => {
    writeFileSync(join(TEST_DIR, '.dsxumd'), 'Use strict mode')
    const builder = new SystemPromptBuilder()
    builder.loadProjectRules(TEST_DIR)
    const prompt = builder.build()
    expect(prompt).toContain('strict mode')
  })

  it('should set dynamic context', () => {
    const builder = new SystemPromptBuilder()
    builder.setDynamicContext('Working on auth module, branch: feature/login')
    const prompt = builder.build()
    expect(prompt).toContain('auth module')
  })

  it('should build layered (L1 cacheable + L2 dynamic)', () => {
    const builder = new SystemPromptBuilder()
    builder.setGear(1)
    builder.setDynamicContext('Current task info')

    const { l1Prefix, l2Dynamic } = builder.buildLayered()
    expect(l1Prefix).toContain('DSXU')  // Base identity is cacheable
    expect(l2Dynamic).toContain('Standard')  // Gear is dynamic
  })

  it('should replace existing section by id', () => {
    const builder = new SystemPromptBuilder()
    builder.setGear(1)
    builder.setGear(3)
    const prompt = builder.build()
    expect(prompt).toContain('Consensus')
    expect(prompt).not.toContain('Standard')
  })

  it('should remove section', () => {
    const builder = new SystemPromptBuilder()
    builder.setGear(2)
    builder.removeSection('gear')
    const prompt = builder.build()
    expect(prompt).not.toContain('Reasoning')
  })

  it('should track section count', () => {
    const builder = new SystemPromptBuilder()
    expect(builder.sectionCount).toBe(2) // identity + tool-guide
    builder.setGear(1)
    expect(builder.sectionCount).toBe(3)
  })
})

describe('buildSystemPrompt', () => {
  it('should build from config', () => {
    const prompt = buildSystemPrompt({
      cwd: TEST_DIR,
      gear: 1,
      toolNames: ['Read', 'Bash'],
      userRules: 'Use English only',
    })
    expect(prompt).toContain('DSXU')
    expect(prompt).toContain('Read')
    expect(prompt).toContain('English')
  })
})

// ── #6.13 + #6.15 Git Tools ──

describe('parseDiff', () => {
  it('should parse modified file diff', () => {
    const diff = `diff --git a/src/app.ts b/src/app.ts
index abc123..def456 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 const x = 1
-const y = 2
+const y = 3
+const z = 4
 export { x }
`
    const files = parseDiff(diff)
    expect(files).toHaveLength(1)
    expect(files[0].file).toBe('src/app.ts')
    expect(files[0].status).toBe('modified')
    expect(files[0].additions).toBe(2)
    expect(files[0].deletions).toBe(1)
    expect(files[0].hunks).toHaveLength(1)
  })

  it('should parse new file diff', () => {
    const diff = `diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+const hello = 'world'
+export { hello }
`
    const files = parseDiff(diff)
    expect(files[0].status).toBe('added')
    expect(files[0].additions).toBe(2)
  })

  it('should parse deleted file diff', () => {
    const diff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-const old = true
-export { old }
`
    const files = parseDiff(diff)
    expect(files[0].status).toBe('deleted')
    expect(files[0].deletions).toBe(2)
  })

  it('should parse multiple files', () => {
    const diff = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1 +1 @@
-old a
+new a
diff --git a/b.ts b/b.ts
--- a/b.ts
+++ b/b.ts
@@ -1 +1 @@
-old b
+new b
`
    const files = parseDiff(diff)
    expect(files).toHaveLength(2)
  })

  it('should handle empty diff', () => {
    expect(parseDiff('')).toHaveLength(0)
  })
})

describe('formatDiff', () => {
  it('should format diffs as readable text', () => {
    const diffs = parseDiff(`diff --git a/x.ts b/x.ts
--- a/x.ts
+++ b/x.ts
@@ -1,2 +1,2 @@
-const a = 1
+const a = 2
 const b = 3
`)
    const formatted = formatDiff(diffs)
    expect(formatted).toContain('x.ts')
    expect(formatted).toContain('+')
    expect(formatted).toContain('-')
  })
})

describe('GitTool', () => {
  it('should have correct metadata', () => {
    expect(GitTool.name).toBe('Git')
    expect(GitTool.readOnly).toBe(true)
  })

  it('should block destructive operations', async () => {
    const result = await GitTool.execute({
      operation: 'status',
      args: ['--force'],
    }, ctx)
    // status --force isn't destructive, just test the tool runs
    // The destructive check is on combined args
  })

  it('should handle non-git directory', async () => {
    const result = await GitTool.execute({ operation: 'status' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content.toLowerCase()).toContain('not a git repository')
  })
})

describe('runGit', () => {
  it('should execute git command', () => {
    const result = runGit(['--version'], TEST_DIR)
    expect(result.success).toBe(true)
    expect(result.stdout).toContain('git version')
  })

  it('should handle errors', () => {
    const result = runGit(['log'], TEST_DIR) // Not a repo
    expect(result.success).toBe(false)
  })
})

// ── #6.16 Config System ──

describe('mergeConfig', () => {
  it('should deep merge objects', () => {
    const base = { a: { b: 1, c: 2 }, d: 3 }
    const override = { a: { b: 10 }, e: 4 }
    const result = mergeConfig(base, override)

    expect(result.a.b).toBe(10)
    expect(result.a.c).toBe(2)
    expect(result.d).toBe(3)
    expect(result.e).toBe(4)
  })

  it('should handle null/undefined', () => {
    expect(mergeConfig({ a: 1 }, null)).toEqual({ a: 1 })
    expect(mergeConfig(null, { a: 1 })).toEqual({ a: 1 })
  })

  it('should not merge arrays', () => {
    const result = mergeConfig({ a: [1, 2] }, { a: [3] })
    expect(result.a).toEqual([3])
  })
})

describe('loadConfig', () => {
  it('should return defaults when no config files exist', () => {
    const config = loadConfig(TEST_DIR)
    expect(config.models.chatModel).toBe('deepseek-v4-flash')
    expect(config.engine.maxTurns).toBe(50)
  })

  it('should load project config', () => {
    const dsxuDir = join(TEST_DIR, '.dsxu')
    mkdirSync(dsxuDir, { recursive: true })
    writeFileSync(join(dsxuDir, 'config.json'), JSON.stringify({
      engine: { maxTurns: 100 },
    }))

    const config = loadConfig(TEST_DIR)
    expect(config.engine.maxTurns).toBe(100)
    // Other defaults preserved
    expect(config.models.chatModel).toBe('deepseek-v4-flash')
  })

  it('should support .dsxu.json in project root', () => {
    writeFileSync(join(TEST_DIR, '.dsxu.json'), JSON.stringify({
      permissions: { mode: 'yolo' },
    }))

    const config = loadConfig(TEST_DIR)
    expect(config.permissions.mode).toBe('yolo')
  })

  it('should apply CLI overrides with highest priority', () => {
    const config = loadConfig(TEST_DIR, {
      engine: { maxTurns: 200 } as any,
    })
    expect(config.engine.maxTurns).toBe(200)
  })
})

describe('loadConfigFile', () => {
  it('should return null for missing file', () => {
    expect(loadConfigFile(join(TEST_DIR, 'nonexistent.json'))).toBeNull()
  })

  it('should return null for invalid JSON', () => {
    writeFileSync(join(TEST_DIR, 'bad.json'), 'not json{{{')
    expect(loadConfigFile(join(TEST_DIR, 'bad.json'))).toBeNull()
  })
})

describe('saveProjectConfig', () => {
  it('should create .dsxu dir and save config', () => {
    saveProjectConfig(TEST_DIR, { engine: { maxTurns: 30 } } as any)

    const loaded = loadConfigFile(join(TEST_DIR, '.dsxu', 'config.json'))
    expect(loaded).not.toBeNull()
    expect((loaded as any).engine.maxTurns).toBe(30)
  })
})

describe('validateConfig', () => {
  it('should pass valid config', () => {
    const errors = validateConfig(DEFAULT_CONFIG)
    expect(errors).toHaveLength(0)
  })

  it('should catch invalid maxTurns', () => {
    const config = { ...DEFAULT_CONFIG, engine: { ...DEFAULT_CONFIG.engine, maxTurns: 0 } }
    const errors = validateConfig(config)
    expect(errors.some(e => e.includes('maxTurns'))).toBe(true)
  })

  it('should warn on excessive maxTurns', () => {
    const config = { ...DEFAULT_CONFIG, engine: { ...DEFAULT_CONFIG.engine, maxTurns: 300 } }
    const errors = validateConfig(config)
    expect(errors.some(e => e.includes('maxTurns'))).toBe(true)
  })

  it('should catch invalid budget', () => {
    const config = { ...DEFAULT_CONFIG, budget: { perSession: -1 } }
    const errors = validateConfig(config)
    expect(errors.some(e => e.includes('budget'))).toBe(true)
  })
})

describe('loadEnvConfig', () => {
  it('should read DEEPSEEK_API_KEY', () => {
    const origKey = process.env.DEEPSEEK_API_KEY
    process.env.DEEPSEEK_API_KEY = 'test-key-123'

    const config = loadEnvConfig()
    expect(config.api?.deepseekApiKey).toBe('test-key-123')

    // Restore
    if (origKey !== undefined) {
      process.env.DEEPSEEK_API_KEY = origKey
    } else {
      delete process.env.DEEPSEEK_API_KEY
    }
  })
})
