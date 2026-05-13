import { afterEach, describe, expect, test } from 'bun:test'
import {
  buildDsxuRuntimeCompactMemoryPrompt,
  shouldUseDsxuRuntimeCompactMemoryPrompt,
} from '../../../memdir/memdir'

const originalDsxuCodeMode = process.env.DSXU_CODE_MODE
const originalCompactMemoryPrompt =
  process.env.DSXU_CODE_COMPACT_MEMORY_PROMPT
const originalFullMemoryPrompt = process.env.DSXU_CODE_FULL_MEMORY_PROMPT

afterEach(() => {
  if (originalDsxuCodeMode === undefined) delete process.env.DSXU_CODE_MODE
  else process.env.DSXU_CODE_MODE = originalDsxuCodeMode
  if (originalCompactMemoryPrompt === undefined) {
    delete process.env.DSXU_CODE_COMPACT_MEMORY_PROMPT
  } else {
    process.env.DSXU_CODE_COMPACT_MEMORY_PROMPT =
      originalCompactMemoryPrompt
  }
  if (originalFullMemoryPrompt === undefined) {
    delete process.env.DSXU_CODE_FULL_MEMORY_PROMPT
  } else {
    process.env.DSXU_CODE_FULL_MEMORY_PROMPT = originalFullMemoryPrompt
  }
})

describe('DSXU runtime memory prompt cache budget V1', () => {
  test('uses compact memory guidance only when explicitly enabled, with a full prompt escape hatch', () => {
    delete process.env.DSXU_CODE_MODE
    delete process.env.DSXU_CODE_COMPACT_MEMORY_PROMPT
    delete process.env.DSXU_CODE_FULL_MEMORY_PROMPT
    expect(shouldUseDsxuRuntimeCompactMemoryPrompt()).toBe(false)

    process.env.DSXU_CODE_MODE = '1'
    expect(shouldUseDsxuRuntimeCompactMemoryPrompt()).toBe(false)

    process.env.DSXU_CODE_COMPACT_MEMORY_PROMPT = '1'
    expect(shouldUseDsxuRuntimeCompactMemoryPrompt()).toBe(true)

    process.env.DSXU_CODE_FULL_MEMORY_PROMPT = '1'
    expect(shouldUseDsxuRuntimeCompactMemoryPrompt()).toBe(false)
  })

  test('keeps memory useful while staying within the dynamic-tail budget', () => {
    const prompt = buildDsxuRuntimeCompactMemoryPrompt({
      memoryDir: 'C:/Users/h/.dsxu/memory',
      extraGuidelines: ['Prefer short durable memories over transcript summaries.'],
    })

    expect(prompt.length).toBeLessThan(3_500)
    expect(prompt).toContain('# auto memory')
    expect(prompt).toContain('Persistent memory directory')
    expect(prompt).toContain('Do not treat memory as source truth')
    expect(prompt).toContain('Before editing, reread the current files')
    expect(prompt).toContain('Save/forget policy')
    expect(prompt).toContain('How to save')
    expect(prompt).toContain('type: user | feedback | project | reference')
    expect(prompt).toContain('Type guide')
    expect(prompt).toContain('When to access')
    expect(prompt).toContain('Prefer short durable memories')
    expect(prompt).not.toMatch(/[\uFFFD\u951F\u9225]/)
  })
})
