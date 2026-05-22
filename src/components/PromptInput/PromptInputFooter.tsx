import { feature } from 'bun:bundle';
import * as React from 'react';
import { memo, type ReactNode, useMemo, useRef } from 'react';
import { isBridgeEnabled, getBridgeStatus } from '../../services/bridge/dsxuRemoteBridgeFacade.js';
import { useSetPromptOverlay } from '../../context/promptOverlayContext.js';
import type { VerificationStatus } from '../../hooks/useApiKeyVerification.js';
import type { IDESelection } from '../../hooks/useIdeSelection.js';
import { useSettings } from '../../hooks/useSettings.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, Text } from '../../ink.js';
import type { MCPServerConnection } from '../../services/mcp/types.js';
import { useAppState } from '../../state/AppState.js';
import type { DsxuTrustState } from '../../state/AppStateStore.js';
import type { ToolPermissionContext } from '../../Tool.js';
import type { Message } from '../../types/message.js';
import type { PromptInputMode, VimMode } from '../../types/textInputTypes.js';
import type { AutoUpdaterResult } from '../../utils/autoUpdater.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import { isUndercover } from '../../utils/undercover.js';
import { CoordinatorTaskPanel, useCoordinatorTaskCount } from '../CoordinatorAgentStatus.js';
import { getLastAssistantMessageId, StatusLine, statusLineShouldDisplay } from '../StatusLine.js';
import { Notifications } from './Notifications.js';
import { PromptInputFooterLeftSide } from './PromptInputFooterLeftSide.js';
import { PromptInputFooterSuggestions, type SuggestionItem } from './PromptInputFooterSuggestions.js';
import { PromptInputHelpMenu } from './PromptInputHelpMenu.js';
type Props = {
  apiKeyStatus: VerificationStatus;
  debug: boolean;
  exitMessage: {
    show: boolean;
    key?: string;
  };
  vimMode: VimMode | undefined;
  mode: PromptInputMode;
  autoUpdaterResult: AutoUpdaterResult | null;
  isAutoUpdating: boolean;
  verbose: boolean;
  onAutoUpdaterResult: (result: AutoUpdaterResult) => void;
  onChangeIsUpdating: (isUpdating: boolean) => void;
  suggestions: SuggestionItem[];
  selectedSuggestion: number;
  maxColumnWidth?: number;
  toolPermissionContext: ToolPermissionContext;
  helpOpen: boolean;
  suppressHint: boolean;
  isLoading: boolean;
  tasksSelected: boolean;
  teamsSelected: boolean;
  bridgeSelected: boolean;
  tmuxSelected: boolean;
  teammateFooterIndex?: number;
  ideSelection: IDESelection | undefined;
  mcpClients?: MCPServerConnection[];
  isPasting?: boolean;
  isInputWrapped?: boolean;
  messages: Message[];
  isSearching: boolean;
  historyQuery: string;
  setHistoryQuery: (query: string) => void;
  historyFailedMatch: boolean;
  onOpenTasksDialog?: (taskId?: string) => void;
};

export type DsxuTrustStatusLine = {
  text: string;
  color?: string;
  dimColor?: boolean;
};

function shortModelName(model: string | undefined): string {
  if (!model) return 'model?';
  if (/flash/i.test(model) && /pro/i.test(model)) return 'Flash/Pro';
  if (/pro/i.test(model)) return 'Pro';
  if (/flash/i.test(model)) return 'Flash';
  return model.replace(/^deepseek[-_]?/i, '');
}

function shortTrustAction(action: string | undefined): string {
  if (!action || action === 'none') return 'idle';
  return action
    .replace(/^final_answer$/, 'final')
    .replace(/^visible_final_answer_or_next_user_task$/, 'idle')
    .replace(/^verify$/, 'verify')
    .replace(/^run_or_report_post_mutation_verification$/, 'verify')
    .replace(/^iteration_start$/, 'start')
    .replace(/^source_repair$/, 'repair')
    .replace(/^read_source_truth$/, 'source')
    .replace(/^permission_safe_replan$/, 'permission')
    .replace(/^agent_evidence_or_partial$/, 'agent-evidence')
    .replace(/^narrow_discovery$/, 'narrow')
    .replace(/^wait_for_mutation_result$/, 'wait-mutation');
}

function shortTrustList(items: readonly string[] | undefined, max = 2): string {
  const unique = [...new Set(items ?? [])].filter(Boolean);
  if (!unique.length) return 'none';
  const head = unique.slice(0, max).join(',');
  const remaining = unique.length - max;
  return remaining > 0 ? `${head}+${remaining}` : head;
}

function shortVerificationState(state: string): string {
  return state
    .replace(/^not_run$/, 'wait')
    .replace(/^blocked$/, 'block')
    .replace(/^fail$/, 'fail')
    .replace(/^pass$/, 'pass');
}

