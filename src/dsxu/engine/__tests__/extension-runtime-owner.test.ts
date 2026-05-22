import { describe, expect, test } from 'bun:test'
import { getDsxuMcpConfigRuntimeProfile } from '../../../services/mcp/config'
import { getDsxuOfficialMcpRegistryRuntimeProfile } from '../../../services/mcp/officialRegistry'
import { getDsxuBundledSkillsRuntimeProfile } from '../../../skills/bundledSkills'
import { getDsxuSkillsLoaderRuntimeProfile } from '../../../skills/loadSkillsDir'
import { getDsxuPluginCommandRuntimeProfile } from '../../../utils/plugins/loadPluginCommands'
import { getDsxuPluginLoaderRuntimeProfile } from '../../../utils/plugins/pluginLoader'
import { getDsxuPluginMcpRuntimeProfile } from '../../../utils/plugins/mcpPluginIntegration'
import { getDsxuPluginRefreshRuntimeProfile } from '../../../utils/plugins/refresh'

describe('V20 extension runtime owner evidence', () => {
  test('keeps MCP, skills, and plugins as adapter boundaries under named DSXU owners', () => {
    const mcpConfig = getDsxuMcpConfigRuntimeProfile()
    const mcpRegistry = getDsxuOfficialMcpRegistryRuntimeProfile()
    const skillsLoader = getDsxuSkillsLoaderRuntimeProfile()
    const bundledSkills = getDsxuBundledSkillsRuntimeProfile()
    const pluginLoader = getDsxuPluginLoaderRuntimeProfile()
    const pluginRefresh = getDsxuPluginRefreshRuntimeProfile()
    const pluginMcp = getDsxuPluginMcpRuntimeProfile()
    const pluginCommands = getDsxuPluginCommandRuntimeProfile()

    expect(mcpConfig.runtime).toBe('DSXU MCP Config')
    expect(mcpConfig.activationEvidence).toContain(
      'DSXU default mode returns getDsxuCodeMcpConfigs without loading archived discovery',
    )
    expect(mcpRegistry.runtime).toBe('DSXU Official MCP Registry')
    expect(skillsLoader.runtime).toBe('DSXU Skills Loader')
    expect(bundledSkills.runtime).toBe('DSXU Bundled Skills Registry')

    expect(pluginLoader.owner).toBe('DSXU Plugin Runtime')
    expect(pluginRefresh.owner).toBe('DSXU Plugin Runtime')
    expect(pluginMcp.owner).toBe('DSXU MCP / Plugin Adapter Boundary')
    expect(pluginCommands.owner).toBe('DSXU Plugin Runtime')

    expect(pluginMcp.releaseRiskControls).toContain(
      'plugin MCP is adapter input, not a standalone MCP runtime',
    )
    expect(pluginRefresh.releaseRiskControls).toContain(
      'plugin refresh does not create a second MCP runtime',
    )
    expect(pluginCommands.releaseRiskControls).toContain(
      'plugin commands are prompt/command components, not a separate query loop',
    )
  })
})
