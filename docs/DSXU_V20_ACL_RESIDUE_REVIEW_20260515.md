# DSXU V20 ACL Residue Review - 2026-05-15

本记录复核 4 个 ACL/ownership residue。它不改权限、不强删、不 stage；只确认这些文件不能继续作为产品 owner。

2026-05-15 update: 当前会话执行过真实删除尝试，4 个路径全部被 Windows ACL 拒绝删除。`acl:preflight` 已升级为 Delete/DeleteChild ACL 检查，结果为 `BLOCKED_DELETE_PERMISSION_DENIED_OR_EXTERNAL_SIGNOFF`，`deletableResidues=0/4`。这些文件仍不能被恢复为 runtime、bridge、empty module owner 或 compatibility holding path；只能由外部权限/提升 owner session 删除，或作为非产品 residue 被明确签收。

## Result

| Item | Count |
|---|---:|
| Total residues | 4 |
| Ready for external delete or owner signoff | 4 |
| Active product reference rows | 0 |
| Deletable in current session | 0 |

## Rows

| Path | Git | Class | Product refs | Decision |
|---|---|---|---:|---|
| `src/dsxu/engine/retrieval/integration-example.ts` | `M` | `empty-module-residue` | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |
| `src/dsxu/integration/harness/recovery-runtime-v3-harness.ts` | `M` | `empty-module-residue` | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |
| `src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts` | `M` | `empty-module-residue` | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |
| `src/dsxu/engine/adapters/bridge-adapter.ts` | `M` | `retired-adapter-tombstone` | 0 | `READY_FOR_EXTERNAL_DELETE_OR_OWNER_SIGNOFF` |

Rule: these paths are cleanup residues only. If behavior is needed, it must live in the named DSXU owner; do not import these files again.

Evidence files:

- `docs/generated/DSXU_V20_ACL_RESIDUE_REVIEW_20260515.csv`
- `docs/generated/DSXU_V20_ACL_RESIDUE_REVIEW_SUMMARY_20260515.json`
