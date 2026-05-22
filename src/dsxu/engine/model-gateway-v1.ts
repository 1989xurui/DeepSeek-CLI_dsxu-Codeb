import { checkBudgetUsage, createBudgetForContextWindow } from './context-budget-v1'
import { getModelCapability, routeModel } from './model-capability-v1'

export type ModelGatewayState = {
  currentModel: string
  sessionState: string
  contextUsage: {
    totalTokens: number
    workingSet: number
    stablePrefix: number
    memoryBundle: number
    evidenceBundle: number
  }
}

export function createModelGateway(options?: {
  defaultModel?: string
  enableBudgetAwareness?: boolean
  enableSessionAwareness?: boolean
}) {
  const initialModel = options?.defaultModel ?? 'deepseek-chat'
  const state: ModelGatewayState = {
    currentModel: initialModel,
    sessionState: 'idle',
    contextUsage: {
      totalTokens: 0,
      workingSet: 0,
      stablePrefix: 0,
      memoryBundle: 0,
      evidenceBundle: 0,
    },
  }

  return {
    updateSessionState(nextState: string) {
      state.sessionState = nextState
    },
    updateContextUsage(deltaTokens: number, detail?: Partial<ModelGatewayState['contextUsage']>) {
      state.contextUsage.totalTokens = Math.max(0, state.contextUsage.totalTokens + deltaTokens)
      if (detail) {
        state.contextUsage = {
          ...state.contextUsage,
          ...detail,
          totalTokens: state.contextUsage.totalTokens,
        }
      }
    },
    checkBoundary(input: {
      taskType?: string
      requiredContext?: number
      requiresTools?: boolean
      requiresLongThinking?: boolean
      budgetConstraint?: 'low' | 'medium' | 'high'
      sessionState?: string
    }) {
      const capability = getModelCapability(state.currentModel)
      const budget = createBudgetForContextWindow(capability.model, capability.contextWindow)
      const projectedTokens =
        state.contextUsage.totalTokens + Math.max(0, input.requiredContext ?? 0)
      const usage = checkBudgetUsage(projectedTokens, budget)
      const routed = routeModel(input)
      const shouldSwitchModel =
        usage.riskLevel === 'high' && routed.model !== capability.model
      const suggestedAction =
        shouldSwitchModel
          ? 'switch_model'
          : usage.suggestedAction === 'switch_model'
            ? 'compact'
            : usage.suggestedAction

      return {
        passed: usage.riskLevel !== 'high',
        result: {
          usage,
          currentModel: state.currentModel,
          routedModel: routed.model,
          suggestedAction,
        },
      }
    },
    getState(): ModelGatewayState {
      return {
        currentModel: state.currentModel,
        sessionState: state.sessionState,
        contextUsage: { ...state.contextUsage },
      }
    },
  }
}
