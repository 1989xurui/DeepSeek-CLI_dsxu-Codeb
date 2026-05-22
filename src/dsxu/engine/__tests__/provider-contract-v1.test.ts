import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  createLocalDSXUProviderContract,
  redactCredentialLikeValues,
} from '../provider-contract'
import { APIService } from '../api-service'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../../utils/model/deepseekV4Control'
import {
  handleDsxuProviderAliasCommand,
  isDsxuProviderAliasCommand,
} from '../provider-alias'
import {
  createDsxuLocalProviderBackend,
  getDefaultDsxuLocalProviderBackend,
} from '../../../services/bridge/dsxuLocalProviderBackend'
import {
  createRemoteSessionConfig,
  DsxuRemoteSessionCoordinator,
} from '../../../services/bridge/dsxuRemoteSessionCoordinator'
import { SendMessageTool } from '../../../tools/SendMessageTool/SendMessageTool'
import { getPrompt as getSendMessagePrompt } from '../../../tools/SendMessageTool/prompt'

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return listSourceFiles(fullPath)
    }
    return /\.(?:ts|tsx|js)$/.test(entry.name) ? [fullPath] : []
  })
}

describe('DSXU provider contract V1', () => {
  test('APIService DeepSeek backend reuses the canonical DeepSeek chat completion body builder', async () => {
    const originalFetch = globalThis.fetch
    const captured: Array<{ url: string; body: any }> = []
    globalThis.fetch = (async (input, init) => {
      captured.push({
        url: String(input),
        body: JSON.parse(String(init?.body ?? '{}')),
      })
      return new Response(JSON.stringify({
        choices: [{
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 2,
          total_tokens: 12,
        },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'dsxu-provider-contract-test',
        },
      })
    }) as typeof fetch

    try {
      const service = new APIService({
        deepseekKey: 'sk-test',
        deepseekUrl: 'https://api.deepseek.com/v1',
      })

      const result = await service.callWithFallback(
        [{ role: 'user', content: 'hello' }],
        [{
          type: 'function',
          function: {
            name: 'Read',
            description: 'read a file',
            parameters: {
              type: 'object',
              properties: { file_path: { type: 'string' } },
              required: ['file_path'],
            },
          },
        }],
        DEEPSEEK_V4_FLASH_MODEL,
        1024,
      )

      expect(result.backend).toBe('deepseek')
      expect(captured).toHaveLength(1)
      expect(captured[0].url).toBe('https://api.deepseek.com/v1/chat/completions')
      expect(captured[0].body).toMatchObject({
        model: DEEPSEEK_V4_FLASH_MODEL,
        max_tokens: 1024,
        thinking: { type: 'disabled' },
        temperature: 1,
      })
      expect(captured[0].body.tools[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'Read',
          parameters: {
            type: 'object',
            properties: { file_path: { type: 'string' } },
            required: ['file_path'],
          },
        },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('defaults to local identity and blocks provider-migration remote shells', async () => {
    const events: unknown[] = []
    const provider = createLocalDSXUProviderContract({
      emitEvent: event => events.push(event),
    })

    expect(provider.identity.providerId).toBe('dsxu-local')
    expect(provider.identity.mode).toBe('local')
    expect(provider.archivedBridge.enabled).toBe(false)
    expect(provider.archivedBridge.flagName).toBe('DSXU_ENABLE_PROVIDER_MIGRATION_BRIDGE')

    const remote = await provider.createRemoteSession({
      sessionId: 'session-provider-v1',
      cwd: process.cwd(),
    })

    expect(remote.status).toBe('blocked')
    expect(remote.reason).toContain('DSXU-owned remote session backend')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'remote_blocked',
      sessionId: 'session-provider-v1',
    })
  })

  test('redacts MCP credential-like fields recursively', () => {
    const filtered = redactCredentialLikeValues({
      server: 'github',
      authorization: 'Bearer token',
      nested: {
        apiKey: 'abc',
        cookie: 'session=secret',
        safe: 'visible',
      },
      list: [{ password: 'pw' }, { value: 1 }],
      text: 'Authorization Bearer raw.secret.value and sk-provider-secret-value',
    })

    expect(filtered).toEqual({
      server: 'github',
      authorization: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        cookie: '[REDACTED]',
        safe: 'visible',
      },
      list: [{ password: '[REDACTED]' }, { value: 1 }],
      text: 'Authorization Bearer [REDACTED] and [REDACTED]',
    })
  })

  test('permission callback is explicit and deny-by-default', async () => {
    const provider = createLocalDSXUProviderContract()
    const decision = await provider.requestPermission({
      sessionId: 'session-provider-v1',
      toolName: 'Bash',
      input: { command: 'echo ok' },
      permission: { behavior: 'ask' },
    })

    expect(decision.behavior).toBe('deny')
    expect(decision.message).toContain('explicit DSXU provider permission callback')
  })

  test('default CLI path stays on DSXU local provider shell contract', () => {
    const root = process.cwd()
    const launcher = readFileSync(join(root, 'bin/dsxu-code-wsl-launch'), 'utf8')
    const bin = readFileSync(join(root, 'bin/dsxu-code'), 'utf8')
    const cli = readFileSync(join(root, 'src/entrypoints/cli.tsx'), 'utf8')
    const init = readFileSync(join(root, 'src/entrypoints/init.ts'), 'utf8')
    const print = readFileSync(join(root, 'src/cli/print.ts'), 'utf8')
    const mainEntry = readFileSync(join(root, 'src/main.tsx'), 'utf8')
    const remoteIO = readFileSync(join(root, 'src/cli/remoteIO.ts'), 'utf8')
    const transportUtils = readFileSync(join(root, 'src/cli/transports/transportUtils.ts'), 'utf8')
    const ccrClient = readFileSync(join(root, 'src/cli/transports/ccrClient.ts'), 'utf8')
    const authHandler = readFileSync(join(root, 'src/cli/handlers/auth.ts'), 'utf8')
    const utilHandler = readFileSync(join(root, 'src/cli/handlers/util.tsx'), 'utf8')
    const installGithubCommand = readFileSync(join(root, 'src/commands/install-github-app/index.ts'), 'utf8')
    const installSlackCommand = readFileSync(join(root, 'src/commands/install-slack-app/index.ts'), 'utf8')
    const commandSources = listSourceFiles(join(root, 'src/commands')).map(file => [
      file,
      readFileSync(file, 'utf8'),
    ] as const)
    const visibleStateSources = [
      ...listSourceFiles(join(root, 'src/components')),
      ...listSourceFiles(join(root, 'src/screens')),
      ...listSourceFiles(join(root, 'src/hooks')),
    ].map(file => [file, readFileSync(file, 'utf8')] as const)
    const agentPromptSources = listSourceFiles(join(root, 'src/tools/AgentTool')).map(file => [
      file,
      readFileSync(file, 'utf8'),
    ] as const)
    const providerBoundaryTextSources = [
      'src/utils/agentSwarmsEnabled.ts',
      'src/utils/nativeInstaller/installer.ts',
      'src/utils/nativeInstaller/download.ts',
      'src/utils/nativeInstaller/pidLock.ts',
      'src/utils/shellConfig.ts',
      'src/utils/managedEnvConstants.ts',
      'src/utils/managedEnv.ts',
      'src/utils/envCompat.ts',
      'src/utils/env.ts',
      'src/utils/autoUpdater.ts',
      'src/utils/doctorDiagnostic.ts',
      'src/utils/configProviderMigration.ts',
      'src/utils/cleanup.ts',
      'src/utils/bash/ShellSnapshot.ts',
      'src/utils/Shell.ts',
      'src/utils/desktopMcpImport.ts',
      'src/utils/embeddedTools.ts',
      'src/utils/cronTasksLock.ts',
      'src/utils/cronTasks.ts',
      'src/utils/localInstaller.ts',
      'src/utils/jetbrains.ts',
      'src/utils/markdownConfigLoader.ts',
      'src/utils/user.ts',
      'src/utils/http.ts',
      'src/utils/worktree.ts',
      'src/utils/releaseNotes.ts',
      'src/utils/tmuxSocket.ts',
      'src/utils/subprocessEnv.ts',
      'src/utils/swarm/spawnUtils.ts',
      'src/utils/settings/managedPath.ts',
      'src/utils/settings/constants.ts',
      'src/utils/settings/mdm/constants.ts',
      'src/localRecoveryCli.ts',
      'src/skills/bundled/scheduleRemoteAgents.ts',
      'src/skills/bundled/dsxuApi.ts',
      'src/utils/api.ts',
      'src/utils/authFileDescriptor.ts',
      'src/utils/ide.ts',
      'src/utils/sessionIngressAuth.ts',
      'src/utils/dsxuCodeHints.ts',
      'src/utils/instructionFiles.ts',
      'src/utils/teleport.tsx',
      'src/utils/teammate.ts',
      'src/utils/teleport/api.ts',
      'src/utils/teleport/environments.ts',
      'src/utils/telemetry/bigqueryExporter.ts',
      'src/services/PromptSuggestion/promptSuggestion.ts',
      'src/services/plugins/pluginOperations.ts',
      'src/services/MagicDocs/prompts.ts',
      'src/tools/PowerShellTool/prompt.ts',
      'src/tools/PowerShellTool/powershellPermissions.ts',
      'src/tools/PowerShellTool/pathValidation.ts',
      'src/tools/FileReadTool/limits.ts',
      'src/tools/ScheduleCronTool/prompt.ts',
      'src/tools/REPLTool/constants.ts',
      'src/tools/RemoteTriggerTool/RemoteTriggerTool.ts',
      'src/utils/privacyLevel.ts',
      'src/utils/pdfUtils.ts',
      'src/utils/messages/systemInit.ts',
      'src/utils/sessionStorage.ts',
      'src/utils/tasks.ts',
      'src/utils/teammateMailbox.ts',
      'src/utils/attribution.ts',
      'src/utils/concurrentSessions.ts',
      'src/utils/memoryFileDetection.ts',
      'src/utils/secureStorage/macOsKeychainHelpers.ts',
      'src/utils/toolSearch.ts',
      'src/tools/WebFetchTool/preapproved.ts',
      'src/constants/system.ts',
      'src/QueryEngine.ts',
      'src/coordinator/coordinatorMode.ts',
      'src/utils/hooks.ts',
      'src/utils/sandbox/sandbox-adapter.ts',
      'src/utils/permissions/filesystem.ts',
      'src/utils/settings/types.ts',
      'src/utils/permissions/permissions.ts',
      'src/utils/permissions/permissionRuleParser.ts',
      'src/utils/permissions/PermissionMode.ts',
      'src/utils/permissions/PermissionResult.ts',
      'src/utils/permissions/PermissionRule.ts',
      'src/utils/permissions/PermissionUpdate.ts',
      'src/utils/permissions/PermissionUpdateSchema.ts',
      'src/utils/permissions/permissionsLoader.ts',
      'src/utils/permissions/shellRuleMatching.ts',
      'src/components/LogoV2/DsxuLongContextNotice.tsx',
      'src/components/DiagnosticsDisplay.tsx',
      'src/cli/update.ts',
      'src/entrypoints/dsxu-code.tsx',
      'src/entrypoints/init.ts',
      'src/tools/BashTool/prompt.ts',
      'src/tools/BashTool/bashPermissions.ts',
      'src/tools/BashTool/readOnlyValidation.ts',
      'src/tools/BriefTool/attachments.ts',
      'src/tools/BriefTool/BriefTool.ts',
      'src/tools/BriefTool/upload.ts',
      'src/tools/McpAuthTool/McpAuthTool.ts',
      'src/tools/WorkflowTool/prompt.ts',
      'src/tools/FileWriteTool/FileWriteTool.ts',
      'src/tools/FileEditTool/constants.ts',
      'src/tools/ToolSearchTool/prompt.ts',
      'src/tools/MCPTool/classifyForCollapse.ts',
      'src/tools/shared/spawnMultiAgent.ts',
      'src/utils/telemetry/perfettoTracing.ts',
      'src/dsxu/engine/engine-tool-adapter.ts',
      'src/dsxu/engine/tool-capability-pool.ts',
      'src/dsxu/engine/extended-tools.ts',
      'src/dsxu/engine/api-service.ts',
      'src/dsxu/engine/llm-adapter.ts',
      'src/dsxu/engine/config.ts',
      'src/dsxu/engine/doctor.ts',
      'src/dsxu/engine/adapters/bridge-adapter.ts',
      'src/services/api/bootstrap.ts',
      'src/services/api/adminRequests.ts',
      'src/services/api/client.ts',
      'src/services/api/filesApi.ts',
      'src/services/api/grove.ts',
      'src/services/api/logging.ts',
      'src/services/api/metricsOptOut.ts',
      'src/services/api/overageCreditGrant.ts',
      'src/services/api/referral.ts',
      'src/services/api/ultrareviewQuota.ts',
      'src/services/api/usage.ts',
      'src/services/api/withRetry.ts',
      'src/services/api/dsxuTransport.ts',
      'src/services/remoteManagedSettings/index.ts',
      'src/services/remoteManagedSettings/syncCache.ts',
      'src/services/remoteManagedSettings/syncCacheState.ts',
      'src/services/dsxuLimits.ts',
      'src/services/diagnosticTracking.ts',
      'src/services/mcp/client.ts',
      'src/services/mcp/config.ts',
      'src/services/mcp/auth.ts',
      'src/services/mcp/useManageMCPConnections.ts',
      'src/services/mcp/xaaIdpLogin.ts',
      'src/services/policyLimits/index.ts',
      'src/services/settingsSync/index.ts',
      'src/services/settingsSync/types.ts',
      'src/services/teamMemorySync/index.ts',
      'src/services/analytics/firstPartyEventLogger.ts',
      'src/services/analytics/firstPartyEventLoggingExporter.ts',
      'src/services/analytics/metadata.ts',
      'src/services/tokenEstimation.ts',
      'src/utils/apiPreconnect.ts',
      'src/utils/fastMode.ts',
      'src/utils/model/modelCapabilities.ts',
      'src/utils/model/deprecation.ts',
      'src/utils/model/modelSupportOverrides.ts',
      'src/utils/model/providerMigration/providerMigrationModel.ts',
      'src/utils/model/providerMigration/providerMigrationBetas.ts',
      'src/utils/plugins/addDirPluginSettings.ts',
      'src/utils/plugins/installedPluginsManager.ts',
      'src/utils/plugins/loadPluginAgents.ts',
      'src/utils/plugins/loadPluginCommands.ts',
      'src/utils/plugins/marketplaceManager.ts',
      'src/utils/plugins/mcpPluginIntegration.ts',
      'src/utils/plugins/officialMarketplaceGcs.ts',
      'src/utils/plugins/officialMarketplaceStartupCheck.ts',
      'src/utils/plugins/pluginLoader.ts',
      'src/utils/plugins/pluginOptionsStorage.ts',
      'src/utils/plugins/schemas.ts',
      'src/utils/plugins/validatePlugin.ts',
      'src/utils/plugins/zipCacheAdapters.ts',
      'src/skills/loadSkillsDir.ts',
      'src/utils/sideQuery.ts',
    ]
      .filter(file => existsSync(join(root, file)))
      .map(file => [file, readFileSync(join(root, file), 'utf8')] as const)
    const providerMigrationOnlyCommandIndexes = [
      'src/commands/desktop/index.ts',
      'src/commands/extra-usage/index.ts',
      'src/commands/install-github-app/index.ts',
      'src/commands/install-slack-app/index.ts',
      'src/commands/mobile/index.ts',
      'src/commands/passes/index.ts',
      'src/commands/remote-setup/index.ts',
      'src/commands/stickers/index.ts',
      'src/commands/thinkback/index.ts',
      'src/commands/thinkback-play/index.ts',
      'src/commands/upgrade/index.ts',
      'src/commands/usage/index.ts',
      'src/commands/voice/index.ts',
    ]

    expect(launcher).toContain('export DSXU_CODE_MODE=1')
    expect(launcher).toContain('export DSXU_MODEL_PROVIDER="${DSXU_MODEL_PROVIDER:-deepseek}"')
    expect(launcher).toContain('./bin/dsxu-code "$@"')

    expect(bin).toContain('exec bun --env-file=.env ./src/entrypoints/dsxu-code.tsx "$@"')
    expect(bin).not.toContain('bridgeMain')
    expect(bin).not.toContain('remote-control')

    expect(cli).toContain('DSXU Code default mainline is local coding CLI/TUI')
    expect(cli).toContain('handleDsxuProviderAliasCommand')
    expect(cli).toContain("args[0] === 'remote-control'")
    expect(cli).toContain("args[0] === 'bridge'")
    expect(cli).toContain('archived browser MCP path')
    expect(cli).toContain('--dsxu-browser-mcp')
    expect(cli).not.toContain(['cli_DSXU_BROWSER_PROVIDER', 'mcp_path'].join('_'))

    expect(init).toContain('shouldLoadArchivedServiceShell')
    expect(init).toContain('populateArchivedOAuthAccountInfoIfAllowed')
    expect(init).toContain('initializeRemoteManagedSettingsIfAllowed')
    expect(init).toContain("isEnvTruthy(getDsxuCodeEnv('REMOTE'))")
    expect(init).toContain('DSXU_CODE_REMOTE ignored on the default DSXU local mainline')
    expect(init).toContain('DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1')
    expect(init).toContain('archived upstream proxy shell is disabled')
    expect(init).not.toContain('../upstreamproxy/upstreamproxy.js')
    expect(mainEntry).toContain('function resolveStartupFilesApiBaseUrl()')
    expect(mainEntry).toContain("const dsxuBaseUrl = getDsxuCodeEnv('API_BASE_URL')")
    expect(mainEntry).toContain('if (!shouldLoadArchivedServiceShell()) return undefined')
    expect(mainEntry).toContain('const ARCHIVED_CODE_ENV_PREFIX')
    expect(mainEntry).toContain('const archivedCodeEnv')
    expect(mainEntry).not.toContain(['SOURCE', 'PROVIDER', 'CODE_ENV_PREFIX'].join('_'))
    expect(mainEntry).not.toContain(['source', 'ProviderCodeEnv'].join(''))
    expect(mainEntry).not.toContain('baseUrl: process.env[DSXU_PROVIDER_MIGRATION_BASE_URL_ENV] || getOauthConfig().BASE_API_URL')

    expect(print).toContain("message.request.subtype === 'remote_control'")
    expect(print).toContain('isDsxuRuntimeMode() && !isArchivedServiceShellAllowed()')
    expect(print).toContain("handleDsxuProviderAliasCommand")
    expect(print).toContain(
      "../services/bridge/dsxuRemoteBridgeFacade.js",
    )
    expect(print).not.toContain('src/bridge/')
    expect(print).not.toContain('initReplBridge.js')
    expect(print).not.toContain('inboundMessages.js')
    expect(print).not.toContain('bridgeStatusUtil.js')
    expect(print).not.toContain('inboundAttachments.js')

    for (const source of [remoteIO, transportUtils, ccrClient]) {
      expect(source).toContain('ARCHIVED_CODE_ENV_PREFIX')
      expect(source).not.toContain(['SOURCE', 'PROVIDER', 'CODE_ENV_PREFIX'].join('_'))
      expect(source).not.toContain(['source', 'ProviderCodeEnv'].join(''))
    }
    expect(remoteIO).toContain('DSXU_CODE_ENVIRONMENT_RUNNER_VERSION ??')
    expect(remoteIO).toContain("archivedCodeEnv('ENVIRONMENT_RUNNER_VERSION')")
    expect(remoteIO).toContain('archived transport fallback')
    expect(transportUtils).toContain('DSXU_CODE_USE_CCR_V2 ??')
    expect(transportUtils).toContain("archivedCodeEnv('USE_CCR_V2')")
    expect(ccrClient).toContain('ARCHIVED_SOURCE_TOKEN')
    expect(ccrClient).toContain('archived worker epoch env accepted only for migration')
    expect(ccrClient).toContain('DSXU_CODE_WORKER_EPOCH ??')
    expect(authHandler).toContain('ARCHIVED_SOURCE_API_KEY_ENV')
    expect(authHandler).toContain('archived source API key env')
    expect(authHandler).not.toContain(['SOURCE', 'PROVIDER', 'API_KEY_ENV'].join('_'))
    expect(utilHandler).toContain('archived cloud setup-token flow is isolated')
    expect(utilHandler).not.toContain(['leg', 'acy setup-token'].join(''))
    expect(installGithubCommand).toContain('Archived GitHub App setup')
    expect(installGithubCommand).toContain('!isDsxuRuntimeMode()')
    expect(installSlackCommand).toContain('Archived Slack app setup')
    expect(installSlackCommand).toContain('!isDsxuRuntimeMode()')
    for (const commandIndexPath of providerMigrationOnlyCommandIndexes) {
      const source = readFileSync(join(root, commandIndexPath), 'utf8')
      expect(source, commandIndexPath).toContain('isDsxuRuntimeMode')
      expect(source, commandIndexPath).toMatch(
        /!isDsxuRuntimeMode\(\)|if \(isDsxuRuntimeMode\(\)\) \{\s*return false\s*\}/,
      )
    }

    for (const [file, source] of commandSources) {
      expect(source, file).not.toContain('V14 command lifecycle shim')
      expect(source, file).not.toMatch(/\bprocess[A-Za-z0-9]+CommandLifecycle\b/)
      expect(source, file).not.toMatch(/\brun[A-Za-z0-9]+Command\b/)
      expect(source, file).not.toContain(['source', 'provider'].join('-'))
      expect(source, file).not.toContain(['Source', 'provider'].join('-'))
      expect(source, file).not.toContain(['Source', 'Provider'].join('-'))
      expect(source, file).not.toContain('DSXU Code on the web')
      expect(source, file).not.toContain(['Backward', 'compatible'].join('-'))
      expect(source, file).not.toContain(['backwards', 'compatibility'].join(' '))
    }

    for (const [file, source] of visibleStateSources) {
      expect(source, file).not.toContain(['source', 'provider'].join('-'))
      expect(source, file).not.toContain(['Source', 'provider'].join('-'))
      expect(source, file).not.toContain(['Source', 'Provider'].join('-'))
    }

    for (const [file, source] of [
      ...agentPromptSources,
      ...providerBoundaryTextSources,
    ]) {
      expect(source, file).not.toContain(['source', 'provider'].join('-'))
      expect(source, file).not.toContain(['Source', 'provider'].join('-'))
      expect(source, file).not.toContain(['Source', 'Provider'].join('-'))
      expect(source, file).not.toContain('V18 lifecycle shim')
      expect(source, file).not.toContain('DSXU Code on the web')
    }
    const retiredBridgeAdapterPath = join(root, 'src/dsxu/engine/adapters/bridge-adapter.ts')
    if (existsSync(retiredBridgeAdapterPath)) {
      const retiredBridgeAdapter = readFileSync(retiredBridgeAdapterPath, 'utf8')
      expect(retiredBridgeAdapter).toContain('Retired adapter tombstone')
      expect(retiredBridgeAdapter).toContain('external-tool-adapter.ts')
      expect(retiredBridgeAdapter).not.toContain('class BridgeAdapter')
      expect(retiredBridgeAdapter).not.toContain('BridgeToolErrorType')
    }
    const retiredBuiltinsModule = ['builtin', 'tools'].join('-')
    const retiredFallbackFields = [
      ['allowMainlineTool', 'Fallback'].join(''),
      ['execution', 'Fallback'].join(''),
      ['fallback', 'Tool'].join(''),
    ]
    expect(existsSync(join(root, 'src/dsxu/engine', `${retiredBuiltinsModule}.ts`))).toBe(false)
    expect(existsSync(join(root, 'src/dsxu/engine/__tests__', `${retiredBuiltinsModule}.test.ts`))).toBe(false)
    const engineToolAdapter = readFileSync(
      join(root, 'src/dsxu/engine/engine-tool-adapter.ts'),
      'utf8',
    )
    for (const field of retiredFallbackFields) {
      expect(engineToolAdapter).not.toContain(field)
    }
    expect(engineToolAdapter).not.toContain(`from './${retiredBuiltinsModule}'`)
    expect(engineToolAdapter).not.toContain('isRecoverableRuntimeDependencyError')
    expect(engineToolAdapter).not.toContain('command not found/i')
    const toolCapabilityPool = readFileSync(
      join(root, 'src/dsxu/engine/tool-capability-pool.ts'),
      'utf8',
    )
    expect(toolCapabilityPool).not.toContain(retiredBuiltinsModule)
    expect(toolCapabilityPool).not.toContain(['getCore', 'Tools'].join(''))
    expect(toolCapabilityPool).not.toContain(['getReadOnly', 'Tools'].join(''))
    const extendedTools = readFileSync(
      join(root, 'src/dsxu/engine/extended-tools.ts'),
      'utf8',
    )
    expect(extendedTools).not.toContain(`require('./${retiredBuiltinsModule}')`)
    expect(extendedTools).not.toContain(`...${['getCore', 'Tools'].join('')}()`)
    const engineIndex = readFileSync(join(root, 'src/dsxu/engine/index.ts'), 'utf8')
    expect(engineIndex).toContain("this.registerCapabilityPools('full_absorb')")
    expect(engineIndex).not.toContain('this.registerTools(getAllTools())')
    expect(engineIndex).not.toContain(`from './${retiredBuiltinsModule}'`)
    const apiService = readFileSync(join(root, 'src/dsxu/engine/api-service.ts'), 'utf8')
    expect(apiService).toContain('External and local providers are explicit')
    expect(apiService).toContain('oaiKey && isOpenAIFallbackAllowed(config)')
    expect(apiService).toContain('if (isOllamaFallbackAllowed(config))')
    expect(apiService).toContain('DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS')
    expect(apiService).not.toContain('OpenAI backup -> Ollama local fallback')
    const llmAdapter = readFileSync(join(root, 'src/dsxu/engine/llm-adapter.ts'), 'utf8')
    expect(llmAdapter).toContain('const apiService = new APIService(options?.api)')
    expect(llmAdapter).toContain('apiService.getStatus().length > 0')
    expect(llmAdapter).toContain('options?.allowProxyFallback === true')
    expect(llmAdapter).toContain('DSXU_ALLOW_PROVIDER_MIGRATION_PROXY_FALLBACK')
    expect(llmAdapter).toContain('createUnconfiguredLLMCall')
    expect(llmAdapter).not.toContain('options?.allowProxyFallback ?? true')
    expect(llmAdapter).not.toContain('OPENAI_API_KEY, or DSXU_OLLAMA_URL')
    const apiClient = readFileSync(join(root, 'src/services/api/client.ts'), 'utf8')
    expect(apiClient).toContain('function shouldUseDsxuDeepSeekClient()')
    expect(apiClient).toContain('isDSXUCodeMode() || !isArchivedServiceShellAllowed()')
    expect(apiClient).toContain('if (shouldUseDsxuDeepSeekClient())')
    expect(apiClient).toContain('DSXU_ALLOW_PROVIDER_MIGRATION_SERVICE_SHELL=1')
    expect(apiClient.indexOf('if (shouldUseDsxuDeepSeekClient())')).toBeLessThan(
      apiClient.indexOf('return new ProviderClient'),
    )
    const localRecoveryCli = readFileSync(join(root, 'src/localRecoveryCli.ts'), 'utf8')
    expect(localRecoveryCli).toContain('function createDeepSeekRecoveryClient')
    expect(localRecoveryCli).toContain('/chat/completions')
    expect(localRecoveryCli).toContain('deepseek-v4-flash')
    expect(localRecoveryCli).not.toContain('ProviderClient')
    expect(localRecoveryCli).not.toContain('ANTHROPIC')
    expect(localRecoveryCli).not.toContain('@anthropic-ai/sdk')
    const retrySource = readFileSync(join(root, 'src/services/api/withRetry.ts'), 'utf8')
    expect(retrySource).toContain('function isPrimaryModelFallbackAllowed(model: string)')
    expect(retrySource).toContain('DSXU_ALLOW_PROVIDER_MODEL_FALLBACKS')
    expect(retrySource).toContain("isDsxuCodeEnvTruthy('ALLOW_PROVIDER_MODEL_FALLBACKS')")
    expect(retrySource).toContain('if (!isArchivedServiceShellAllowed())')
    expect(retrySource).toContain('isPrimaryModelFallbackAllowed(options.model)')
    const dsxuTransport = readFileSync(join(root, 'src/services/api/dsxuTransport.ts'), 'utf8')
    expect(dsxuTransport).toContain('function hasStartedStreamingToolState')
    expect(dsxuTransport).toContain('hasToolStateBeforeFallback')
    expect(dsxuTransport).toContain('tool_state_started')
    expect(dsxuTransport).toContain('hasToolStateBeforeFallback ||')
    const filesApi = readFileSync(join(root, 'src/services/api/filesApi.ts'), 'utf8')
    expect(filesApi).toContain('function isArchivedFilesApiAllowed()')
    expect(filesApi).toContain('function resolveFilesApiBaseUrl(config: FilesApiConfig)')
    expect(filesApi).toContain('Configure DSXU_CODE_API_BASE_URL or pass FilesApiConfig.baseUrl')
    expect(filesApi).not.toContain('DEFAULT_PROVIDER_FILES_API_BASE_URL')
    expect(filesApi).not.toContain('Falls back to public API for standalone usage')
    const metricsOptOut = readFileSync(join(root, 'src/services/api/metricsOptOut.ts'), 'utf8')
    expect(metricsOptOut).toContain('function shouldUseArchivedMetricsOptOut()')
    expect(metricsOptOut).toContain('if (!shouldUseArchivedMetricsOptOut())')
    const apiLogging = readFileSync(join(root, 'src/services/api/logging.ts'), 'utf8')
    expect(apiLogging).toContain('function getArchivedEnvMetadata()')
    expect(apiLogging).toContain('isDsxuRuntimeMode() && !isArchivedServiceShellAllowed()')
    expect(apiLogging).not.toContain('function getProviderEnvMetadata()')
    const apiPreconnect = readFileSync(join(root, 'src/utils/apiPreconnect.ts'), 'utf8')
    expect(apiPreconnect).toContain('isDsxuRuntimeMode() && !isArchivedServiceShellAllowed()')
    const remoteManagedSettingsSync = readFileSync(
      join(root, 'src/services/remoteManagedSettings/syncCache.ts'),
      'utf8',
    )
    expect(remoteManagedSettingsSync).toContain('DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_SETTINGS')
    expect(remoteManagedSettingsSync).toContain('archived remote managed settings are disabled in DSXU runtime')
    const settingsSync = readFileSync(join(root, 'src/services/settingsSync/index.ts'), 'utf8')
    expect(settingsSync).toContain('function isArchivedSettingsSyncAllowed()')
    expect(settingsSync).toContain('!isArchivedSettingsSyncAllowed()')
    const teamMemorySync = readFileSync(join(root, 'src/services/teamMemorySync/index.ts'), 'utf8')
    expect(teamMemorySync).toContain('function isDsxuTeamMemorySyncConfigured()')
    expect(teamMemorySync).toContain('!isArchivedServiceShellAllowed()')
    const fastMode = readFileSync(join(root, 'src/utils/fastMode.ts'), 'utf8')
    expect(fastMode).toContain('function isArchivedFastModeBackendAllowed()')
    expect(fastMode).toContain('if (!isArchivedFastModeBackendAllowed())')
    for (const accountApiPath of [
      'src/services/api/adminRequests.ts',
      'src/services/api/grove.ts',
      'src/services/api/overageCreditGrant.ts',
      'src/services/api/referral.ts',
      'src/services/api/ultrareviewQuota.ts',
      'src/services/api/usage.ts',
    ]) {
      const accountApiSource = readFileSync(join(root, accountApiPath), 'utf8')
      expect(accountApiSource, accountApiPath).toContain('isArchivedServiceShellAllowed')
      expect(accountApiSource, accountApiPath).toContain('isDsxuRuntimeMode')
    }
  })

  test('maps provider-migration shell aliases to the DSXU provider contract block result', async () => {
    expect(isDsxuProviderAliasCommand('remote-control')).toBe(true)
    expect(isDsxuProviderAliasCommand('bridge')).toBe(true)
    expect(isDsxuProviderAliasCommand('chat')).toBe(false)

    const result = await handleDsxuProviderAliasCommand('bridge', {
      cwd: process.cwd(),
      sessionId: 'provider-alias-test',
    })

    expect(result?.handled).toBe(true)
    expect(result?.exitCode).toBe(1)
    expect(result?.message).toContain('blocked in the default local coding mainline')
    expect(result?.message).toContain('Remote session status: blocked')
    expect(result?.message).toContain('DSXU-owned remote session backend')
    expect(result?.events).toHaveLength(1)
    expect(result?.events[0]).toMatchObject({
      type: 'remote_blocked',
      sessionId: 'provider-alias-test',
    })
  })

  test('DSXU local provider backend records events, task sync, permission decisions, and credential vault redaction', async () => {
    const backend = createDsxuLocalProviderBackend({
      permissionCallback: async request => ({
        behavior: request.toolName === 'Read' ? 'allow' : 'deny',
        updatedInput: request.input,
        message: 'DSXU remote service permission callback',
      }),
    })

    backend.provider.emitEvent({
      type: 'session_started',
      sessionId: 'remote-service-test',
      timestamp: 1,
    })
    backend.provider.emitEvent({
      type: 'tool_started',
      sessionId: 'remote-service-test',
      toolName: 'Read',
      timestamp: 2,
    })
    backend.provider.emitEvent({
      type: 'tool_finished',
      sessionId: 'remote-service-test',
      toolName: 'Read',
      timestamp: 3,
      ok: true,
    })
    backend.synchronizeTask({
      type: 'task_synchronized',
      sessionId: 'remote-service-test',
      taskId: 'task-v8-provider',
      status: 'completed',
      timestamp: 4,
    })

    const permission = await backend.provider.requestPermission({
      sessionId: 'remote-service-test',
      toolName: 'Read',
      input: { file_path: 'README.md' },
      permission: { behavior: 'ask' },
    })

    backend.vault.put('mcp:github', 'authorization', 'Bearer provider-secret-token')
    backend.vault.put('mcp:github', 'apiKey', 'sk-provider-vault-secret')
    const filtered = backend.vault.filterForModel({
      authorization: backend.vault.get('mcp:github', 'authorization'),
      apiKey: backend.vault.get('mcp:github', 'apiKey'),
      visible: 'safe',
    })

    expect(permission.behavior).toBe('allow')
    expect(permission.message).toContain('DSXU remote service permission callback')
    expect(backend.events.readAll()).toEqual([
      { type: 'session_started', sessionId: 'remote-service-test', timestamp: 1 },
      { type: 'tool_started', sessionId: 'remote-service-test', toolName: 'Read', timestamp: 2 },
      { type: 'tool_finished', sessionId: 'remote-service-test', toolName: 'Read', timestamp: 3, ok: true },
      { type: 'task_synchronized', sessionId: 'remote-service-test', taskId: 'task-v8-provider', status: 'completed', timestamp: 4 },
    ])
    expect(filtered).toEqual({
      authorization: '[REDACTED]',
      apiKey: '[REDACTED]',
      visible: 'safe',
    })
    expect(backend.vault.snapshotRedacted()).toEqual({
      'mcp:github': {
        authorization: '[REDACTED]',
        apiKey: '[REDACTED]',
      },
    })
  })

  test('DSXU local provider backend owns remote sessions and peer messages without bridge shell', async () => {
    const backend = createDsxuLocalProviderBackend()
    const remote = await backend.createRemoteSession({
      sessionId: 'provider-peer-target',
      cwd: process.cwd(),
      metadata: { source: 'test' },
    })

    const sent = backend.postPeerMessage({
      fromSessionId: 'provider-peer-source',
      targetSessionId: 'provider-peer-target',
      message: 'continue with verifier evidence',
      summary: 'verifier continuation',
    })

    expect(remote).toEqual({
      sessionId: 'provider-peer-target',
      status: 'connected',
    })
    expect(sent.ok).toBe(true)
    expect(backend.readPeerMessages('provider-peer-target')).toMatchObject([
      {
        fromSessionId: 'provider-peer-source',
        targetSessionId: 'provider-peer-target',
        message: 'continue with verifier evidence',
        summary: 'verifier continuation',
      },
    ])
    expect(backend.events.readAll().map(event => event.type)).toEqual([
      'session_started',
      'peer_message_sent',
    ])
  })

  test('SendMessage routes provider: peers through DSXU provider backend by default', async () => {
    expect(getSendMessagePrompt()).toContain('provider:session_')

    const result = await SendMessageTool.call(
      {
        to: 'provider:send-message-provider-test',
        summary: 'provider verifier',
        message: 'continue only after verifier evidence',
      },
      { getAppState: () => ({}) } as never,
      undefined as never,
      undefined as never,
    )

    expect(result.data.success).toBe(true)
    expect(result.data.message).toContain('provider:send-message-provider-test')
    expect(
      getDefaultDsxuLocalProviderBackend().readPeerMessages(
        'send-message-provider-test',
      ),
    ).toContainEqual(
      expect.objectContaining({
        targetSessionId: 'send-message-provider-test',
        message: 'continue only after verifier evidence',
        summary: 'provider verifier',
      }),
    )
  })

  test('DSXU remote session manager replaces old remote WebSocket manager on default path', async () => {
    const backend = createDsxuLocalProviderBackend()
    const received: unknown[] = []
    const connected: string[] = []
    const disconnected: string[] = []
    const reconnecting: string[] = []
    const manager = new DsxuRemoteSessionCoordinator(
      createRemoteSessionConfig(
        'dsxu-remote-manager-test',
        () => 'unused-local-provider-token',
        'local-org',
      ),
      {
        onMessage: message => received.push(message),
        onPermissionRequest: () => {},
        onConnected: () => connected.push('connected'),
        onDisconnected: () => disconnected.push('disconnected'),
        onReconnecting: () => reconnecting.push('reconnecting'),
      },
      backend,
    )

    manager.connect()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(manager.isConnected()).toBe(true)
    expect(connected).toEqual(['connected'])
    expect(received).toContainEqual(
      expect.objectContaining({
        type: 'system',
        subtype: 'init',
        provider: 'dsxu',
      }),
    )

    const sent = await manager.sendMessage('continue via DSXU provider', {
      uuid: 'provider-manager-uuid',
    })
    expect(sent).toBe(true)
    expect(backend.readPeerMessages('dsxu-remote-manager-test')).toContainEqual(
      expect.objectContaining({
        targetSessionId: 'dsxu-remote-manager-test',
        message: 'continue via DSXU provider',
      }),
    )
    expect(received).toContainEqual(
      expect.objectContaining({
        type: 'user',
        uuid: 'provider-manager-uuid',
      }),
    )

    manager.cancelSession()
    expect(backend.events.readAll()).toContainEqual(
      expect.objectContaining({
        type: 'task_synchronized',
        sessionId: 'dsxu-remote-manager-test',
        status: 'failed',
      }),
    )

    manager.reconnect()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(reconnecting).toEqual(['reconnecting'])
    expect(manager.isConnected()).toBe(true)

    manager.disconnect()
    expect(manager.isConnected()).toBe(false)
    expect(disconnected).toEqual(['disconnected'])
  })

  test('default source imports DSXU remote manager instead of old src/remote manager', () => {
    const root = process.cwd()
    const useRemoteSession = readFileSync(
      join(root, 'src/hooks/useRemoteSession.ts'),
      'utf8',
    )
    const repl = readFileSync(join(root, 'src/screens/REPL.tsx'), 'utf8')
    const main = readFileSync(join(root, 'src/main.tsx'), 'utf8')
    const directConnect = readFileSync(
      join(root, 'src/hooks/useDirectConnect.ts'),
      'utf8',
    )

    for (const source of [useRemoteSession, repl, main, directConnect]) {
      expect(source).not.toContain('../remote/DsxuRemoteSessionCoordinator.js')
      expect(source).not.toContain('./remote/DsxuRemoteSessionCoordinator.js')
    }
    expect(useRemoteSession).toContain(
      '../services/bridge/dsxuRemoteSessionCoordinator.js',
    )
    expect(repl).toContain(
      '../services/bridge/dsxuRemoteSessionCoordinator.js',
    )
    expect(main).toContain(
      './services/bridge/dsxuRemoteSessionCoordinator.js',
    )
    expect(directConnect).toContain(
      '../services/bridge/dsxuRemoteSessionCoordinator.js',
    )
  })
})
