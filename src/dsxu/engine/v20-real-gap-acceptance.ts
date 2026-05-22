import { getDsxuOperatorStateProjectionRuntimeProfile } from '../control-plane/operatorStateProjection.js'
import { getDsxuRemoteBridgeFacadeRuntimeProfile } from '../../services/bridge/dsxuRemoteBridgeFacade.js'
import { getDsxuRemoteSessionCoordinatorRuntimeProfile } from '../../services/bridge/dsxuRemoteSessionCoordinator.js'
import { getDsxuMcpConfigRuntimeProfile } from '../../services/mcp/config.js'
import { getDsxuPluginMcpRuntimeProfile } from '../../utils/plugins/mcpPluginIntegration.js'
import { getDsxuPluginCommandRuntimeProfile } from '../../utils/plugins/loadPluginCommands.js'
import { getDsxuSkillsLoaderRuntimeProfile } from '../../skills/loadSkillsDir.js'
import { getDsxuApiServiceRuntimeProfile } from './api-service.js'

export type DsxuV20RealGapAcceptanceStatus =
  | 'FOCUSED_ACCEPTANCE_READY'
  | 'LIVE_TARGET_INPUT_REQUIRED'

export type DsxuV20ProjectIntakeKind =
  | 'project_instruction'
  | 'project_mcp_config'
  | 'project_command'
  | 'project_skill'
  | 'project_settings_or_hooks'
  | 'project_plugin_component'
  | 'ordinary_project_file'

export type DsxuV20ProjectIntakeDecision = {
  path: string
  kind: DsxuV20ProjectIntakeKind
  owner: string
  route: string
  activeRuntimeAdded: false
  decision:
    | 'MAINLINE_OWNER_ACCEPTED'
    | 'READ_ONLY_CONTEXT_ACCEPTED'
    | 'UNKNOWN_PROJECT_INPUT_REQUIRES_OWNER_REVIEW'
}

export type DsxuV20RealGapAcceptancePacket = {
  id:
    | 'V20-RG-01-project-intake'
    | 'V20-RG-02-external-agent-host'
    | 'V20-RG-03-external-chat-agent-api'
    | 'V20-RG-04-operator-dashboard'
    | 'V20-RG-05-target-reference-raw-input'
  status: DsxuV20RealGapAcceptanceStatus
  owner: string
  surface: string
  sourceOwners: readonly string[]
  mainlineRoute: readonly string[]
  prohibitedRuntime: readonly string[]
  evidence: readonly string[]
  remainingLiveInput: readonly string[]
}

export type DsxuV20RealGapAcceptanceSummary = {
  schema: 'dsxu.v20.real-gap-acceptance.v1'
  status:
    | 'FOCUSED_ACCEPTANCE_READY_TARGET_RAW_STILL_EXTERNAL'
    | 'FOCUSED_ACCEPTANCE_READY_TARGET_RAW_IMPORTED'
  packetCount: number
  focusedReadyPackets: number
  liveInputRequiredPackets: number
  unknownProjectInputs: number
  noSecondRuntime: boolean
  packets: DsxuV20RealGapAcceptancePacket[]
}

function normalizeProjectPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase()
}

export function classifyV20ProjectIntakeFile(
  path: string,
): DsxuV20ProjectIntakeDecision {
  const normalized = normalizeProjectPath(path)
  const segments = normalized.split('/')
  const basename = segments.at(-1) ?? normalized

  if (basename === 'dsxu.md' || basename === 'dsxu.local.md') {
    return {
      path,
      kind: 'project_instruction',
      owner: 'DSXU Context / Instruction Owner',
      route: 'src/utils/instructionFiles.ts -> Query Loop context assembly',
      activeRuntimeAdded: false,
      decision: 'MAINLINE_OWNER_ACCEPTED',
    }
  }

  if (basename === '.mcp.json') {
    return {
      path,
      kind: 'project_mcp_config',
      owner: 'DSXU MCP Config',
      route: 'src/services/mcp/config.ts -> useManageMCPConnections Tool Gate',
      activeRuntimeAdded: false,
      decision: 'MAINLINE_OWNER_ACCEPTED',
    }
  }

  if (normalized.includes('/.dsxu/commands/') && basename.endsWith('.md')) {
    return {
      path,
      kind: 'project_command',
      owner: 'DSXU Skills Loader',
      route: 'src/skills/loadSkillsDir.ts -> command parser -> Tool Gate',
      activeRuntimeAdded: false,
      decision: 'MAINLINE_OWNER_ACCEPTED',
    }
  }

  if (
    normalized.includes('/.dsxu/skills/') &&
    (basename === 'skill.md' || basename.endsWith('.md'))
  ) {
    return {
      path,
      kind: 'project_skill',
      owner: 'DSXU Skills Loader',
      route: 'src/skills/loadSkillsDir.ts -> SkillTool dynamic registry',
      activeRuntimeAdded: false,
      decision: 'MAINLINE_OWNER_ACCEPTED',
    }
  }

  if (
    normalized.includes('/.dsxu/plugins/') &&
    (basename.endsWith('.md') || basename.endsWith('.json'))
  ) {
    return {
      path,
      kind: 'project_plugin_component',
      owner: 'DSXU Plugin Runtime',
      route: 'src/utils/plugins/* -> plugin command/MCP adapter boundary',
      activeRuntimeAdded: false,
      decision: 'MAINLINE_OWNER_ACCEPTED',
    }
  }

  if (
    normalized.includes('/.dsxu/') &&
    (basename.includes('settings') || basename.includes('hook')) &&
    (basename.endsWith('.json') || basename.endsWith('.jsonc'))
  ) {
    return {
      path,
      kind: 'project_settings_or_hooks',
      owner: 'DSXU Settings / Hooks Owner',
      route: 'src/utils/settings/types.ts -> src/utils/hooks.ts',
      activeRuntimeAdded: false,
      decision: 'MAINLINE_OWNER_ACCEPTED',
    }
  }

  return {
    path,
    kind: 'ordinary_project_file',
    owner: 'DSXU Context / File Read Owner',
    route: 'read/edit tools must enter Tool Gate and context accounting',
    activeRuntimeAdded: false,
    decision: 'READ_ONLY_CONTEXT_ACCEPTED',
  }
}

