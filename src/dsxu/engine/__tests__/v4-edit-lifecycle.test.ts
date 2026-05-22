import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { BashTool } from '../../../tools/BashTool/BashTool'
import { NotebookEditTool } from '../../../tools/NotebookEditTool/NotebookEditTool'
import type { AssistantMessage } from '../../../types/message'
import { getFileModificationTime } from '../../../utils/file'
import { createFileStateCacheWithSizeLimit } from '../../../utils/fileStateCache'

function createToolContext(filePath: string, content: string) {
  const readFileState = createFileStateCacheWithSizeLimit(20)
  readFileState.set(filePath, {
    content,
    timestamp: getFileModificationTime(filePath),
    offset: undefined,
    limit: undefined,
  })

  return {
    readFileState,
    updateFileHistoryState: () => {},
  } as never
}

function parentMessage(): AssistantMessage {
  return { uuid: '00000000-0000-4000-8000-000000000004' } as AssistantMessage
}

describe('V4 unified edit lifecycle write surfaces', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  test('NotebookEditTool emits Tool Gate post-mutation verification evidence', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'dsxu-v4-notebook-edit-'))
    const notebookPath = join(tempDir, 'sample.ipynb')
    const notebook = {
      cells: [
        {
          cell_type: 'code',
          execution_count: 1,
          id: 'cell-1',
          metadata: {},
          outputs: [{ output_type: 'stream', name: 'stdout', text: 'old' }],
          source: 'print("old")',
        },
      ],
      metadata: { language_info: { name: 'python' } },
      nbformat: 4,
      nbformat_minor: 5,
    }
    const originalContent = JSON.stringify(notebook, null, 1)
    writeFileSync(notebookPath, originalContent)

    const result = await NotebookEditTool.call(
      {
        notebook_path: notebookPath,
        cell_id: 'cell-1',
        new_source: 'print("new")',
        edit_mode: 'replace',
      },
      createToolContext(notebookPath, originalContent),
      undefined as never,
      parentMessage(),
    )

    expect(result.data.error).toBe('')
    expect(result.data.postMutationVerification?.owner).toBe('Tool Gate / VerificationKernel')
    expect(result.data.postMutationVerification?.evidence.join('\n')).toContain(
      'gate:post-mutation-verification:',
    )
    const updatedNotebook = JSON.parse(readFileSync(notebookPath, 'utf8'))
    expect(updatedNotebook.cells[0].source).toBe('print("new")')

    const toolBlock = NotebookEditTool.mapToolResultToToolResultBlockParam(
      result.data,
      'toolu-notebook-v4-edit-lifecycle',
    )
    expect(String(toolBlock.content)).toContain('DSXU verification state:')
    expect(String(toolBlock.content)).toContain('post_mutation_verification')
  })

  test('BashTool simulated sed write emits the same verification state', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'dsxu-v4-bash-sed-'))
    const filePath = join(tempDir, 'sample.txt')
    const originalContent = 'old\n'
    const newContent = 'new\n'
    writeFileSync(filePath, originalContent)

    const result = await BashTool.call(
      {
        command: `sed -i s/old/new/ ${filePath}`,
        _simulatedSedEdit: {
          filePath,
          newContent,
        },
      } as never,
      createToolContext(filePath, originalContent),
      undefined as never,
      parentMessage(),
    )

    expect(result.data.interrupted).toBe(false)
    expect(result.data.postMutationVerification?.owner).toBe('Tool Gate / VerificationKernel')
    expect(result.data.postMutationVerification?.evidence.join('\n')).toContain(
      'gate:post-mutation-verification:',
    )
    expect(readFileSync(filePath, 'utf8')).toBe(newContent)

    const toolBlock = BashTool.mapToolResultToToolResultBlockParam(
      result.data,
      'toolu-bash-v4-edit-lifecycle',
    )
    expect(String(toolBlock.content)).toContain('DSXU verification state:')
    expect(String(toolBlock.content)).toContain('post_mutation_verification')
  })
})
