import { describe, expect, test } from 'bun:test'
import { isContextAdvancedArgs } from '../context-noninteractive'

describe('isContextAdvancedArgs', () => {
  test('recognizes explicit advanced context flags', () => {
    expect(isContextAdvancedArgs('--advanced')).toBe(true)
    expect(isContextAdvancedArgs('  --advanced  ')).toBe(true)
    expect(isContextAdvancedArgs('-a')).toBe(true)
  })

  test('does not enable advanced output by default', () => {
    expect(isContextAdvancedArgs('')).toBe(false)
    expect(isContextAdvancedArgs('--all')).toBe(false)
  })
})
