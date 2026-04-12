#!/usr/bin/env python3
"""
R5-28 SWE-bench 任务执行器

接收任务 JSON，调用 LLM 生成 patch，应用到代码库，运行测试，输出结果 JSON。

用法：
  python runner.py --task '{"id":"django__django-11099",...}'
  python runner.py --task-file task.json
  python runner.py --batch subset-50.json --output results.json
"""

import json
import argparse
import subprocess
import tempfile
import time
import os
import sys
from pathlib import Path
from typing import Optional


def call_llm(problem_statement: str, repo_context: str = "") -> str:
    """
    调用 DeepSeek V3.2 生成修复 patch。

    通过本地 proxy (localhost:3000) 或直接 DeepSeek API。
    """
    import urllib.request

    endpoint = os.environ.get("DSXU_PROXY_URL", "http://localhost:3000/v1/chat/completions")
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")

    prompt = f"""You are a software engineer fixing a bug. Generate a unified diff patch.

## Problem
{problem_statement[:4000]}

## Repository Context
{repo_context[:4000]}

## Instructions
- Output ONLY a valid unified diff patch
- Include file paths in the diff headers
- Make minimal changes to fix the issue
"""

    payload = json.dumps({
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 4096,
    }).encode()

    headers = {
        "Content-Type": "application/json",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(endpoint, data=payload, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"ERROR: {e}"


def apply_patch(repo_dir: str, patch: str) -> bool:
    """应用 patch 到代码库"""
    patch_file = os.path.join(repo_dir, "_fix.patch")
    with open(patch_file, "w") as f:
        f.write(patch)

    try:
        subprocess.run(
            ["git", "apply", "--check", patch_file],
            cwd=repo_dir, capture_output=True, check=True
        )
        subprocess.run(
            ["git", "apply", patch_file],
            cwd=repo_dir, capture_output=True, check=True
        )
        return True
    except subprocess.CalledProcessError:
        # 尝试宽松模式
        try:
            subprocess.run(
                ["git", "apply", "--3way", patch_file],
                cwd=repo_dir, capture_output=True, check=True
            )
            return True
        except subprocess.CalledProcessError:
            return False


def setup_repo(task: dict, work_dir: str) -> str:
    """克隆 / checkout 到 base commit"""
    repo = task.get("repo", "")
    base_commit = task.get("baseCommit", "")

    repo_dir = os.path.join(work_dir, repo.replace("/", "__"))

    if not os.path.exists(repo_dir):
        repo_url = f"https://github.com/{repo}.git"
        subprocess.run(
            ["git", "clone", "--depth=50", repo_url, repo_dir],
            capture_output=True, check=True, timeout=120
        )

    if base_commit:
        subprocess.run(
            ["git", "checkout", base_commit],
            cwd=repo_dir, capture_output=True, check=True
        )

    return repo_dir


def run_tests(repo_dir: str, test_patch: str, timeout: int = 300) -> dict:
    """应用 test patch 并运行测试"""
    # 应用 test patch
    if test_patch:
        test_file = os.path.join(repo_dir, "_test.patch")
        with open(test_file, "w") as f:
            f.write(test_patch)
        try:
            subprocess.run(
                ["git", "apply", test_file],
                cwd=repo_dir, capture_output=True, check=True
            )
        except subprocess.CalledProcessError:
            pass  # test patch 可能已经包含在 repo 中

    # 运行 pytest
    try:
        result = subprocess.run(
            ["python", "-m", "pytest", "--tb=short", "-q"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        output = result.stdout + result.stderr
        passed = failed = 0

        # 解析 pytest 输出
        for line in output.split("\n"):
            if "passed" in line:
                import re
                m = re.search(r"(\d+) passed", line)
                if m:
                    passed = int(m.group(1))
            if "failed" in line:
                import re
                m = re.search(r"(\d+) failed", line)
                if m:
                    failed = int(m.group(1))

        return {
            "passed": result.returncode == 0,
            "passedTests": passed,
            "totalTests": passed + failed,
            "output": output[:2000],
        }

    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "passedTests": 0,
            "totalTests": 0,
            "output": f"Timeout after {timeout}s",
        }
    except Exception as e:
        return {
            "passed": False,
            "passedTests": 0,
            "totalTests": 0,
            "output": str(e),
        }


def run_single_task(task: dict, work_dir: str = ".swe-bench-work") -> dict:
    """运行单个 SWE-bench 任务，返回 SWEResult JSON"""
    start = time.time()
    task_id = task.get("id", "unknown")

    try:
        # 1. Setup repo
        repo_dir = setup_repo(task, work_dir)

        # 2. Call LLM to generate patch
        patch = call_llm(
            task.get("problemStatement", ""),
            f"Repo: {task.get('repo', '')}"
        )

        # 3. Apply patch
        applied = apply_patch(repo_dir, patch)
        if not applied:
            return {
                "taskId": task_id,
                "generatedPatch": patch,
                "testsPassed": False,
                "passedTests": 0,
                "totalTests": 0,
                "durationMs": int((time.time() - start) * 1000),
                "error": "Failed to apply generated patch",
            }

        # 4. Run tests
        test_result = run_tests(repo_dir, task.get("testPatch", ""))

        duration = int((time.time() - start) * 1000)

        return {
            "taskId": task_id,
            "generatedPatch": patch,
            "testsPassed": test_result["passed"],
            "passedTests": test_result["passedTests"],
            "totalTests": test_result["totalTests"],
            "durationMs": duration,
        }

    except Exception as e:
        duration = int((time.time() - start) * 1000)
        return {
            "taskId": task_id,
            "generatedPatch": "",
            "testsPassed": False,
            "passedTests": 0,
            "totalTests": 0,
            "durationMs": duration,
            "error": str(e),
        }


def main():
    parser = argparse.ArgumentParser(description="SWE-bench task runner")
    parser.add_argument("--task", help="Task JSON string")
    parser.add_argument("--task-file", help="Task JSON file")
    parser.add_argument("--batch", help="Batch JSON file (array of tasks)")
    parser.add_argument("--output", help="Output file for batch results")
    parser.add_argument("--work-dir", default=".swe-bench-work", help="Working directory")
    args = parser.parse_args()

    if args.task:
        task = json.loads(args.task)
        result = run_single_task(task, args.work_dir)
        print(json.dumps(result))

    elif args.task_file:
        with open(args.task_file) as f:
            task = json.load(f)
        result = run_single_task(task, args.work_dir)
        print(json.dumps(result))

    elif args.batch:
        with open(args.batch) as f:
            data = json.load(f)
        tasks = data if isinstance(data, list) else data.get("tasks", [])

        results = []
        for i, task in enumerate(tasks):
            print(f"[runner] Task {i+1}/{len(tasks)}: {task.get('id', '?')}", file=sys.stderr)
            result = run_single_task(task, args.work_dir)
            results.append(result)

        output = json.dumps(results, indent=2)
        if args.output:
            with open(args.output, "w") as f:
                f.write(output)
            print(f"[runner] Results saved to {args.output}", file=sys.stderr)
        else:
            print(output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
