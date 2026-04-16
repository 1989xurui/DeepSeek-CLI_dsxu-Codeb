import { describe, it, expect } from 'vitest'
import { convertMessages } from '../../../../deepseek-proxy'

describe('工具结果标准化', () => {
  it('应该移除时间戳', () => {
    const messages = [
      {
        role: 'user',
        content: '测试工具结果'
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'Read',
            input: { file_path: 'test.txt' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: '文件创建时间: 2024-01-01T12:00:00.000Z\n修改时间: 2024-01-02T15:30:45.123Z'
          }
        ]
      }
    ]

    const result = convertMessages(messages)
    const toolMessage = result.find(m => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    expect(toolMessage!.content).toContain('[TIMESTAMP]')
    expect(toolMessage!.content).not.toContain('2024-01-01T12:00:00.000Z')
    expect(toolMessage!.content).not.toContain('2024-01-02T15:30:45.123Z')
  })

  it('应该移除UUID', () => {
    const messages = [
      {
        role: 'user',
        content: '测试UUID'
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_2',
            name: 'Bash',
            input: { command: 'ls' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_2',
            content: '进程ID: 123e4567-e89b-12d3-a456-426614174000\n会话ID: 550e8400-e29b-41d4-a716-446655440000'
          }
        ]
      }
    ]

    const result = convertMessages(messages)
    const toolMessage = result.find(m => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    expect(toolMessage!.content).toContain('[UUID]')
    expect(toolMessage!.content).not.toContain('123e4567-e89b-12d3-a456-426614174000')
  })

  it('应该移除文件读取行号', () => {
    const messages = [
      {
        role: 'user',
        content: '测试文件读取'
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_3',
            name: 'Read',
            input: { file_path: 'test.txt' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_3',
            content: '1 | 第一行内容\n  2 | 第二行内容\n3 | 第三行内容'
          }
        ]
      }
    ]

    const result = convertMessages(messages)
    const toolMessage = result.find(m => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    expect(toolMessage!.content).toContain('第一行内容')
    expect(toolMessage!.content).toContain('第二行内容')
    expect(toolMessage!.content).not.toContain('1 |')
    expect(toolMessage!.content).not.toContain('  2 |')
  })

  it('应该标准化路径分隔符', () => {
    const messages = [
      {
        role: 'user',
        content: '测试路径'
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_4',
            name: 'Glob',
            input: { pattern: '**/*.ts' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_4',
            content: 'C:\\Users\\test\\file.ts\nD:\\project\\src\\index.ts'
          }
        ]
      }
    ]

    const result = convertMessages(messages)
    const toolMessage = result.find(m => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    expect(toolMessage!.content).toContain('C:/Users/test/file.ts')
    expect(toolMessage!.content).toContain('D:/project/src/index.ts')
    expect(toolMessage!.content).not.toContain('C:\\')
  })

  it('应该添加XML包装', () => {
    const messages = [
      {
        role: 'user',
        content: '测试XML包装'
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_5',
            name: 'Read',
            input: { file_path: 'test.txt' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_5',
            content: '文件内容'
          }
        ]
      }
    ]

    const result = convertMessages(messages)
    const toolMessage = result.find(m => m.role === 'tool')
    expect(toolMessage).toBeDefined()
    expect(toolMessage!.content).toMatch(/^<tool_execution_result tool_name="Read">/)
    expect(toolMessage!.content).toMatch(/<\/tool_execution_result>$/)
  })

  it('应该处理多种动态内容', () => {
    const messages = [
      {
        role: 'user',
        content: '综合测试'
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_6',
            name: 'Bash',
            input: { command: 'git log' }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_6',
            content: `commit abc123def456 (HEAD -> main)
Author: test <test@example.com>
Date: 2024-01-01T10:00:00.000Z

    修改文件大小: 1024 bytes
    内存使用: 0x7fff12345678
    进度: 50.00%
    临时文件: /tmp/random123.tmp
    进程: [pid 1234] running
    会话: 123e4567-e89b-12d3-a456-426614174000`
          }
        ]
      }
    ]

    const result = convertMessages(messages)
    const toolMessage = result.find(m => m.role === 'tool')
    expect(toolMessage).toBeDefined()

    const content = toolMessage!.content
    expect(content).toContain('[COMMIT_HASH]')
    expect(content).toContain('[TIMESTAMP]')
    expect(content).toContain('[FILE_SIZE]')
    expect(content).toContain('[MEMORY_ADDR]')
    expect(content).toContain('[PERCENT]')
    expect(content).toContain('[TEMP_FILE]')
    expect(content).toContain('[PID]')
    expect(content).toContain('[UUID]')

    expect(content).not.toContain('abc123def456')
    expect(content).not.toContain('2024-01-01T10:00:00.000Z')
    expect(content).not.toContain('1024 bytes')
    expect(content).not.toContain('0x7fff12345678')
    expect(content).not.toContain('50.00%')
    expect(content).not.toContain('/tmp/random123.tmp')
    expect(content).not.toContain('[pid 1234]')
    expect(content).not.toContain('123e4567-e89b-12d3-a456-426614174000')
  })
})