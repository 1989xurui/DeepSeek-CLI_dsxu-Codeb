import type { Opportunity } from '../opportunity-discovery'

export class DailyMarkdownReporter {
  async generateReport(opportunities: Opportunity[]): Promise<string> {
    const highPriority = opportunities.filter((item) => item.priorityScore >= 8)
    const lines = [
      '# 机会发现日报',
      '',
      '## 今日扫描摘要',
      `发现机会：${opportunities.length}个`,
      '',
      '## 高优先级机会',
    ]

    for (const opportunity of highPriority.length > 0 ? highPriority : opportunities) {
      lines.push(
        `- ${opportunity.title} - ${opportunity.priorityScore}/10 - ${opportunity.revenuePotential}`
      )
    }

    return lines.join('\n')
  }
}
