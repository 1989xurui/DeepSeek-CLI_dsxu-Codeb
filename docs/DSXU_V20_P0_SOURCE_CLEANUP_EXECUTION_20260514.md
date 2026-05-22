# DSXU V20 P0 源码清理执行记录

日期：2026-05-14

对应方案：

- `docs/DSXU_V20_MASTER_PLAN_20260514.md`
- `docs/DSXU_V20_FULL_CODE_INTEGRATION_ASSESSMENT_20260514.md`

## 1. 本轮执行口径

本轮不再停留在分析层，按 V20 原侧目标直接收口 P0：

1. 不新增产品入口。
2. 不保留第二套 runtime。
3. 不保留 legacy provider 路径作为产品主链。
4. 能移出项目的旧文件直接移出到 `D:\DSXU-code-quarantine`。
5. 仍有真实 import/use 的能力先搬到正确 owner，再移出旧路径。
6. Delete 权限被 Windows ACL 阻塞的文件，不强行夺权；已复制到外部并在项目内降为空模块，作为权限残留记录。

## 2. 已完成清理

### 2.1 V14/V15 shim 清理

已批量移除：

| 项 | 数量 |
|---|---:|
| 修改源码文件 | 1328 |
| 移除普通 V14 lifecycle block | 821 |
| 移除 strict wrapper | 147 |
| 移除 V15 ownership marker 注释 | 507 |

验证：

| 检查 | 结果 |
|---|---|
| `V14 lifecycle shim` | 0 |
| `V14 strict lifecycle shim` | 0 |
| `DSXU V15 ownership marker` | 0 |

### 2.2 Provider compat 路径移出

旧文件已移出项目：

- `src/dsxu/engine/provider-backend/dsxu-provider-compat.ts`

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_provider_compat`

项目内新 owner：

- `src/services/bridge/dsxuRemoteBridgeFacade.ts`

处理结果：

1. 所有产品 import 已改到 `src/services/bridge/dsxuRemoteBridgeFacade.ts`。
2. `src/dsxu/engine/provider-backend/dsxu-provider-compat.ts` 已不存在。
3. 源码内旧 `dsxu-provider-compat` / `provider-backend/dsxu-provider-compat` 引用为 0。

### 2.2b Provider backend 边界吸收

`src/dsxu/engine/provider-backend` 剩余 5 个真实 import/use 文件不是直接丢弃项，而是 owner 错位项。本轮已按原侧原则吸收到现有 services bridge owner，旧目录内容先归档到外部，再从项目内移除。

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_provider_backend_boundary`

项目内新 owner：

- `src/services/bridge/boundedUuidSet.ts`
- `src/services/bridge/dsxuLocalProviderBackend.ts`
- `src/services/bridge/dsxuRemoteSessionCoordinator.ts`
- `src/services/bridge/dsxuSdkMessageProjection.ts`
- `src/services/bridge/remotePermissionProjection.ts`

处理结果：

1. 所有产品、测试、harness import 已从 `src/dsxu/engine/provider-backend/*` 改到 `src/services/bridge/*`。
2. `src/dsxu/engine/provider-backend` 目录已从项目内移除。
3. 源码内旧 `provider-backend`、`local-provider-backend`、`dsxu-remote-session-manager`、`dsxu-sdk-message-adapter`、`dsxu-remote-permission-bridge`、`bounded-uuid-set` 信号为 0。
4. V6/V9/V10 provider replacement 合同已更新到 `services/bridge` owner，并使用真实 `D:\源代码claude\src` 参考根，不再假设项目内 reference-input。

### 2.3 `runtime-core.ts` 旧大块移出

旧文件已移出项目：

- `src/dsxu/engine/runtime-core.ts`

同步移出的旧证据测试 / harness：

