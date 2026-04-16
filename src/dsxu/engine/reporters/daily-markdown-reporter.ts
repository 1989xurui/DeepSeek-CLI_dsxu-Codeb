import { Opportunity, Reporter } from '../opportunity-discovery';

export class DailyMarkdownReporter implements Reporter {
  name = 'daily-markdown-reporter';

  async generateReport(opportunities: Opportunity[]): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const highPriority = opportunities.filter(opp => opp.priorityScore >= 8);
    const mediumPriority = opportunities.filter(
      opp => opp.priorityScore >= 6 && opp.priorityScore < 8,
    );
    const lowPriority = opportunities.filter(opp => opp.priorityScore < 6);

    const totalScanned = new Set(opportunities.map(opp => opp.source)).size * 10;
    const totalFound = opportunities.length;
    const avgHighScore =
      highPriority.length > 0
        ? (
            highPriority.reduce((sum, opp) => sum + opp.priorityScore, 0) /
            highPriority.length
          ).toFixed(1)
        : '0';
    const avgMediumScore =
      mediumPriority.length > 0
        ? (
            mediumPriority.reduce((sum, opp) => sum + opp.priorityScore, 0) /
            mediumPriority.length
          ).toFixed(1)
        : '0';

    let report = `# 机会发现日报 - ${dateStr}\n\n`;

    report += `## 今日扫描摘要\n`;
    report += `- 扫描领域：${totalScanned}个\n`;
    report += `- 发现机会：${totalFound}个\n`;
    report += `- 高优先级：${highPriority.length}个\n`;
    report += `- 中优先级：${mediumPriority.length}个\n`;
    report += `- 低优先级：${lowPriority.length}个\n\n`;

    if (highPriority.length > 0) {
      report += `## 高优先级机会（建议优先行动）\n\n`;
      highPriority.forEach((opp, index) => {
        report += `### 机会${index + 1}：${opp.title}\n`;
        report += `**分类**：${opp.category}\n`;
        report += `**来源**：${opp.source}\n`;
        report += `**描述**：${opp.description}\n`;
        report += `**收益潜力**：${opp.revenuePotential}\n`;
        report += `**执行难度**：${this.getDifficultyText(opp.executionDifficulty)}\n`;
        report += `**时间线**：${opp.timeline}\n`;
        report += `**优先级评分**：${opp.priorityScore}/10\n\n`;
      });
    }

    if (mediumPriority.length > 0) {
      report += `## 中优先级机会（建议排期验证）\n\n`;
      mediumPriority.forEach(opp => {
        report += `### ${opp.title}\n`;
        report += `- 收益潜力：${opp.revenuePotential}\n`;
        report += `- 执行难度：${this.getDifficultyText(opp.executionDifficulty)}\n`;
        report += `- 时间线：${opp.timeline}\n`;
        report += `- 评分：${opp.priorityScore}/10\n\n`;
      });
    }

    if (lowPriority.length > 0) {
      report += `## 低优先级机会（暂不优先）\n\n`;
      lowPriority.forEach(opp => {
        report += `- ${opp.title}（${opp.priorityScore}/10）\n`;
      });
      report += '\n';
    }

    report += `## 扫描统计\n\n`;
    report += `| 优先级 | 数量 | 平均分 |\n`;
    report += `|--------|------|--------|\n`;
    report += `| 高 | ${highPriority.length} | ${avgHighScore} |\n`;
    report += `| 中 | ${mediumPriority.length} | ${avgMediumScore} |\n`;
    report += `| 低 | ${lowPriority.length} | 0 |\n\n`;

    report += `## 今日行动建议\n\n`;
    report += `1. 先评估高优先级机会是否与你当前业务方向一致。\n`;
    report += `2. 选择一个机会做最小验证，避免同时展开太多项目。\n`;
    report += `3. 将验证结果回写为任务或实验记录，形成下次筛选依据。\n\n`;

    report += `## 明日建议\n\n`;
    report += `- 增加更多真实数据源，减少纯 mock 输出。\n`;
    report += `- 将高优先级机会转换为明确任务卡。\n`;
    report += `- 记录“已验证 / 已放弃 / 待观察”三类状态。\n\n`;

    report += `---\n\n`;
    report += `**报告生成时间**：${now.toLocaleString('zh-CN')}\n`;
    report += `**下次扫描建议**：明日 10:00\n`;
    report += `**备注**：请只保留真正值得执行的机会，避免机会清单堆积。\n`;

    return report;
  }

  private getDifficultyText(difficulty: 'low' | 'medium' | 'high'): string {
    const map = {
      low: '低',
      medium: '中等',
      high: '高',
    };

    return map[difficulty];
  }
}
