#!/usr/bin/env python3
"""
R5-28 SWE-bench-Verified 数据拉取

从 HuggingFace 下载 SWE-bench-Verified 数据集，
按规则筛选 50 个任务写入 subset-50.json。

用法：
  python fetch.py [--output subset-50.json] [--cache-dir .cache]
"""

import json
import argparse
import os
from pathlib import Path


def fetch_swe_bench_verified(cache_dir: str = ".cache") -> list[dict]:
    """
    从 HuggingFace 拉取 SWE-bench-Verified 数据集。

    需要: pip install datasets
    """
    cache_path = Path(cache_dir) / "swe-bench-verified.json"

    if cache_path.exists():
        print(f"[fetch] 使用缓存: {cache_path}")
        with open(cache_path) as f:
            return json.load(f)

    try:
        from datasets import load_dataset
        ds = load_dataset("princeton-nlp/SWE-bench_Verified", split="test")
        tasks = [dict(row) for row in ds]

        # 缓存到本地
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w") as f:
            json.dump(tasks, f, indent=2)

        print(f"[fetch] 拉取 {len(tasks)} 个任务，已缓存到 {cache_path}")
        return tasks

    except ImportError:
        print("[fetch] 错误: 需要安装 datasets 库")
        print("  pip install datasets")
        raise


def classify_difficulty(task: dict) -> str:
    """根据 patch 大小和测试数量推断难度"""
    patch = task.get("patch", "")
    lines = len(patch.split("\n"))

    if lines <= 20:
        return "easy"
    elif lines <= 80:
        return "medium"
    else:
        return "hard"


def detect_languages(task: dict) -> list[str]:
    """从 repo 和 patch 检测涉及语言"""
    repo = task.get("repo", "")
    patch = task.get("patch", "")

    langs = []
    if ".py" in patch or "python" in repo.lower():
        langs.append("python")
    if ".js" in patch or ".ts" in patch:
        langs.append("javascript")

    return langs if langs else ["python"]


def is_multi_file(task: dict) -> bool:
    """检测是否多文件修改"""
    patch = task.get("patch", "")
    file_markers = [l for l in patch.split("\n") if l.startswith("diff --git")]
    return len(file_markers) > 1


def select_subset(tasks: list[dict], n: int = 50) -> list[dict]:
    """
    从 SWE-bench-Verified 中筛选 subset。

    规则（V8.2-S §R5-28.4）：
    - 难度：easy 15 + medium 25 + hard 10
    - 语言：纯 Python 30 + 含 JS/TS 20
    - 修改：单文件 25 + 多文件 25
    """
    # 分类
    for t in tasks:
        t["_difficulty"] = classify_difficulty(t)
        t["_languages"] = detect_languages(t)
        t["_multi_file"] = is_multi_file(t)

    targets = {"easy": 15, "medium": 25, "hard": 10}
    selected = []
    counts = {"easy": 0, "medium": 0, "hard": 0}
    single_count = 0
    multi_count = 0

    for t in tasks:
        diff = t["_difficulty"]
        is_multi = t["_multi_file"]

        if counts[diff] >= targets[diff]:
            continue
        if not is_multi and single_count >= 25:
            continue
        if is_multi and multi_count >= 25:
            continue

        counts[diff] += 1
        if is_multi:
            multi_count += 1
        else:
            single_count += 1

        selected.append({
            "id": t.get("instance_id", t.get("id", f"task-{len(selected)}")),
            "repo": t.get("repo", ""),
            "baseCommit": t.get("base_commit", ""),
            "problemStatement": t.get("problem_statement", ""),
            "difficulty": diff,
            "languages": t["_languages"],
            "multiFile": is_multi,
            "testPatch": t.get("test_patch", ""),
            "goldPatch": t.get("patch", ""),
        })

        if len(selected) >= n:
            break

    print(f"[fetch] 选中 {len(selected)} 个任务")
    print(f"  难度: easy={counts['easy']} medium={counts['medium']} hard={counts['hard']}")
    print(f"  修改: single={single_count} multi={multi_count}")

    return selected


def main():
    parser = argparse.ArgumentParser(description="Fetch SWE-bench-Verified subset")
    parser.add_argument("--output", default="subset-50.json", help="Output file")
    parser.add_argument("--cache-dir", default=".cache", help="Cache directory")
    parser.add_argument("--count", type=int, default=50, help="Number of tasks")
    args = parser.parse_args()

    tasks = fetch_swe_bench_verified(args.cache_dir)
    subset = select_subset(tasks, args.count)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(subset, f, indent=2)

    print(f"[fetch] 写入 {output_path}")


if __name__ == "__main__":
    main()
