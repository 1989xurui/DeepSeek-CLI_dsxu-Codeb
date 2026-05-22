# DSXU V20 ACL Residue Signoff - 2026-05-15

本记录把 `4` 个 ACL/ownership residue 从“待复核残留”推进为“owner 已签收的外部权限收口项”。它不强删、不改权限、不 stage、不 commit；只确认这些路径不能再作为产品 runtime 或兼容 holding path。

生成文件：

- `docs/generated/DSXU_V20_ACL_RESIDUE_SIGNOFF_20260515.csv`
- `docs/generated/DSXU_V20_ACL_RESIDUE_SIGNOFF_SUMMARY_20260515.json`

## Signoff 结果

| 项 | 数量 |
|---|---:|
| ACL residue rows | 4 |
| owner-signed rows | 4 |
| active product reference rows | 0 |

## Rows

| Path | Class | Signoff |
|---|---|---|
| `src/dsxu/engine/retrieval/integration-example.ts` | `empty-module-residue` | `OWNER_SIGNED_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS` |
| `src/dsxu/integration/harness/recovery-runtime-v3-harness.ts` | `empty-module-residue` | `OWNER_SIGNED_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS` |
| `src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts` | `empty-module-residue` | `OWNER_SIGNED_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS` |
| `src/dsxu/engine/adapters/bridge-adapter.ts` | `retired-adapter-tombstone` | `OWNER_SIGNED_EXTERNAL_RESIDUE_DELETE_WHEN_PERMISSION_ALLOWS` |

## 裁决

1. 这 4 个路径 active product refs 为 `0`。
2. 它们不是 DSXU product owner，也不是 fallback/compat runtime。
3. 权限/所有权允许时直接删除；在此之前只能作为外部 residue 留存。
4. 如果行为仍有价值，必须落到命名 DSXU owner，不能恢复 tombstone/empty module。

下一步继续 real-gap acceptance；最终测试仍放在 real-gap 与 release gates 之后。