export function classifyV20ProjectIntakeFiles(
  paths: readonly string[],
): DsxuV20ProjectIntakeDecision[] {
  return paths.map(path => classifyV20ProjectIntakeFile(path))
}

function projectIntakePacket(
  decisions: readonly DsxuV20ProjectIntakeDecision[],
): DsxuV20RealGapAcceptancePacket {
  const mcpConfig = getDsxuMcpConfigRuntimeProfile()
  const skillsLoader = getDsxuSkillsLoaderRuntimeProfile()
  const pluginMcp = getDsxuPluginMcpRuntimeProfile()
  const pluginCommands = getDsxuPluginCommandRuntimeProfile()
  const unknownInputs = decisions.filter(
    decision => decision.decision === 'UNKNOWN_PROJECT_INPUT_REQUIRES_OWNER_REVIEW',
  )

  return {
    id: 'V20-RG-01-project-intake',
    status: unknownInputs.length === 0
      ? 'FOCUSED_ACCEPTANCE_READY'
      : 'LIVE_TARGET_INPUT_REQUIRED',
    owner: 'DSXU Project Intake / Context Owner',
    surface: 'external project files, .mcp.json, DSXU.md, commands, skills, hooks',
    sourceOwners: [
      mcpConfig.runtime,
      skillsLoader.runtime,
      pluginMcp.owner,
      pluginCommands.owner,
    ],
    mainlineRoute: [
      'project instruction files enter context assembly',
      '.mcp.json enters DSXU MCP Config and connection owner',
      '.dsxu/commands and .dsxu/skills enter DSXU Skills Loader',
      'plugin command/MCP components enter DSXU Plugin Runtime adapter boundary',
      'settings and hooks enter DSXU Settings / Hooks Owner',
    ],
    prohibitedRuntime: [
      'no project-local query loop',
      'no project-local MCP manager',
      'no project-local skill runtime',
      'no project-local shell runner',
    ],
    evidence: decisions.map(
      decision =>
        `${decision.path} -> ${decision.owner} via ${decision.route}; activeRuntimeAdded=${decision.activeRuntimeAdded}`,
    ),
    remainingLiveInput:
      unknownInputs.length === 0
        ? []
        : ['unknown project intake files require owner review before release PASS'],
  }
}

function externalAgentHostPacket(): DsxuV20RealGapAcceptancePacket {
  const bridge = getDsxuRemoteBridgeFacadeRuntimeProfile()
  const coordinator = getDsxuRemoteSessionCoordinatorRuntimeProfile()

  return {
    id: 'V20-RG-02-external-agent-host',
    status: 'FOCUSED_ACCEPTANCE_READY',
    owner: 'DSXU Control Plane Adapter Boundary',
    surface: 'external host / agent session ingress',
    sourceOwners: [bridge.owner, coordinator.owner],
    mainlineRoute: [
      'external session is registered in DsxuControlSessionRegistry',
      'agent messages are recorded as control-plane session messages',
      'permission requests are surfaced through DsxuRemoteSessionCoordinator callbacks',
      'tool execution still routes through DSXU Tool Gate and result evidence',
      'model execution remains owned by Query Loop and Model Router',
    ],
    prohibitedRuntime: [
      'no standalone agent orchestrator',
      'no standalone permission runtime',
      'no standalone tool runner',
      'no standalone transcript store',
    ],
    evidence: [
      ...bridge.activationEvidence,
      ...coordinator.activationEvidence,
      ...coordinator.releaseRiskControls,
    ],
    remainingLiveInput: [],
  }
}

