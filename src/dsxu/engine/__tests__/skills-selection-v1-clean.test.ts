import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { SkillRegistry } from '../skills-registry-v1'

describe('DSXU skills selection clean checks', () => {
  test('registers and retrieves bundled skills through the single DSXU registry', () => {
    const registry = new SkillRegistry()

    registry.registerBundledSkill({
      name: 'analysis-skill',
      description: 'Use for bounded source analysis with evidence.',
      userInvocable: true,
      getPromptForCommand: command => [{ text: `analysis:${command}` }],
    })

    const skill = registry.getBundledSkill('analysis-skill')
    expect(skill?.name).toBe('analysis-skill')
    expect(skill?.description).toContain('bounded source analysis')
    expect(skill?.getPromptForCommand('inspect')[0]?.text).toBe('analysis:inspect')
  })

  test('skill descriptions stay evidence-oriented for weak-model selection', () => {
    const registry = new SkillRegistry()

    registry.registerBundledSkill({
      name: 'verification-skill',
      description: 'Use after edits to run verification and report PASS only from evidence.',
      userInvocable: true,
      getPromptForCommand: command => [{ text: `verify:${command}:evidence` }],
    })

    const skill = registry.getBundledSkill('verification-skill')
    const prompt = skill?.getPromptForCommand('test') ?? []

    expect(skill?.description).toMatch(/verification|evidence|PASS/i)
    expect(prompt.map(item => item.text).join('\n')).toContain('evidence')
  })

  test('does not depend on a second skills registry or prompt-stack runtime', () => {
    const text = readFileSync(join(process.cwd(), 'src/dsxu/engine/skills-registry-v1.ts'), 'utf8')

    expect(text).not.toContain('skills-registry-v2')
    expect(text).not.toContain('prompt-stack-v1')
    expect(text).not.toContain("from './query-loop'")
    expect(text).not.toContain("from './runtime-core'")
  })
})
