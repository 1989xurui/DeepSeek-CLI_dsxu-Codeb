#!/usr/bin/env bun
/**
 * 测试 TASK-INFRA-4 Safe Shell 白名单守卫
 *
 * 根据 TASK-ADDENDUM.md 中的验收标准：
 * - 5 个正例全通过
 * - 8 个反例全被拒
 */

import { spawnSync } from 'child_process'
import { join } from 'path'

// 测试用例
const testCases = [
  // 正例（应该通过）
  { command: 'git status', shouldPass: true, description: 'git status' },
  { command: 'bun test', shouldPass: true, description: 'bun test' },
  { command: 'node -v', shouldPass: true, description: 'node -v' },
  { command: 'powershell -Command "ls"', shouldPass: true, description: 'powershell ls' },
  { command: 'git log --oneline -8', shouldPass: true, description: 'git log' },

  // 反例（应该被拒绝）
  { command: 'head -5', shouldPass: false, description: 'head -5' },
  { command: 'tail -f', shouldPass: false, description: 'tail -f' },
  { command: 'rm -rf /', shouldPass: false, description: 'rm -rf /' },
  { command: 'echo a | sort', shouldPass: false, description: 'echo a | sort' },
  { command: 'grep foo | head', shouldPass: false, description: 'grep foo | head' },
  { command: "awk '{print $1}'", shouldPass: false, description: 'awk print' },
  { command: 'cat a | wc -l', shouldPass: false, description: 'cat a | wc -l' },
  { command: 'ls | cut -d/ -f1', shouldPass: false, description: 'ls | cut' },

  // 额外测试用例
  { command: 'git log | head -5', shouldPass: false, description: 'git log | head (管道包含黑名单)' },
  { command: 'bun install --dry-run | tail -5', shouldPass: false, description: 'bun install | tail' },
  { command: 'git log | bun run', shouldPass: true, description: 'git log | bun run (白名单管道)' },
  { command: 'node server.js | powershell', shouldPass: true, description: 'node | powershell (白名单管道)' },
]

function runTest(command: string): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('bun', [join(__dirname, 'check-bash.ts')], {
    env: { ...process.env, GUARD_BASH_COMMAND: command },
    encoding: 'utf-8'
  })

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || ''
  }
}

function main() {
  console.log('=== 测试 TASK-INFRA-4 Safe Shell 白名单守卫 ===\n')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    process.stdout.write(`测试: ${testCase.description} ... `)

    const result = runTest(testCase.command)
    const passedTest = (testCase.shouldPass && result.exitCode === 0) ||
                      (!testCase.shouldPass && result.exitCode === 2)

    if (passedTest) {
      console.log('✓ 通过')
      passed++
    } else {
      console.log('✗ 失败')
      console.log(`  命令: ${testCase.command}`)
      console.log(`  预期: ${testCase.shouldPass ? '通过' : '拒绝'}`)
      console.log(`  实际: 退出码 ${result.exitCode}`)
      if (result.stderr) {
        console.log(`  错误: ${result.stderr.trim()}`)
      }
      failed++
    }
  }

  console.log('\n=== 测试结果 ===')
  console.log(`通过: ${passed}`)
  console.log(`失败: ${failed}`)
  console.log(`总计: ${testCases.length}`)

  if (failed > 0) {
    console.error('\n❌ 测试失败')
    process.exit(1)
  } else {
    console.log('\n✅ 所有测试通过')
    process.exit(0)
  }
}

if (require.main === module) {
  main()
}