# Contributing to DSXU Code

DSXU is moving toward an open GitHub release, but V20 still uses strict owner gates. Contributions must preserve the original-side architecture.

## Principles

- Do not add a second product entrypoint.
- Do not add a second Query Loop.
- Do not add a second Tool Gate or Permission Gate.
- Do not add a second MCP/Skill/Plugin runtime.
- Do not add a second Agent orchestrator.
- Do not add a second provider runtime.
- Equivalent duplicate behavior must merge into the existing owner or become a replace/delete candidate.
- Different useful behavior must map to a named mainline owner.

## Before a PR

1. Identify the owner in `docs/DSXU_V20_MAINLINE_OWNER_MAP_20260514.md`.
2. Update tests or evidence for the touched owner.
3. Run focused verification for the changed surface.
4. Do not claim V20 PASS unless final release gates are complete.

## Suggested Checks

```bash
bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts --test-name-pattern "default CLI path"
npm run audit:dsxu:health
git diff --check
```

## Issue Reports

Please include:

- OS and shell。
- DSXU version or commit。
- command used。
- relevant `.env` keys without secrets。
- error output。
- whether MCP/skill/plugin/agent features were involved。

## Pull Request Scope

Keep PRs owner-scoped. Good PR shapes:

- one tool owner
- one permission flow
- one MCP registry feature
- one release document set
- one evidence gate

Avoid broad refactors that mix runtime, docs, tests, and unrelated cleanup without owner mapping.
