export type ToolSideEffect = 'none' | 'file_read' | 'file_write' | 'process' | 'network' | 'workspace_state'
export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ToolLifecycleState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'recovered'

export interface ToolCapabilityContract {
  capabilityId: string
  sourceSemantics: string
  inputSchema: Record<string, any>
  outputSchema: Record<string, any>
  sideEffects: ToolSideEffect[]
  permissionModel: {
    riskLevel: ToolRiskLevel
    requiresHumanApproval: boolean
    workspaceBound: boolean
  }
  errorCodes: string[]
  auditFields: string[]
  lifecycle: ToolLifecycleState[]
  executorBinding: 'native' | 'mcp' | 'openhands' | 'external'
  mainlineDispatch: 'dsxu-tool-mainline'
}

export class ToolCapabilityRegistry {
  private contracts = new Map<string, ToolCapabilityContract>()

  register(contract: ToolCapabilityContract): ToolCapabilityContract {
    if (!contract.capabilityId.trim()) {
      throw new Error('capabilityId is required')
    }
    if (contract.mainlineDispatch !== 'dsxu-tool-mainline') {
      throw new Error('tool capability must dispatch through DSXU mainline')
    }
    this.contracts.set(contract.capabilityId, contract)
    return contract
  }

  get(capabilityId: string): ToolCapabilityContract | undefined {
    return this.contracts.get(capabilityId)
  }

  list(): ToolCapabilityContract[] {
    return [...this.contracts.values()]
  }

  assertComplete(capabilityId: string): ToolCapabilityContract {
    const contract = this.contracts.get(capabilityId)
    if (!contract) throw new Error(`missing tool capability contract: ${capabilityId}`)
    const requiredAuditFields = ['sessionId', 'taskId', 'runId', 'toolCallId', 'duration', 'failureCode']
    for (const field of requiredAuditFields) {
      if (!contract.auditFields.includes(field)) {
        throw new Error(`tool capability ${capabilityId} missing audit field: ${field}`)
      }
    }
    if (!contract.lifecycle.includes('queued') || !contract.lifecycle.includes('succeeded') || !contract.lifecycle.includes('failed')) {
      throw new Error(`tool capability ${capabilityId} missing lifecycle states`)
    }
    return contract
  }
}

export function createToolCapabilityRegistry(): ToolCapabilityRegistry {
  return new ToolCapabilityRegistry()
}
