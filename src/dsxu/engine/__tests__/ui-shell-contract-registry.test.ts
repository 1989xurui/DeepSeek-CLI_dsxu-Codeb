import { describe, expect, test } from 'bun:test'
import {
  buildDSXUUiShellContract,
  createDSXUUiShellContractRegistry,
  type DSXUUiShellTransitionRow,
} from '../ui-shell-contract-registry'

describe('DSXU UI shell contract registry', () => {
  test('projects external UI shells into DSXU-owned contracts without granting orchestration ownership', () => {
    const rows: DSXUUiShellTransitionRow[] = [
      {
        relPath: 'src/ui/policies/PermissionDialog.tsx',
        capability: 'permission approval surface',
        familySubkind: 'policy',
        callableVia: ['open-webui'],
        shellTarget: 'open_webui_modal_shell',
        replacementMode: 'contract-projection',
        dsxuOwner: 'Permission Gate',
        userReachability: 'user_direct_reachable',
      },
      {
        relPath: 'src/ui/tasks/TaskWorkbench.tsx',
        capability: 'task workbench projection',
        familySubkind: 'task',
        callableVia: ['continue'],
        shellTarget: 'continue_task_workbench',
        replacementMode: 'contract-projection',
        dsxuOwner: 'PlanGraph / Work-State',
        userReachability: 'user_direct_reachable',
      },
      {
        relPath: 'src/ui/mcp/McpResourceDialog.tsx',
        capability: 'MCP resource approval projection',
        familySubkind: 'mcp',
        callableVia: ['open-webui'],
        shellTarget: 'open_webui_modal_shell',
        replacementMode: 'contract-projection',
        dsxuOwner: 'MCP / Skill Registry',
        userReachability: 'ui_shell_only',
      },
      {
        relPath: 'src/internal/InputHook.ts',
        capability: 'internal input event hook',
        familySubkind: 'runtime',
        callableVia: ['dsxu-internal'],
        shellTarget: 'dsxu_internal_ui_hook_contract',
        replacementMode: 'contract-projection',
        dsxuOwner: 'Query Loop / Execution Contract',
        userReachability: 'internal_runtime_only',
      },
    ]

    const contracts = rows.map(buildDSXUUiShellContract)
    const registry = createDSXUUiShellContractRegistry(rows)

    expect(contracts.map(contract => contract.id)).toEqual([
      'dsxu.ui.src.ui.policies.permissiondialog',
      'dsxu.ui.src.ui.tasks.taskworkbench',
      'dsxu.ui.src.ui.mcp.mcpresourcedialog',
      'dsxu.ui.src.internal.inputhook',
    ])
    expect(registry.forOpenSourceMount('open_webui')).toHaveLength(2)
    expect(registry.forOpenSourceMount('continue')).toHaveLength(1)
    expect(registry.forOpenSourceMount('dsxu_internal')).toHaveLength(1)
    expect(registry.userReachable()).toHaveLength(2)

    expect(registry.getByPath('src/ui/policies/PermissionDialog.tsx')?.mainlinePolicy).toBe('dsxu_policy_resource_contract')
    expect(registry.getByPath('src/ui/tasks/TaskWorkbench.tsx')?.mainlinePolicy).toBe('dsxu_task_protocol')
    expect(registry.getByPath('src/ui/mcp/McpResourceDialog.tsx')?.kind).toBe('mcp_resource_dialog')
    expect(registry.getByPath('src/internal/InputHook.ts')?.controlPlaneContract).toBe('runtime.input_event_contract')

    for (const contract of registry.all()) {
      expect(contract.controlPlaneContract).not.toContain('provider')
      expect(contract.controlPlaneContract).not.toContain('model')
      expect(contract.mainlinePolicy).not.toContain('runtime_owner')
    }
  })
})
