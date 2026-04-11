// ── Crash Handler (TASK-INFRA-2) ────────────────────────────────────────

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CRASH_LOG_DIR = '.dsevo';
const CRASH_LOG_FILE = join(CRASH_LOG_DIR, 'proxy-crash.log');

// 确保日志目录存在
if (!existsSync(CRASH_LOG_DIR)) {
  mkdirSync(CRASH_LOG_DIR, { recursive: true });
}

function logCrash(type, error) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${type}: ${error?.stack || error?.message || String(error)}\n\n`;

  try {
    writeFileSync(CRASH_LOG_FILE, logEntry, { flag: 'a' });
    console.error(`[proxy-crash] 崩溃已记录到 ${CRASH_LOG_FILE}`);
  } catch (logError) {
    console.error(`[proxy-crash] 无法写入崩溃日志: ${logError.message}`);
  }
}

// 未捕获异常处理器
process.on('uncaughtException', (error) => {
  console.error('[proxy-crash] 未捕获异常:', error);
  logCrash('uncaughtException', error);

  // 给一点时间让日志写入
  setTimeout(() => {
    process.exit(1);
  }, 100);
});

// 未处理的 Promise 拒绝处理器
process.on('unhandledRejection', (reason, promise) => {
  console.error('[proxy-crash] 未处理的 Promise 拒绝:', reason);
  logCrash('unhandledRejection', reason);

  // 注意：不立即退出，让应用继续运行
  // 但记录到日志以便调试
});