function shortProAdmissionState(state: string | undefined): string | undefined {
  if (!state || state === 'not_required') return undefined;
  return state
    .replace(/^requires_approval$/, 'approval')
    .replace(/^blocked_missing_evidence$/, 'blocked')
    .replace(/^admitted$/, 'admit');
}

export function compactDsxuTrustLine(text: string, maxChars = 120): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 4)).trimEnd()}...`;
}

export function buildDsxuTrustStatusLine(
  state: DsxuTrustState | undefined,
): DsxuTrustStatusLine | null {
  if (!state) return null;

  const route = state.route;
  const verify = state.verification.state;
  const agentHasRisk = state.agent?.incompleteEvidence || Boolean(state.agent?.failedCount);
  const next = shortTrustAction(state.finalClaim.nextAction || state.recovery.requiredAction);
  const proAdmission = shortProAdmissionState(route?.proAdmissionState);
  const text = compactDsxuTrustLine([
    `DSXU: ${shortModelName(route?.model)}`,
    `check:${shortVerificationState(verify)}`,
    proAdmission ? `pro:${proAdmission}` : undefined,
    state.finalClaim.allowed ? undefined : 'claim:block',
    next === 'idle' || next === 'final' || next === 'start' ? undefined : `next:${next}`,
    route?.estimatedCostUsd === undefined ? undefined : `$${route.estimatedCostUsd.toFixed(4)}`,
    route?.cacheHitRatePct === undefined ? undefined : `cache:${route.cacheHitRatePct.toFixed(0)}%`,
    state.agent && state.agent.activeCount > 0
      ? `agent:${state.agent.activeCount}${agentHasRisk ? ':risk' : ''}`
      : undefined,
    state.health?.status && state.health.status !== 'ok' ? `health:${state.health.status}` : undefined,
  ].filter(Boolean).join(' | '));

  if (verify === 'fail' || state.health?.status === 'stalled') {
    return { text, color: 'red' };
  }
  if (!state.finalClaim.allowed || verify === 'blocked' || state.health?.status === 'blocked') {
    return { text, color: 'yellow' };
  }
  if (verify === 'pass') {
    return { text, color: 'green' };
  }
  return { text, dimColor: true };
}

export function buildDsxuTrustPanelLines(
  state: DsxuTrustState | undefined,
): DsxuTrustStatusLine[] {
  const status = buildDsxuTrustStatusLine(state);
  if (!state || !status) return [];

  const lines: DsxuTrustStatusLine[] = [status];
  if (state.ledger) {
    const ledger = state.ledger;
    const next = shortTrustAction(ledger.nextAction);
    const isIdleLedger = ledger.state === 'iteration_start' &&
      !ledger.isResumable &&
      !ledger.stall &&
      (ledger.eventCount === undefined || ledger.eventCount <= 1) &&
      (next === 'idle' || next === 'start');
    if (!isIdleLedger) {
      const parts = [
        `task:${ledger.state}`,
        ledger.eventCount !== undefined ? `events:${ledger.eventCount}` : undefined,
        ledger.activeFrame ? `frame:${ledger.activeFrame.phase}` : undefined,
        ledger.activeFrame ? `risk:${ledger.activeFrame.risk}` : undefined,
        ledger.activeFrame && ledger.activeFrame.openObligationCount > 0
          ? `open:${ledger.activeFrame.openObligationCount}`
          : undefined,
        ledger.activeFrame && ledger.activeFrame.guardCount > 0
          ? `frameReview:${ledger.activeFrame.guardCount}`
          : undefined,
        ledger.isResumable ? `resume:${ledger.resumePoint ?? ledger.state}` : undefined,
        ledger.stall ? `stall:${ledger.stall}` : undefined,
        next === 'idle' || next === 'start' ? undefined : `next:${next}`,
      ].filter(Boolean);
      lines.push({
        text: compactDsxuTrustLine(parts.join(' | ')),
        color: ledger.stall ? 'yellow' : undefined,
        dimColor: !ledger.stall,
      });
    }
  }
  if (
    state.agent &&
    (state.agent.activeCount > 0 ||
      (state.agent.runningCount !== undefined && state.agent.runningCount > 0) ||
      Boolean(state.agent.failedCount) ||
      state.agent.incompleteEvidence ||
      Boolean(state.agent.risk && state.agent.risk !== 'none'))
  ) {
    const agent = state.agent;
    const agentHasRisk = agent.incompleteEvidence || Boolean(agent.failedCount);
    const parts = [
      `agent:${agent.activeCount}`,
      agent.runningCount !== undefined ? `running:${agent.runningCount}` : undefined,
      agent.failedCount ? `failed:${agent.failedCount}` : undefined,
      agent.scopes?.length ? `scope:${agent.scopes.join(',')}` : undefined,
      agent.risk && agent.risk !== 'none' ? `risk:${agent.risk}` : undefined,
      agent.verification && agentHasRisk ? `verify:${agent.verification}` : undefined,
    ].filter(Boolean);
    lines.push({
      text: compactDsxuTrustLine(parts.join(' | ')),
      color: agentHasRisk ? 'yellow' : undefined,
      dimColor: !agentHasRisk,
    });
  }
  if (state.proof?.contract || state.proof?.tool || state.proof?.runtime) {
    const parts = [];
    const contract = state.proof.contract;
    const tool = state.proof.tool;
    const runtime = state.proof.runtime;
    if (contract) {
      const shortTask = contract.taskType
        .replace('single_file_edit', 'edit')
        .replace('multi_file_refactor', 'refactor')
      const shortModel = contract.model.replace(/^deepseek-v4-/, '')
      parts.push(
        `contract ${contract.status === 'ready' ? 'ok' : 'review'} ${shortTask}/${shortModel}`,
      );
    }
    if (tool) {
      const missing = tool.status === 'ready'
        ? ''
        : ` missing:${shortTrustList(tool.missingConsumers)}`;
      parts.push(`tool ${tool.status === 'ready' ? 'ok' : 'review'} ${tool.readyConsumers}/${tool.requiredConsumers}${missing}`);
    }
    if (runtime) {
      const missing = runtime.status === 'ready'
        ? ''
        : ` missing:${shortTrustList(runtime.missingKinds)}`;
      parts.push(`event ${runtime.status === 'ready' ? 'ok' : 'review'} ${runtime.presentKinds}/${runtime.requiredKinds}${missing}`);
    }
    if (parts.length) {
      const needsReview = contract?.status === 'review' || tool?.status === 'review' || runtime?.status === 'review';
      lines.push({
        text: compactDsxuTrustLine(`proof:${parts.join(' | ')}`),
        color: needsReview ? 'yellow' : undefined,
        dimColor: !needsReview,
      });
    }
  }
  return lines;
}

export function limitDsxuTrustFooterLines(
  lines: readonly DsxuTrustStatusLine[],
  layout: { columns: number; rows: number; fullscreen: boolean },
): DsxuTrustStatusLine[] {
  if (lines.length <= 1) return [...lines];
  const maxLines =
    layout.fullscreen && layout.rows < 24
      ? 1
      : layout.columns < 80 || layout.rows < 28
        ? 2
        : layout.fullscreen && layout.columns >= 118 && layout.rows >= 30
          ? 4
        : 3;
  return lines.slice(0, maxLines);
}

function PromptInputFooter({
  apiKeyStatus,
  debug,
  exitMessage,
  vimMode,
  mode,
  autoUpdaterResult,
  isAutoUpdating,
  verbose,
  onAutoUpdaterResult,
  onChangeIsUpdating,
  suggestions,
  selectedSuggestion,
  maxColumnWidth,
  toolPermissionContext,
  helpOpen,
  suppressHint: suppressHintFromProps,
  isLoading,
  tasksSelected,
  teamsSelected,
  bridgeSelected,
  tmuxSelected,
  teammateFooterIndex,
  ideSelection,
  mcpClients,
  isPasting = false,
  isInputWrapped = false,
  messages,
  isSearching,
  historyQuery,
  setHistoryQuery,
  historyFailedMatch,
  onOpenTasksDialog
}: Props): ReactNode {
  const settings = useSettings();
  const {
    columns,
    rows
  } = useTerminalSize();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const lastAssistantMessageId = useMemo(() => getLastAssistantMessageId(messages), [messages]);
  const isNarrow = columns < 80;
  // In fullscreen the bottom slot is flexShrink:0, so every row here is a row
  // stolen from the ScrollBox. Drop the optional StatusLine first. Non-fullscreen
  // has terminal scrollback to absorb overflow, so we never hide StatusLine there.
  const isFullscreen = isFullscreenEnvEnabled();
  const isShort = isFullscreen && rows < 24;

  // Pill highlights when tasks is the active footer item AND no specific
  // agent row is selected. When coordinatorTaskIndex >= 0 the pointer has
  // moved into CoordinatorTaskPanel, so the pill should un-highlight.
  // coordinatorTaskCount === 0 covers the bash-only case (no agent rows
  // exist, pill is the only selectable item).
  const coordinatorTaskCount = useCoordinatorTaskCount();
  const coordinatorTaskIndex = useAppState(s => s.coordinatorTaskIndex);
  const dsxuTrustState = useAppState(s => s.dsxuTrustState);
  const dsxuTrustLines = limitDsxuTrustFooterLines(
    buildDsxuTrustPanelLines(dsxuTrustState),
    { columns, rows, fullscreen: isFullscreen },
  );
  const pillSelected = tasksSelected && (coordinatorTaskCount === 0 || coordinatorTaskIndex < 0);

  // Hide `? for shortcuts` if the user has a custom status line, or during ctrl-r
  const suppressHint = suppressHintFromProps || statusLineShouldDisplay(settings) || isSearching;
  // Fullscreen: portal data to FullscreenLayout — see promptOverlayContext.tsx
  const overlayData = useMemo(() => isFullscreen && suggestions.length ? {
    suggestions,
    selectedSuggestion,
    maxColumnWidth
  } : null, [isFullscreen, suggestions, selectedSuggestion, maxColumnWidth]);
  useSetPromptOverlay(overlayData);
  if (suggestions.length && !isFullscreen) {
    return <Box paddingX={2} paddingY={0}>
        <PromptInputFooterSuggestions suggestions={suggestions} selectedSuggestion={selectedSuggestion} maxColumnWidth={maxColumnWidth} />
      </Box>;
  }
  if (helpOpen) {
    return <PromptInputHelpMenu dimColor={true} fixedWidth={true} paddingX={2} />;
  }
  return <>
      <Box flexDirection={isNarrow ? 'column' : 'row'} justifyContent={isNarrow ? 'flex-start' : 'space-between'} paddingX={2} gap={isNarrow ? 0 : 1}>
        <Box flexDirection="column" flexShrink={isNarrow ? 0 : 1}>
          {mode === 'prompt' && !isShort && !exitMessage.show && !isPasting && statusLineShouldDisplay(settings) && <StatusLine messagesRef={messagesRef} lastAssistantMessageId={lastAssistantMessageId} vimMode={vimMode} />}
          <PromptInputFooterLeftSide exitMessage={exitMessage} vimMode={vimMode} mode={mode} toolPermissionContext={toolPermissionContext} suppressHint={suppressHint} isLoading={isLoading} tasksSelected={pillSelected} teamsSelected={teamsSelected} teammateFooterIndex={teammateFooterIndex} tmuxSelected={tmuxSelected} isPasting={isPasting} isSearching={isSearching} historyQuery={historyQuery} setHistoryQuery={setHistoryQuery} historyFailedMatch={historyFailedMatch} onOpenTasksDialog={onOpenTasksDialog} />
        </Box>
        <Box flexShrink={1} gap={0} flexDirection="column" alignItems="flex-start">
          {mode === 'prompt' && !exitMessage.show && !isPasting && dsxuTrustLines.map((line, index) => <Text key={index} color={line.color} dimColor={line.dimColor} wrap="truncate">{line.text}</Text>)}
          {isFullscreen ? null : <Notifications apiKeyStatus={apiKeyStatus} autoUpdaterResult={autoUpdaterResult} debug={debug} isAutoUpdating={isAutoUpdating} verbose={verbose} messages={messages} onAutoUpdaterResult={onAutoUpdaterResult} onChangeIsUpdating={onChangeIsUpdating} ideSelection={ideSelection} mcpClients={mcpClients} isInputWrapped={isInputWrapped} isNarrow={isNarrow} />}
          {false && isUndercover() && <Text dimColor>undercover</Text>}
          <BridgeStatusIndicator bridgeSelected={bridgeSelected} />
        </Box>
      </Box>
      {false && <CoordinatorTaskPanel />}
    </>;
}
export default memo(PromptInputFooter);
type BridgeStatusProps = {
  bridgeSelected: boolean;
};
function BridgeStatusIndicator({
  bridgeSelected
}: BridgeStatusProps): React.ReactNode {
  if (!feature('BRIDGE_MODE')) return null;

  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const enabled = useAppState(s => s.replBridgeEnabled);
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const connected = useAppState(s_0 => s_0.replBridgeConnected);
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const sessionActive = useAppState(s_1 => s_1.replBridgeSessionActive);
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const reconnecting = useAppState(s_2 => s_2.replBridgeReconnecting);
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  const explicit = useAppState(s_3 => s_3.replBridgeExplicit);

  // Failed state is surfaced via notification (useReplBridge), not a footer pill.
  if (!isBridgeEnabled() || !enabled) return null;
  const status = getBridgeStatus({
    error: undefined,
    connected,
    sessionActive,
    reconnecting
  });

  // For implicit (config-driven) remote, only show the reconnecting state
  if (!explicit && status.label !== 'Remote Control reconnecting') {
    return null;
  }
  return <Text color={bridgeSelected ? 'background' : status.color} inverse={bridgeSelected} wrap="truncate">
      {status.label}
      {bridgeSelected && <Text dimColor> · Enter to view</Text>}
    </Text>;
}