- runtime-core 直接 import 测试
- runtime-core 旧 integration example
- runtime-core 旧 recovery harness

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_runtime_core`

处理结果：

1. `src/dsxu/engine/index.ts` 已移除 `export * from './runtime-core'`。
2. 产品主链保留 `src/dsxu/engine/runtime/index.ts` 的真实 runtime。
3. 源码内旧 `runtime-core` import/export/path contract 为 0。

权限残留：

| 文件 | 状态 |
|---|---|
| `src/dsxu/engine/retrieval/integration-example.ts` | Delete 被 ACL 阻塞，已归档到外部，项目内为空模块 |
| `src/dsxu/integration/harness/recovery-runtime-v3-harness.ts` | Delete 被 ACL 阻塞，已归档到外部，项目内为空模块 |

### 2.4 Legacy auth 路径移出

旧文件已移出项目：

- `src/dsxu/legacy/auth/legacyProviderAuth.ts`
- `src/dsxu/legacy/auth/legacyProviderControlAuth.ts`

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_legacy_auth`

项目内新 owner：

- `src/services/auth/dsxuProviderAuth.ts`
- `src/services/auth/dsxuProviderControlAuth.ts`

处理结果：

1. 所有 `dsxu/legacy/auth` import 已改到 `src/services/auth`。
2. 源码内 `dsxu/legacy/auth` 引用为 0。
3. auth owner import smoke PASS。

### 2.5 Legacy config/env/git 路径移出

旧文件已移出项目：

