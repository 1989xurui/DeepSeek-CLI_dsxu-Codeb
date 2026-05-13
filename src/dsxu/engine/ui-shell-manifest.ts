import fs from 'node:fs';
import path from 'node:path';
import type { DSXUUiShellContract } from './ui-shell-contract-registry';

export type DSXUUiShellManifest = {
  schemaVersion: 'v14.ui-shell-manifest.v1';
  product: 'DSXU';
  generatedAt: string;
  controlPlane: {
    owner: 'DSXU Control Plane';
    rule: 'UI shells mount DSXU contracts; they do not own policy, task, MCP, or model orchestration.';
  };
  openSourceTargets: {
    open_webui: DSXUUiShellContract[];
    continue: DSXUUiShellContract[];
    front_shell_adapter: DSXUUiShellContract[];
    dsxu_internal: DSXUUiShellContract[];
  };
  totals: {
    contracts: number;
    userReachable: number;
    internalRuntimeOnly: number;
    uiShellOnly: number;
  };
};

type UiShellContractRegistryFile = {
  generatedAt?: string;
  rows: DSXUUiShellContract[];
};

const DEFAULT_REGISTRY_PATH = 'src/dsxu/integration/harness/v14-ui-shell-contract-registry.json';

export function createDSXUUiShellManifest(
  contracts: DSXUUiShellContract[],
  generatedAt = new Date().toISOString(),
): DSXUUiShellManifest {
  return {
    schemaVersion: 'v14.ui-shell-manifest.v1',
    product: 'DSXU',
    generatedAt,
    controlPlane: {
      owner: 'DSXU Control Plane',
      rule: 'UI shells mount DSXU contracts; they do not own policy, task, MCP, or model orchestration.',
    },
    openSourceTargets: {
      open_webui: contracts.filter((contract) => contract.openSourceMount === 'open_webui'),
      continue: contracts.filter((contract) => contract.openSourceMount === 'continue'),
      front_shell_adapter: contracts.filter((contract) => contract.openSourceMount === 'front_shell_adapter'),
      dsxu_internal: contracts.filter((contract) => contract.openSourceMount === 'dsxu_internal'),
    },
    totals: {
      contracts: contracts.length,
      userReachable: contracts.filter((contract) => contract.userReachability === 'user_direct_reachable').length,
      internalRuntimeOnly: contracts.filter((contract) => contract.userReachability === 'internal_runtime_only').length,
      uiShellOnly: contracts.filter((contract) => contract.userReachability === 'ui_shell_only').length,
    },
  };
}

export function loadDSXUUiShellManifest(input?: { cwd?: string; registryPath?: string }) {
  const cwd = input?.cwd ?? process.cwd();
  const registryPath = input?.registryPath ?? DEFAULT_REGISTRY_PATH;
  const absolutePath = path.isAbsolute(registryPath) ? registryPath : path.join(cwd, registryPath);
  const registry = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as UiShellContractRegistryFile;
  return createDSXUUiShellManifest(registry.rows, registry.generatedAt);
}
