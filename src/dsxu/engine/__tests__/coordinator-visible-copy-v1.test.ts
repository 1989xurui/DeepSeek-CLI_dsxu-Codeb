import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getCoordinatorSystemPrompt } from '../../../coordinator/coordinatorMode'

const MOJIBAKE_PATTERN = /\uFFFD|\u951f\u65a4\u62f7|\u9239|\u923a|\u923b|\u9242|\u9245/

describe('coordinator visible copy V1', () => {
  test('keeps coordinator prompt free of mojibake markers', () => {
    const prompt = getCoordinatorSystemPrompt()

    expect(prompt).toContain('Always synthesize')
    expect(prompt).toContain('Parallelism is your superpower')
    expect(prompt).not.toMatch(MOJIBAKE_PATTERN)
  })

  test('keeps coordinator mode source free of replacement mojibake tokens', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/coordinator/coordinatorMode.ts'),
      'utf8',
    )

    expect(source).not.toMatch(MOJIBAKE_PATTERN)
  })
})
