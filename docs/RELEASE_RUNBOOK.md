# DSXU Release Runbook

This runbook defines the V20 release order. It is intentionally stricter than normal development testing because DSXU has a large migrated code surface.

## Hard Order

1. Owner/Git signoff packets closed.
2. Deletion-state review closed.
3. ACL permission/ownership residues closed or explicitly signed off.
4. V20 real-gap productization completed.
5. Functional tests PASS.
6. Experience tests PASS.
7. Recovery tests PASS.
8. Performance tests PASS.
9. Evaluation tests PASS.
10. Release closure tests PASS.
11. Clean export generated and inspected.

## Preflight Commands

```bash
git status --short
git diff --check
npm run audit:dsxu:health
bun --env-file=.env ./src/entrypoints/dsxu-code.tsx mcp doctor --json
npm run test:dsxu:release
```

Focused tests may be used during development, but final release requires the full ordered gate.

## Release Artifacts

Expected GitHub release assets:

- source archive from clean export
- checksum file
- release notes
- install instructions
- known limits
- doctor/health output
- final test evidence summary

## Do Not Release If

- `git status --short` contains unsigned owner packets.
- deletion-state paths are not reviewed.
- ACL residues are not resolved or signed off.
- provider-migration fallback is enabled by default.
- MCP doctor reports `BLOCKED`, or reports `WARN` without explicit registry/server-scope signoff.
- `.dsxu/trace` or `.dsxu/runs` are included in export.
- `node_modules` is included in export.
- final tests are skipped or replaced by focused tests.
- P12/raw/eval evidence is missing or over-claimed.

## Rollback

If a release is published incorrectly:

1. Mark the GitHub release as pre-release or withdraw the asset.
2. Publish a corrected known-limits note.
3. Re-run release gates after fixing the owner issue.
4. Publish a patch release only after clean export passes again.
