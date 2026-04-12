#!/usr/bin/env python3
"""
R5-28 SWE-bench 报告生成器

从 results JSON 生成 pass@1 / pass@5 报告。

用法：
  python report.py --results results.json --subset subset-50.json
  python report.py --results results.json --format markdown
"""

import json
import argparse
import math
from pathlib import Path
from typing import Optional
from collections import defaultdict


def compute_pass_at_k(n: int, c: int, k: int) -> float:
    """
    计算 pass@k（无偏估计）。

    n: 总采样次数
    c: 通过次数
    k: k 值

    公式: 1 - C(n-c, k) / C(n, k)
    """
    if n - c < k:
        return 1.0
    return 1.0 - math.prod(range(n - c - k + 1, n - c + 1)) / math.prod(range(n - k + 1, n + 1))


def generate_report(
    results: list[dict],
    tasks: Optional[list[dict]] = None,
    samples_per_task: int = 1,
) -> dict:
    """
    生成评估报告。

    Args:
        results: SWEResult 列表
        tasks: SWETask 列表（用于详细分组）
        samples_per_task: 每任务采样次数（用于 pass@k）
    """
    # 基础统计
    total = len(results)
    passed = sum(1 for r in results if r.get("testsPassed", False))

    pass_at_1 = passed / total if total > 0 else 0.0

    # pass@5 估计
    pass_at_5 = None
    if samples_per_task >= 5:
        # 按 taskId 分组计算
        by_task = defaultdict(list)
        for r in results:
            by_task[r["taskId"]].append(r)

        pass_at_5_scores = []
        for tid, task_results in by_task.items():
            n = len(task_results)
            c = sum(1 for r in task_results if r.get("testsPassed", False))
            pass_at_5_scores.append(compute_pass_at_k(n, c, 5))

        pass_at_5 = sum(pass_at_5_scores) / len(pass_at_5_scores) if pass_at_5_scores else 0.0

    # 按难度分组
    by_difficulty = {"easy": {"total": 0, "passed": 0}, "medium": {"total": 0, "passed": 0}, "hard": {"total": 0, "passed": 0}}
    by_language = defaultdict(lambda: {"total": 0, "passed": 0})

    if tasks:
        task_map = {t["id"]: t for t in tasks}
        for r in results:
            task = task_map.get(r["taskId"], {})
            diff = task.get("difficulty", "medium")
            by_difficulty[diff]["total"] += 1
            if r.get("testsPassed"):
                by_difficulty[diff]["passed"] += 1

            for lang in task.get("languages", ["python"]):
                by_language[lang]["total"] += 1
                if r.get("testsPassed"):
                    by_language[lang]["passed"] += 1

    # 计算比率
    for d in by_difficulty.values():
        d["rate"] = d["passed"] / d["total"] if d["total"] > 0 else 0.0
    for l in by_language.values():
        l["rate"] = l["passed"] / l["total"] if l["total"] > 0 else 0.0

    total_duration = sum(r.get("durationMs", 0) for r in results)

    report = {
        "totalTasks": total,
        "passedTasks": passed,
        "passAt1": round(pass_at_1, 4),
        "passAt5": round(pass_at_5, 4) if pass_at_5 is not None else None,
        "byDifficulty": dict(by_difficulty),
        "byLanguage": dict(by_language),
        "totalDurationMs": total_duration,
        "avgDurationMs": total_duration // total if total > 0 else 0,
    }

    return report


def format_markdown(report: dict) -> str:
    """格式化为 Markdown"""
    lines = [
        "# SWE-bench Evaluation Report",
        "",
        "## Summary",
        f"- **Total Tasks**: {report['totalTasks']}",
        f"- **Passed**: {report['passedTasks']}",
        f"- **pass@1**: {report['passAt1']:.1%}",
    ]

    if report.get("passAt5") is not None:
        lines.append(f"- **pass@5**: {report['passAt5']:.1%}")

    lines.extend([
        f"- **Total Duration**: {report['totalDurationMs'] / 1000:.1f}s",
        "",
        "## By Difficulty",
        "",
        "| Difficulty | Total | Passed | Rate |",
        "|-----------|-------|--------|------|",
    ])

    for diff in ["easy", "medium", "hard"]:
        d = report["byDifficulty"].get(diff, {"total": 0, "passed": 0, "rate": 0})
        lines.append(f"| {diff} | {d['total']} | {d['passed']} | {d['rate']:.1%} |")

    if report.get("byLanguage"):
        lines.extend(["", "## By Language", "", "| Language | Total | Passed | Rate |", "|----------|-------|--------|------|"])
        for lang, d in sorted(report["byLanguage"].items()):
            lines.append(f"| {lang} | {d['total']} | {d['passed']} | {d['rate']:.1%} |")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="SWE-bench report generator")
    parser.add_argument("--results", required=True, help="Results JSON file")
    parser.add_argument("--subset", help="Subset JSON file (for task metadata)")
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    parser.add_argument("--output", help="Output file")
    args = parser.parse_args()

    with open(args.results) as f:
        results = json.load(f)

    tasks = None
    if args.subset:
        with open(args.subset) as f:
            tasks = json.load(f)

    report = generate_report(results, tasks)

    if args.format == "markdown":
        output = format_markdown(report)
    else:
        output = json.dumps(report, indent=2)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"[report] Saved to {args.output}")
    else:
        print(output)


if __name__ == "__main__":
    main()
