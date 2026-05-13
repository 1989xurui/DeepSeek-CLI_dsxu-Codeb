import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { FILE_UNCHANGED_STUB } from '../../../tools/FileReadTool/prompt'

const FILE_READ_PROMPT_SOURCE = join(
  process.cwd(),
  'src/tools/FileReadTool/prompt.ts',
)

describe('FileRead cache progress V1', () => {
  test('unchanged Read result tells weak models to advance the cursor', () => {
    expect(FILE_UNCHANGED_STUB).toContain('DSXU tool state: read_cache_hit')
    expect(FILE_UNCHANGED_STUB).toContain('successful fresh evidence')
    expect(FILE_UNCHANGED_STUB).toContain('mark this Read step complete and advance')
    expect(FILE_UNCHANGED_STUB).toContain('do not Read this same file again')
  })

  test('runtime profile source exposes cache-hit anti-loop guidance without auth', () => {
    const source = readFileSync(FILE_READ_PROMPT_SOURCE, 'utf8')

    expect(source).toContain('advance the cursor')
    expect(source).toContain('repeating the same Read/Edit')
  })
})
