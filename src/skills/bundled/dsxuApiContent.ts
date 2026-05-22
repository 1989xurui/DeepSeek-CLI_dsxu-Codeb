// DSXU API bundled skill content.
// Keep this self-contained so the DSXU skill is runtime-backed without legacy doc directories.

export const SKILL_MODEL_VARS = {
  PRO_ID: 'deepseek-v4-pro',
  FLASH_ID: 'deepseek-v4-flash',
  REASONER_ID: 'deepseek-reasoner',
  CHAT_ID: 'deepseek-chat',
  CODER_ID: 'deepseek-coder',
} satisfies Record<string, string>

export const SKILL_PROMPT = `# DSXU API

Use this skill when the user is building, debugging, or reviewing code that calls the DSXU/DeepSeek API, chat-completions-compatible client libraries, DSXU tool calling, prompt cache, FIM, thinking/reasoning mode, or the DSXU agent runtime.

Prefer DSXU's chat-completions-compatible route unless the repository already has a stronger local abstraction. Preserve existing project style and tests. When code touches API cost, cache, usage, or retries, verify with a smoke test that returns nonzero usage or an explicit mocked usage assertion.

## Reading Guide
Choose the docs for the detected language, then include shared docs for model choice, prompt cache, tool use, and live sources.

## When to Use WebFetch
Use WebFetch only when the user asks for current docs or when local docs are insufficient for a current model/API detail.

## Common Pitfalls
- Do not hardcode provider keys.
- Do not report usage or cost as zero unless a test intentionally mocks zero usage.
- Keep retry, timeout, and streaming behavior observable in tests.
- For DSXU Code tasks, wire the result back into the CLI/tool/workflow path instead of leaving standalone helper code.`

const COMMON_README = `# DSXU API Quickstart

Use a chat-completions-compatible client with the DSXU/DeepSeek base URL and a DSXU provider key. Keep the base URL and key in configuration or environment variables.

Recommended defaults:
- General complex coding: {{PRO_ID}}
- Fast iteration and smoke tests: {{FLASH_ID}}
- Explicit reasoning workloads: {{REASONER_ID}}
- Legacy alias compatibility: {{CHAT_ID}} and {{CODER_ID}} map through DSXU model policy.

For production code:
- Capture input tokens, output tokens, cache hits, and cost.
- Treat streaming chunks as incremental deltas and finalize usage at stream end.
- Add one live or mocked smoke that proves usage/cost accounting is not silently zero.`

const STREAMING = `# Streaming

Use streaming for interactive CLI/TUI output. Accumulate text deltas, surface tool calls as structured events, and persist the final usage block. If the provider omits usage until the final chunk, keep a pending usage state and assert it is populated before closing the request ledger.`

const TOOL_USE = `# Tool Use

Normalize provider tool calls into DSXU tool_use records before execution. Keep tool name, input JSON, call id, and result/error status in the transcript. For XML or free-form calls, parse into the same DSXU shape before policy checks run.`

const BATCHES = `# Batches

Use batch mode for noninteractive evaluation, repository benchmarks, and recovery gates. Every batch should store per-task pass/fail, usage, cost, retry count, and the tool/runtime path exercised.`

const FILES_API = `# Files

Prefer workspace files and DSXU tool access for local code. Use uploaded files only when an external API requires file handles. Record file ids in a scoped ledger, not in user-facing prompts.`

const AGENT_SDK = `# DSXU Agent Runtime

Use the DSXU agent runtime when the user asks for code-review, TDD, security, workflow, recovery, or long-horizon execution. A valid activation should select the skill/agent/workflow, execute real tools, and return changed files or a concrete review result.`

const AGENT_PATTERNS = `# Agent Patterns

Recommended patterns:
- code-review: inspect diff, produce findings, optionally patch high-confidence issues.
- TDD: write or select a failing test, implement, rerun the focused test.
- security: run static checks and inspect risky paths before patching.
- workflow: apply executionPolicy before tool calls, then verify the policy affected routing.
- recovery: preserve the failing evidence, patch, rerun the original command.`

const ERROR_CODES = `# Error Handling

Classify errors as auth, rate limit, timeout, provider 4xx/5xx, parser, tool policy, or workspace failure. Include retryability and the command needed to reproduce.`

const LIVE_SOURCES = `# Live Sources

Use project-local docs first. If current API behavior matters, fetch the official provider documentation or the repository's configured DSXU docs source and cite the source in the result.`

const MODELS = `# Models

Route model names through DSXU model policy. Do not embed legacy model ids in new code paths. Compatibility aliases are allowed only at the facade boundary and should resolve to current DSXU/DeepSeek model ids.`

const PROMPT_CACHING = `# Prompt Caching

Keep stable system, tool, and large context blocks cacheable. Track cache creation/read tokens separately from normal input tokens. A product gate should fail if cache metadata is missing when caching is enabled.`

const TOOL_USE_CONCEPTS = `# Tool Use Concepts

Tool execution is a policy-controlled runtime path, not just prompt text. The DSXU sequence is: detect intent, select skill/agent/workflow, normalize model tool calls, apply executionPolicy, run the tool, record result, and verify.`

export const SKILL_FILES: Record<string, string> = {
  'csharp/dsxu-api.md': COMMON_README,
  'curl/examples.md': COMMON_README,
  'go/dsxu-api.md': COMMON_README,
  'java/dsxu-api.md': COMMON_README,
  'php/dsxu-api.md': COMMON_README,
  'python/agent-sdk/README.md': AGENT_SDK,
  'python/agent-sdk/patterns.md': AGENT_PATTERNS,
  'python/dsxu-api/README.md': COMMON_README,
  'python/dsxu-api/batches.md': BATCHES,
  'python/dsxu-api/files-api.md': FILES_API,
  'python/dsxu-api/streaming.md': STREAMING,
  'python/dsxu-api/tool-use.md': TOOL_USE,
  'ruby/dsxu-api.md': COMMON_README,
  'shared/error-codes.md': ERROR_CODES,
  'shared/live-sources.md': LIVE_SOURCES,
  'shared/models.md': MODELS,
  'shared/prompt-caching.md': PROMPT_CACHING,
  'shared/tool-use-concepts.md': TOOL_USE_CONCEPTS,
  'typescript/agent-sdk/README.md': AGENT_SDK,
  'typescript/agent-sdk/patterns.md': AGENT_PATTERNS,
  'typescript/dsxu-api/README.md': COMMON_README,
  'typescript/dsxu-api/batches.md': BATCHES,
  'typescript/dsxu-api/files-api.md': FILES_API,
  'typescript/dsxu-api/streaming.md': STREAMING,
  'typescript/dsxu-api/tool-use.md': TOOL_USE,
}
