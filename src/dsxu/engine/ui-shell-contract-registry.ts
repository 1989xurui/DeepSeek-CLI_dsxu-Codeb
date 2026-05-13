export type DSXUUiShellTarget =
  | 'open_webui_modal_shell'
  | 'continue_task_workbench'
  | 'open_webui_design_shell'
  | 'dsxu_internal_ui_hook_contract';

export type DSXUUiContractKind =
  | 'policy_dialog'
  | 'mcp_resource_dialog'
  | 'search_dialog'
  | 'task_workbench_flow'
  | 'design_widget'
  | 'internal_input_hook';

export type DSXUUiReachability = 'user_direct_reachable' | 'internal_runtime_only' | 'ui_shell_only';

export type DSXUUiShellTransitionRow = {
  relPath: string;
  capability: string;
  familySubkind: string;
  callableVia: string[];
  shellTarget: DSXUUiShellTarget;
  replacementMode: string;
  dsxuOwner: string;
  userReachability: DSXUUiReachability;
};

export type DSXUUiShellContract = {
  id: string;
  sourcePath: string;
  capability: string;
  kind: DSXUUiContractKind;
  shellTarget: DSXUUiShellTarget;
  dsxuOwner: string;
  callableVia: string[];
  userReachability: DSXUUiReachability;
  controlPlaneContract: string;
  openSourceMount: 'open_webui' | 'continue' | 'dsxu_internal' | 'front_shell_adapter';
  mainlinePolicy: 'dsxu_policy_resource_contract' | 'dsxu_task_protocol' | 'visual_shell_only' | 'internal_runtime_contract';
};

function stableContractId(path: string) {
  return `dsxu.ui.${path.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.|\.$/g, '').toLowerCase()}`;
}

function inferContractKind(row: DSXUUiShellTransitionRow): DSXUUiContractKind {
  if (row.shellTarget === 'dsxu_internal_ui_hook_contract') return 'internal_input_hook';
  if (row.shellTarget === 'continue_task_workbench') return 'task_workbench_flow';
  if (row.shellTarget === 'open_webui_design_shell') return 'design_widget';
  if (row.relPath.includes('/mcp/')) return 'mcp_resource_dialog';
  if (row.relPath.endsWith('GlobalSearchDialog.tsx') || row.relPath.endsWith('QuickOpenDialog.tsx')) return 'search_dialog';
  return 'policy_dialog';
}

function inferOpenSourceMount(target: DSXUUiShellTarget): DSXUUiShellContract['openSourceMount'] {
  if (target === 'open_webui_modal_shell') return 'open_webui';
  if (target === 'continue_task_workbench') return 'continue';
  if (target === 'dsxu_internal_ui_hook_contract') return 'dsxu_internal';
  return 'front_shell_adapter';
}

function inferMainlinePolicy(target: DSXUUiShellTarget): DSXUUiShellContract['mainlinePolicy'] {
  if (target === 'open_webui_modal_shell') return 'dsxu_policy_resource_contract';
  if (target === 'continue_task_workbench') return 'dsxu_task_protocol';
  if (target === 'dsxu_internal_ui_hook_contract') return 'internal_runtime_contract';
  return 'visual_shell_only';
}

function inferControlPlaneContract(kind: DSXUUiContractKind) {
  if (kind === 'mcp_resource_dialog') return 'resource_layer.mcp_approval_contract';
  if (kind === 'search_dialog') return 'resource_layer.search_contract';
  if (kind === 'task_workbench_flow') return 'task_graph.command_resume_agent_contract';
  if (kind === 'internal_input_hook') return 'runtime.input_event_contract';
  if (kind === 'design_widget') return 'front_shell.visual_state_contract';
  return 'governance.permission_approval_contract';
}

export function buildDSXUUiShellContract(row: DSXUUiShellTransitionRow): DSXUUiShellContract {
  const kind = inferContractKind(row);

  return {
    id: stableContractId(row.relPath),
    sourcePath: row.relPath,
    capability: row.capability,
    kind,
    shellTarget: row.shellTarget,
    dsxuOwner: row.dsxuOwner,
    callableVia: [...row.callableVia],
    userReachability: row.userReachability,
    controlPlaneContract: inferControlPlaneContract(kind),
    openSourceMount: inferOpenSourceMount(row.shellTarget),
    mainlinePolicy: inferMainlinePolicy(row.shellTarget),
  };
}

export function buildDSXUUiShellContracts(rows: DSXUUiShellTransitionRow[]) {
  return rows.map(buildDSXUUiShellContract);
}

export function createDSXUUiShellContractRegistry(rows: DSXUUiShellTransitionRow[]) {
  const contracts = buildDSXUUiShellContracts(rows);
  const byId = new Map(contracts.map((contract) => [contract.id, contract]));
  const byPath = new Map(contracts.map((contract) => [contract.sourcePath, contract]));

  return {
    all: () => contracts,
    getById: (id: string) => byId.get(id),
    getByPath: (sourcePath: string) => byPath.get(sourcePath),
    forOpenSourceMount: (mount: DSXUUiShellContract['openSourceMount']) =>
      contracts.filter((contract) => contract.openSourceMount === mount),
    userReachable: () => contracts.filter((contract) => contract.userReachability === 'user_direct_reachable'),
  };
}
