#!/usr/bin/env bun

// 复制黑名单检查逻辑
const BLACKLIST_TOKENS = new Set([
  'head',
  'tail',
  'wc',
  'cut',
  'sort',
  'uniq',
  'xargs',
  'awk',
  'sed',
  'rm',
  'grep',
  'find'
])

function containsBlacklistedToken(command: string): boolean {
  // 更精确的分词逻辑：按空格、管道、重定向、分号等分割
  // 但要注意不要分割引号内的内容
  const tokens: string[] = []
  let currentToken = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBacktick = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (escaped) {
      currentToken += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      currentToken += char
      continue
    }

    // 处理反引号
    if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick
      // 当进入反引号时，开始新的token
      if (inBacktick && currentToken) {
        tokens.push(currentToken)
        currentToken = ''
      }
      continue
    }

    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote
      currentToken += char
      continue
    }

    if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote
      currentToken += char
      continue
    }

    // 如果是分隔符且不在引号内
    if (!inSingleQuote && !inDoubleQuote && !inBacktick && /[\s|&;()<>]/.test(char)) {
      if (currentToken) {
        tokens.push(currentToken)
        currentToken = ''
      }
      // 跳过分隔符
      continue
    }

    // 在反引号内，按正常shell命令解析
    if (inBacktick) {
      // 反引号内的命令也需要检查分隔符
      if (/[\s|&;()<>]/.test(char)) {
        if (currentToken) {
          tokens.push(currentToken)
          currentToken = ''
        }
        continue
      }
    }

    currentToken += char
  }

  // 添加最后一个token
  if (currentToken) {
    tokens.push(currentToken)
  }

  // 检查token
  for (const token of tokens) {
    // 移除可能的引号
    let cleanToken = token.trim().toLowerCase()
    if ((cleanToken.startsWith("'") && cleanToken.endsWith("'")) ||
        (cleanToken.startsWith('"') && cleanToken.endsWith('"'))) {
      cleanToken = cleanToken.slice(1, -1)
    }

    if (BLACKLIST_TOKENS.has(cleanToken)) {
      return true
    }
  }

  return false
}

// G1验收标准测试
const acceptanceTests = [
  // 5个正例 - 应该返回false（不包含黑名单词）
  { cmd: 'echo "hello world"', expected: false, description: 'echo命令' },
  { cmd: 'ls -la', expected: false, description: 'ls命令' },
  { cmd: 'cat README.md', expected: false, description: 'cat命令' },
  { cmd: 'git status', expected: false, description: 'git命令' },
  { cmd: 'bun run test', expected: false, description: 'bun命令' },

  // 8个反例 - 应该返回true（包含黑名单词）
  { cmd: 'head -n 10 file.txt', expected: true, description: 'head命令' },
  { cmd: 'tail -f log.txt', expected: true, description: 'tail命令' },
  { cmd: 'grep "error" logs/*', expected: true, description: 'grep命令' },
  { cmd: 'find . -name "*.tmp"', expected: true, description: 'find命令' },
  { cmd: 'xargs rm < files.txt', expected: true, description: 'xargs命令' },
  { cmd: 'echo "test" | grep "test"', expected: true, description: '管道中的grep' },
  { cmd: 'ls | head -5', expected: true, description: '管道中的head' },
  { cmd: 'echo "result: `tail -f log.txt`"', expected: true, description: '反引号中的tail' },
]

console.log('=== G1验收标准测试 ===\n')

let passed = 0
let failed = 0

for (const test of acceptanceTests) {
  const result = containsBlacklistedToken(test.cmd)
  const passedTest = result === test.expected

  if (passedTest) {
    console.log(`✅ ${test.description}: ${test.cmd}`)
    passed++
  } else {
    console.log(`❌ ${test.description}: ${test.cmd}`)
    console.log(`   预期: ${test.expected}, 实际: ${result}`)
    failed++
  }
}

console.log(`\n=== 测试结果 ===`)
console.log(`通过: ${passed}`)
console.log(`失败: ${failed}`)
console.log(`总计: ${acceptanceTests.length}`)

if (failed === 0) {
  console.log('\n✅ 所有验收测试通过！')
  process.exit(0)
} else {
  console.log('\n❌ 有测试失败')
  process.exit(1)
}