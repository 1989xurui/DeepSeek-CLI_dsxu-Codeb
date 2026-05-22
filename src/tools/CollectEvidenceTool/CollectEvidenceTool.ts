import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { collectEvidenceFromVerificationEvents } from '../../dsxu/engine/semantic-tools.js'
import { extractSemanticVerificationEventsFromMessages } from '../RunNativeTestTool/semanticVerificationMessages.js'

export const COLLECT_EVIDENCE_TOOL_NAME = 'CollectEvidence'

const inputSchema = lazySchema(() =>
  z.strictObject({
    scope: z
      .string()
      .optional()
      .describe('Short scope label for the evidence being collected.'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    scope: z.string(),
    status: z.enum(['PASS', 'FAIL', 'PARTIAL']),
    rawCommandCount: z.number(),
    uniqueCommandCount: z.number(),
    repeatedCommandCount: z.number(),
    evidenceDigest: z.string(),
    latestSummary: z.string(),
    warningCount: z.number(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
type Output = z.infer<OutputSchema>

export const CollectEvidenceTool = buildTool({
  name: COLLECT_EVIDENCE_TOOL_NAME,
  searchHint: 'summarize latest verification evidence',
  maxResultSizeChars: 30_000,
  runtimeMetadata: {
    owner: 'DSXU Evidence Collector',
    sideEffects: [
      'transcript-evidence-read',
      'verification-summary-projection',
    ],
    permission: 'read-only evidence summary; cannot replace required verification',
    evidence: [
      'semantic verification events',
      'rawCommandCount/uniqueCommandCount output',
      'evidenceDigest output',
      'warningCount output',
    ],
    uiProjection: 'verification evidence digest and next action',
  },
  async description() {
    return 'Collect concise verification evidence after native test runs'
  },
  async prompt() {
    return [
      'Use CollectEvidence after RunNativeTest or shell verification has produced enough evidence.',
      'Do not use it to replace a required test. It only summarizes existing verification results.',
      'Call CollectEvidence before the final answer/PASS marker, not after it.',
      'After CollectEvidence reports PASS and no planned edits remain, finish instead of running more tools.',
    ].join('\n')
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isEnabled() {
    return isEnvTruthy(process.env.DSXU_SEMANTIC_TOOLS_ENABLED)
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  isOpenWorld() {
    return false
  },
  userFacingName() {
    return COLLECT_EVIDENCE_TOOL_NAME
  },
  renderToolUseMessage() {
    return 'CollectEvidence'
  },
  async call(input, context) {
    const evidence = collectEvidenceFromVerificationEvents(
      extractSemanticVerificationEventsFromMessages(context.messages),
    )
    const latest = evidence.latestVerification
    return {
      data: {
        scope: input.scope ?? 'verification',
        status: evidence.status,
        rawCommandCount: evidence.rawCommandCount,
        uniqueCommandCount: evidence.uniqueCommandCount,
        repeatedCommandCount: evidence.repeatedCommandCount,
        evidenceDigest: evidence.evidenceDigest,
        latestSummary: latest
          ? `${latest.kind} exit=${latest.exitCode ?? 'unknown'} signal=${latest.outputSignal}`
          : 'no verification evidence found',
        warningCount: evidence.warnings.length,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const out = content as Output
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: [
        `CollectEvidence status: ${out.status}`,
        `scope=${out.scope}`,
        `rawCommandCount=${out.rawCommandCount}`,
        `uniqueCommandCount=${out.uniqueCommandCount}`,
        `repeatedCommandCount=${out.repeatedCommandCount}`,
        `evidenceDigest=${out.evidenceDigest}`,
        `latest=${out.latestSummary}`,
        `warningCount=${out.warningCount}`,
        `DSXU tool state: evidence_collected; semanticTool=CollectEvidence; next=${out.status === 'PASS' ? 'final_answer' : 'repair_or_report_partial'}.`,
      ].join('\n'),
    }
  },
} satisfies ToolDef<InputSchema, Output>)
