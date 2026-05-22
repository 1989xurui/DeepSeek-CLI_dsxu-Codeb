import { describe, expect, test } from 'bun:test'
import { getDsxuRemoteBridgeFacadeRuntimeProfile } from '../../../services/bridge/dsxuRemoteBridgeFacade'
import { getDsxuRemoteSessionCoordinatorRuntimeProfile } from '../../../services/bridge/dsxuRemoteSessionCoordinator'
import { getDsxuBrowserProviderRuntimeProfile } from '../../../utils/dsxuBrowserProvider/common'
import { getDsxuDesktopMcpImportRuntimeProfile } from '../../../utils/desktopMcpImport'
import { getDsxuTeleportRuntimeProfile } from '../../../utils/teleport'
import { getDsxuRemoteTriggerRuntimeProfile } from '../../../tools/RemoteTriggerTool/RemoteTriggerTool'
import { getDsxuRemoteTriggerPromptRuntimeProfile } from '../../../tools/RemoteTriggerTool/prompt'

describe('V20 external integration owner evidence', () => {
  test('keeps bridge, browser, desktop MCP, teleport, and remote trigger as adapter boundaries', () => {
    const bridge = getDsxuRemoteBridgeFacadeRuntimeProfile()
    const coordinator = getDsxuRemoteSessionCoordinatorRuntimeProfile()
    const browser = getDsxuBrowserProviderRuntimeProfile()
    const desktopMcp = getDsxuDesktopMcpImportRuntimeProfile()
    const teleport = getDsxuTeleportRuntimeProfile()
    const remoteTrigger = getDsxuRemoteTriggerRuntimeProfile()
    const remoteTriggerPrompt = getDsxuRemoteTriggerPromptRuntimeProfile()

    expect(bridge.owner).toBe('DSXU Control Plane Adapter Boundary')
    expect(coordinator.owner).toBe('DSXU Control Plane Adapter Boundary')
    expect(browser.owner).toBe('DSXU MCP / Browser Adapter Boundary')
    expect(desktopMcp.owner).toBe('DSXU MCP Config Intake Boundary')
    expect(teleport.owner).toBe('DSXU Remote Session Adapter Boundary')
    expect(remoteTrigger.runtime).toBe('DSXU Remote Session Provider')
    expect(remoteTriggerPrompt.runtime).toBe('DSXU Remote Trigger Prompt')

    expect(bridge.releaseRiskControls).toContain(
      'remote bridge facade is not a second Query Loop',
    )
    expect(browser.releaseRiskControls).toContain(
      'browser provider is an MCP adapter, not a standalone browser automation runtime',
    )
    expect(desktopMcp.releaseRiskControls).toContain(
      'desktop MCP import is config intake, not MCP connection ownership',
    )
    expect(teleport.releaseRiskControls).toContain(
      'teleport is a remote session adapter, not a second local Agent orchestrator',
    )
    expect(remoteTrigger.providerMigrationIsolation).toContain(
      'DSXU_ENABLE_PROVIDER_MIGRATION_REMOTE_TRIGGER gates provider-migration remote trigger calls',
    )
  })
})
