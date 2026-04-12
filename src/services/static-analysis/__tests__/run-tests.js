/**
 * 静态分析测试运行脚本
 */

const { spawn } = require('child_process');
const path = require('path');

const testDir = __dirname;

console.log('🚀 运行静态分析测试...\n');

// 运行所有测试
const jest = spawn('npx', ['jest', '--verbose', '--testPathPattern=static-analysis'], {
  cwd: path.join(__dirname, '../../../../'),
  stdio: 'inherit',
  shell: true,
});

jest.on('close', (code) => {
  console.log(`\n测试完成，退出码: ${code}`);
  process.exit(code);
});

jest.on('error', (err) => {
  console.error('启动测试时出错:', err);
  process.exit(1);
});