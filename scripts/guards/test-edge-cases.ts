#!/usr/bin/env bun
/**
 * 测试边缘情况
 */

import { spawnSync } from 'child_process'
import { join } from 'path'

const testCases = [
  // 带引号的命令
  { command: "echo 'head tail'", shouldPass: true, description: "引号内的黑名单词" },
  { command: 'echo "wc cut"', shouldPass: true, description: "双引号内的黑名单词" },
  { command: "git log --oneline | grep 'feature'", shouldPass: false, description: "管道包含grep" },

  // 转义字符
  { command: 'echo head\\ tail', shouldPass: true, description: "转义空格" },
  { command: 'echo \\head', shouldPass: true, description: "转义h" },

  // 复杂管道
  { command: 'git status | bun run build', shouldPass: true, description: "git | bun" },
  { command: 'node app.js | powershell Get-Process', shouldPass: true, description: "node | powershell" },

  // 应该被拒绝的复杂情况
  { command: 'ls -la | head -5 | wc -l', shouldPass: false, description: "多重管道黑名单" },
  { command: "find . -name '*.ts' | xargs grep 'import'", shouldPass: false, description: "find | xargs" },

  // 命令替换（应该被黑名单检测到）
  { command: '$(head -5 file.txt)', shouldPass: false, description: "命令替换中的head" },
  { command: '`tail -f log.txt`', shouldPass: false, description: "反引号中的tail" },
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
  console.log('=== 测试边缘情况 ===\n')

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
        const lines = result.stderr.trim().split('\n')
        console.log(`  错误: ${lines[0]}`)
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