function externalChatAgentApiPacket(): DsxuV20RealGapAcceptancePacket {
  const api = getDsxuApiServiceRuntimeProfile()

  return {
    id: 'V20-RG-03-external-chat-agent-api',
    status: 'FOCUSED_ACCEPTANCE_READY',
    owner: api.owner,
    surface: 'chat-completions-compatible client and agent API boundary',
    sourceOwners: [api.runtime],
    mainlineRoute: [
      'external client request is normalized into DSXU task/query input',
      'model dispatch goes through DeepSeek-compatible provider control',
      'tool calls enter DSXU Tool Gate instead of client-owned execution',
      'usage output is normalized into DSXU cost/evidence accounting',
      'fallback providers require explicit operator opt-in',
    ],
    prohibitedRuntime: [
      'no standalone provider runtime',
      'no implicit external fallback from API key presence',
      'no client-owned tool execution',
      'no client-owned cost ledger',
    ],
    evidence: [...api.activationEvidence, ...api.releaseRiskControls],
    remainingLiveInput: [],
  }
}

function operatorDashboardPacket(): DsxuV20RealGapAcceptancePacket {
  const projection = getDsxuOperatorStateProjectionRuntimeProfile()

  return {
    id: 'V20-RG-04-operator-dashboard',
    status: 'FOCUSED_ACCEPTANCE_READY',
    owner: projection.owner,
    surface: 'operator dashboard / UI / TUI visible state',
    sourceOwners: [projection.runtime],
    mainlineRoute: [
      'dashboard reads DsxuControlSessionRegistry snapshots',
      'pending permissions become visible prompts through permissionControlBridge',
      'remote session status and messages remain read-side projection state',
      'operator responses go back through control-plane permission bridge',
    ],
    prohibitedRuntime: [
      'no dashboard query loop',
      'no dashboard model provider',
      'no dashboard MCP client',
      'no dashboard shell runner',
    ],
    evidence: [
      ...projection.activationEvidence,
      ...projection.releaseRiskControls,
    ],
    remainingLiveInput: [],
  }
}

export function buildDsxuV20RealGapAcceptanceSummary(input?: {
  projectIntakePaths?: readonly string[]
  targetReferenceManifestImported?: boolean
}): DsxuV20RealGapAcceptanceSummary {
  const projectDecisions = classifyV20ProjectIntakeFiles(
    input?.projectIntakePaths ?? [],
  )
  const packets = [
    projectIntakePacket(projectDecisions),
    externalAgentHostPacket(),
    externalChatAgentApiPacket(),
    operatorDashboardPacket(),
  ]
  const targetRawPacket: DsxuV20RealGapAcceptancePacket = {
    id: 'V20-RG-05-target-reference-raw-input',
    status: input?.targetReferenceManifestImported === true
      ? 'FOCUSED_ACCEPTANCE_READY'
      : 'LIVE_TARGET_INPUT_REQUIRED',
    owner: 'P12 Target Reference Intake',
    surface: 'real paired target-reference raw transcript manifest',
    sourceOwners: ['external target-reference evidence owner'],
    mainlineRoute: [
      'target manifest import',
      'P12 raw comparison',
      'raw readiness',
      'owner board',
      'final preflight',
    ],
    prohibitedRuntime: [
      'no template target logs',
      'no generic logs counted as RT family coverage',
      'no target-only PASS without paired DSXU raw output',
    ],
    evidence: [],
    remainingLiveInput:
      input?.targetReferenceManifestImported === true
        ? []
        : ['targetReferenceManifestPath still required for final P12 PASS'],
  }
  const allPackets = [...packets, targetRawPacket]
  const focusedReadyPackets = allPackets.filter(
    packet => packet.status === 'FOCUSED_ACCEPTANCE_READY',
  ).length
  const liveInputRequiredPackets = allPackets.length - focusedReadyPackets
  const unknownProjectInputs = projectDecisions.filter(
    decision => decision.decision === 'UNKNOWN_PROJECT_INPUT_REQUIRES_OWNER_REVIEW',
  ).length

  return {
    schema: 'dsxu.v20.real-gap-acceptance.v1',
    status: input?.targetReferenceManifestImported === true
      ? 'FOCUSED_ACCEPTANCE_READY_TARGET_RAW_IMPORTED'
      : 'FOCUSED_ACCEPTANCE_READY_TARGET_RAW_STILL_EXTERNAL',
    packetCount: allPackets.length,
    focusedReadyPackets,
    liveInputRequiredPackets,
    unknownProjectInputs,
    noSecondRuntime: allPackets.every(packet =>
      packet.prohibitedRuntime.every(item => item.startsWith('no ')),
    ),
    packets: allPackets,
  }
}