- `src/dsxu/legacy/config/legacyProviderConfig.ts`
- `src/dsxu/legacy/env/legacyProviderEnv.ts`
- `src/dsxu/legacy/git/legacyProviderAttribution.ts`

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_legacy_utils`

项目内新 owner：

- `src/utils/configCompat.ts`
- `src/utils/envCompat.ts`
- `src/utils/commitAttributionCompat.ts`

处理结果：

1. 所有 config/env/git legacy import 已改到 utils owner。
2. 源码内 `dsxu/legacy/config|env|git` 引用为 0。

### 2.6 Legacy model 路径移出

旧文件已移出项目：

- `src/dsxu/legacy/model/*`

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_legacy_model`
- `D:\DSXU-code-quarantine\V20_20260514_p0_legacy_model_runtime_compat`

项目内新 owner：

- `src/utils/model/compat/*`
- `src/utils/model/legacyModelCompat.ts`

处理结果：

1. 所有 `dsxu/legacy/model` import 已改到 `src/utils/model/compat` 或 `src/utils/model/legacyModelCompat.ts`。
2. 源码内 `dsxu/legacy/model` 引用为 0。
3. model compat import smoke PASS。

### 2.7 Legacy testing 路径移出

旧文件已移出项目或降为空权限残留：

- `src/dsxu/legacy/testing/legacyProviderRateLimitClaim.ts`
- `src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts`

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_legacy_testing`

项目内新 owner：

- `src/services/mockRateLimitsCompat/*`

权限残留：

| 文件 | 状态 |
|---|---|
| `src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts` | Delete 被 ACL 阻塞，已归档到外部，项目内为空模块 |

处理结果：

1. 所有 `dsxu/legacy/testing` import 已改到 `src/services/mockRateLimitsCompat`。
2. 源码内 `dsxu/legacy` 引用为 0。
3. mock rate-limit import smoke PASS。

### 2.8 Dirty review / old closure subsystem 移出

旧 V18/V19 dirty-review / owner-git / release-closure source evidence subsystem 已移出项目。

外部归档：

- `D:\DSXU-code-quarantine\V20_20260514_p0_dirty_review_subsystem`

移出范围包括：

- `dirty-review`
- `owner-git`
- `clean-export-readiness`
- `release-closure-board`
- `pending-deletion`
- `final-release-preflight`
- `deferred-product-absorption`
- `workspace-artifact-policy`

处理结果：

1. 源码内上述旧证据链关键词为 0。
2. V20 当前总账由 `docs/generated/DSXU_V20_SOURCE_CLEANUP_REGISTER_20260514.csv` 接管。

## 3. 外部归档总览

| 归档目录 | 文件数 |
|---|---:|
| `V20_20260514_p0_provider_compat` | 1 |
| `V20_20260514_p0_provider_backend_boundary` | 5 |
| `V20_20260514_p0_runtime_core` | 37 |
| `V20_20260514_p0_legacy_repl_launcher` | 1 |
| `V20_20260514_p0_legacy_auth` | 2 |
| `V20_20260514_p0_legacy_utils` | 3 |
| `V20_20260514_p0_legacy_model_runtime_compat` | 1 |
| `V20_20260514_p0_legacy_model` | 22 |
| `V20_20260514_p0_legacy_testing` | 2 |
| `V20_20260514_p0_dirty_review_subsystem` | 62 |

## 4. 当前剩余

### 4.1 P0 权限残留

只剩 3 个 Delete 权限阻塞空模块：

| 文件 | 当前内容 | 处理 |
|---|---|---|
| `src/dsxu/engine/retrieval/integration-example.ts` | `export {}` | 外部权限允许后删除 |
| `src/dsxu/integration/harness/recovery-runtime-v3-harness.ts` | `export {}` | 外部权限允许后删除 |
| `src/dsxu/legacy/testing/legacyProviderMockRateLimits.ts` | `export {}` | 外部权限允许后删除 |

这些文件已不含旧路径、旧 runtime 或旧 provider 引用，不再属于产品主链。

2026-05-14 追加确认：对上述 3 个空模块再次执行 `Move-Item` 外移，Windows 仍返回 `Access to the path is denied.`；当前不是产品代码保留，而是源端文件所有权/ACL 收口项。

### 4.2 P1 产品专属信号

当前 V20 cleanup register 剩余：

| 类别 | 数量 |
|---|---:|
| `GrowthBook` | 324 |
| `subscription` | 221 |
| `billing` | 117 |
| `ANT-ONLY` | 73 |

这些不是本轮 P0 第二 runtime 问题，但下一步必须按产品 owner 继续判断：

1. DSXU 真实产品需要：改成 DSXU 命名与配置。
2. 旧产品专属：移出或 release exclude。
3. 测试/证据专用：移到测试/evidence owner。

## 5. 验证结果

已执行：

| 验证 | 结果 |
|---|---|
| `bun run lint-schema` | PASS |
| `import('./src/services/bridge/dsxuRemoteBridgeFacade.ts')` | PASS |
| `import('./src/services/bridge/dsxuRemoteSessionCoordinator.ts')` | PASS |
| `import('./src/services/bridge/dsxuLocalProviderBackend.ts')` | PASS |
| `import('./src/services/bridge/remotePermissionProjection.ts')` | PASS |
| `import('./src/services/bridge/dsxuSdkMessageProjection.ts')` | PASS |
| `import('./src/services/bridge/boundedUuidSet.ts')` | PASS |
| `import('./src/services/auth/dsxuProviderControlAuth.ts')` | PASS |
| `import('./src/utils/model/compat/legacyProviderModel.ts')` | PASS |
| `import('./src/services/mockRateLimits.ts')` | PASS |
| `import('./src/entrypoints/replLauncher.tsx')` | PASS |
| `import('./src/main.tsx')` | PASS |
| `bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts src/dsxu/engine/__tests__/control-plane-v1.test.ts src/dsxu/engine/__tests__/remote-lifecycle-v1.test.ts src/dsxu/engine/__tests__/v6-mainline-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v9-reference-absorption-completion-contract-v1.test.ts src/dsxu/engine/__tests__/v10-reference-behavior-productization-contract-v1.test.ts` | PASS, 37 tests |
| `git diff --check` | PASS，只有 Git CRLF 提示 |

已确认源码中以下旧信号为 0：

- `V14 lifecycle shim`
- `V14 strict lifecycle shim`
- `DSXU V15 ownership marker`
- `dsxu-provider-compat`
- `provider-backend/dsxu-provider-compat`
- `provider-backend`
- `local-provider-backend`
- `dsxu-remote-session-manager`
- `dsxu-sdk-message-adapter`
- `dsxu-remote-permission-bridge`
- `bounded-uuid-set`
- `dsxu/legacy`
- 旧 `runtime-core` import/export/path contract
- `dirty-review`
- `owner-git`
- `clean-export-readiness`
- `release-closure-board`
- `pending-deletion`

## 6. 下一步

下一步不是回头补 P0，而是进入 P1 产品化清理：

1. `GrowthBook`：确认是 DSXU 配置/kill switch 还是旧产品 feature flag。
2. `subscription` / `billing`：确认是否是 DSXU provider/cost ledger，旧订阅语义必须改名或移出。
3. `ANT-ONLY`：全部清除或转成明确 DSXU test-only/release-excluded。
4. 最后再进入功能测试、体验测试、恢复测试、性能测试、评测测试、发布收口测试。
