#!/usr/bin/env bun

/**
 * TASK-INFRA-6: Cost Ledger Summary Script
 *
 * 用法:
 *   bun run scripts/ledger/summary.ts
 *
 * 输出:
 *   今日累计: ¥X.XX (N 次请求)
 *   本月累计: ¥Y.YY (M 次请求)
 *   按模型统计...
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const COST_LEDGER_FILE = join(process.cwd(), '.dsevo', 'cost-ledger.jsonl');

interface LedgerEntry {
  ts: string;
  model: string;
  in_tokens: number;
  out_tokens: number;
  cache_hit: boolean;
  cost_cny: number;
}

interface DailyStats {
  date: string;
  cost: number;
  requests: number;
  models: Record<string, { cost: number; requests: number }>;
}

interface MonthlyStats {
  month: string;
  cost: number;
  requests: number;
  models: Record<string, { cost: number; requests: number }>;
}

function readLedger(): LedgerEntry[] {
  if (!existsSync(COST_LEDGER_FILE)) {
    console.log('成本账本文件不存在:', COST_LEDGER_FILE);
    return [];
  }

  try {
    const data = readFileSync(COST_LEDGER_FILE, 'utf8');
    const lines = data.trim().split('\n').filter(line => line.trim());

    const entries: LedgerEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {
        console.warn('跳过解析错误的行:', line.substring(0, 100));
      }
    }

    return entries;
  } catch (error) {
    console.error('读取账本文件失败:', error.message);
    return [];
  }
}

function calculateStats(entries: LedgerEntry[]): {
  daily: DailyStats[];
  monthly: MonthlyStats[];
  total: { cost: number; requests: number };
} {
  const dailyMap = new Map<string, DailyStats>();
  const monthlyMap = new Map<string, MonthlyStats>();

  let totalCost = 0;
  let totalRequests = 0;

  for (const entry of entries) {
    const date = entry.ts.split('T')[0]; // YYYY-MM-DD
    const month = entry.ts.substring(0, 7); // YYYY-MM

    totalCost += entry.cost_cny;
    totalRequests++;

    // 日统计
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        cost: 0,
        requests: 0,
        models: {},
      });
    }
    const dayStats = dailyMap.get(date)!;
    dayStats.cost += entry.cost_cny;
    dayStats.requests++;

    if (!dayStats.models[entry.model]) {
      dayStats.models[entry.model] = { cost: 0, requests: 0 };
    }
    dayStats.models[entry.model].cost += entry.cost_cny;
    dayStats.models[entry.model].requests++;

    // 月统计
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        month,
        cost: 0,
        requests: 0,
        models: {},
      });
    }
    const monthStats = monthlyMap.get(month)!;
    monthStats.cost += entry.cost_cny;
    monthStats.requests++;

    if (!monthStats.models[entry.model]) {
      monthStats.models[entry.model] = { cost: 0, requests: 0 };
    }
    monthStats.models[entry.model].cost += entry.cost_cny;
    monthStats.models[entry.model].requests++;
  }

  // 转换为数组并按日期排序
  const daily = Array.from(dailyMap.values())
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthly = Array.from(monthlyMap.values())
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    daily,
    monthly,
    total: { cost: totalCost, requests: totalRequests },
  };
}

function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

function printSummary(stats: ReturnType<typeof calculateStats>): void {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const thisMonth = now.toISOString().substring(0, 7);

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║          DeepSeek 成本账本汇总               ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  // 今日统计
  const todayStats = stats.daily.find(d => d.date === today);
  if (todayStats) {
    console.log(`今日累计: ${formatCurrency(todayStats.cost)} (${todayStats.requests} 次请求)`);

    // 按模型细分
    const modelEntries = Object.entries(todayStats.models);
    if (modelEntries.length > 1) {
      console.log('  按模型:');
      for (const [model, modelStats] of modelEntries) {
        console.log(`    ${model}: ${formatCurrency(modelStats.cost)} (${modelStats.requests} 次)`);
      }
    }
  } else {
    console.log('今日累计: ¥0.00 (0 次请求)');
  }

  console.log();

  // 本月统计
  const monthStats = stats.monthly.find(m => m.month === thisMonth);
  if (monthStats) {
    console.log(`本月累计: ${formatCurrency(monthStats.cost)} (${monthStats.requests} 次请求)`);

    const modelEntries = Object.entries(monthStats.models);
    if (modelEntries.length > 1) {
      console.log('  按模型:');
      for (const [model, modelStats] of modelEntries) {
        console.log(`    ${model}: ${formatCurrency(modelStats.cost)} (${modelStats.requests} 次)`);
      }
    }
  } else {
    console.log('本月累计: ¥0.00 (0 次请求)');
  }

  console.log();
  // 总统计
  console.log(`历史总计: ${formatCurrency(stats.total.cost)} (${stats.total.requests} 次请求)`);
  console.log();

  // 预算状态
  const budgetOverrideFile = join(process.cwd(), '.dsevo', 'budget-override');
  const hasOverride = existsSync(budgetOverrideFile);

  if (todayStats && todayStats.cost > 50) {
    if (hasOverride) {
      console.log('⚠️  日预算超限 (¥50)，但已启用覆盖');
    } else {
      console.log('🚫 日预算超限 (¥50)，新请求将被拒绝');
      console.log('   如需继续使用，请创建覆盖文件:');
      console.log(`   touch ${budgetOverrideFile}`);
    }
  } else if (todayStats) {
    const remaining = 50 - todayStats.cost;
    console.log(`💰 今日预算剩余: ${formatCurrency(remaining)}`);
  }

  console.log();
}

function printDetailedReport(stats: ReturnType<typeof calculateStats>): void {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║              详细成本报告                   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log();

  // 最近7天
  console.log('最近7天统计:');
  console.log('────────────');
  const last7Days = stats.daily.slice(0, 7);
  for (const day of last7Days) {
    console.log(`${day.date}: ${formatCurrency(day.cost)} (${day.requests} 次请求)`);
  }
  console.log();

  // 所有月份
  console.log('月度统计:');
  console.log('─────────');
  for (const month of stats.monthly) {
    console.log(`${month.month}: ${formatCurrency(month.cost)} (${month.requests} 次请求)`);
  }
  console.log();

  // 模型统计
  console.log('模型使用统计:');
  console.log('─────────────');

  const modelStats = new Map<string, { cost: number; requests: number }>();
  for (const month of stats.monthly) {
    for (const [model, stats] of Object.entries(month.models)) {
      if (!modelStats.has(model)) {
        modelStats.set(model, { cost: 0, requests: 0 });
      }
      const current = modelStats.get(model)!;
      current.cost += stats.cost;
      current.requests += stats.requests;
    }
  }

  const sortedModels = Array.from(modelStats.entries())
    .sort((a, b) => b[1].cost - a[1].cost);

  // 计算所有模型的总成本
  const totalModelCost = Array.from(modelStats.values()).reduce((sum, s) => sum + s.cost, 0);

  for (const [model, stats] of sortedModels) {
    const percentage = totalModelCost > 0 ? (stats.cost / totalModelCost * 100).toFixed(1) : '0.0';
    console.log(`${model}: ${formatCurrency(stats.cost)} (${stats.requests} 次, ${percentage}%)`);
  }
}

function main() {
  const entries = readLedger();

  if (entries.length === 0) {
    console.log('没有找到成本记录');
    return;
  }

  const stats = calculateStats(entries);
  printSummary(stats);

  // 如果指定了 --detail 参数，显示详细报告
  if (process.argv.includes('--detail') || process.argv.includes('-d')) {
    printDetailedReport(stats);
  }

  // 如果指定了 --json 参数，输出 JSON
  if (process.argv.includes('--json') || process.argv.includes('-j')) {
    console.log(JSON.stringify(stats, null, 2));
  }
}

if (import.meta.main) {
  main();
}

export { readLedger, calculateStats, formatCurrency };
