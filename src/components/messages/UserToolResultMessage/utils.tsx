import { c as _c } from "react/compiler-runtime";
import type { ToolResultBlockParam } from 'src/types/providerSdk.js';
import type { ToolUseBlockParam } from 'src/types/providerSdk.js';
import { useMemo } from 'react';
import { findToolByName, type Tool, type Tools } from '../../../Tool.js';
import type { buildMessageLookups } from '../../../utils/messages.js';

export type DsxuToolResultCompactCard = {
  text: string
  color?: string
  dimColor?: boolean
}

const COMPACT_CARD_MIN_CHARS = 600
const COMPACT_CARD_MIN_LINES = 8
const MAX_CONTENT_INSPECT_CHARS = 20_000
const MAX_TOOL_NAME_CHARS = 48

function countLines(content: string): number {
  if (!content) return 0
  let lines = 1
  for (const char of content) {
    if (char === '\n') lines++
  }
  return lines
}

function truncateLabel(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}...` : value
}

function compactArtifactLabel(content: string): string | undefined {
  const match = content.match(
    /\b(?:artifact|outputFile|output_file|tracePath|logPath|reportPath)\s*[=:]\s*["']?([^\s"',;]+)/i,
  )
  const rawPath = match?.[1]
  if (!rawPath) return undefined
  const parts = rawPath.split(/[\\/]+/).filter(Boolean)
  return truncateLabel(parts.slice(-2).join('/'), 36)
}

function stringifyToolResultContent(content: ToolResultBlockParam['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        if ((item as { type?: unknown }).type === 'image') return '[image]'
        const text = (item as { text?: unknown }).text
        if (typeof text === 'string') return text
      }
      const encoded = JSON.stringify(item) ?? String(item)
      return encoded.length > 300 ? `${encoded.slice(0, 300)}...` : encoded
    }).join('\n')
  }
  return content === undefined || content === null ? '' : String(content)
}

export function buildDsxuToolResultCompactCard(input: {
  param: ToolResultBlockParam
  toolName: string
}): DsxuToolResultCompactCard | null {
  const content = stringifyToolResultContent(input.param.content).slice(0, MAX_CONTENT_INSPECT_CHARS)
  if (!content && !input.param.is_error) return null
  const outputChars = content.length
  const outputLines = countLines(content)
  const toolState = content.match(/DSXU tool state:\s*([a-z0-9_:-]+)/i)?.[1]
  const artifactLabel = compactArtifactLabel(content)
  const hasArtifact =
    /\b(artifact|outputFile|output_file|tracePath|logPath|reportPath)\b/i.test(content)
  const hasCanonical =
    /\b(schemaVersion|ToolCallResult|canonicalToolResult|dsxu\.runtime-event\.v1)\b/i.test(content)
  const isLarge = outputChars >= COMPACT_CARD_MIN_CHARS || outputLines >= COMPACT_CARD_MIN_LINES
  if (!input.param.is_error && !toolState && !hasCanonical && !hasArtifact && !isLarge) {
    return null
  }
  const status = input.param.is_error ? 'error' : 'ok'
  const facts = [
    `Tool result: ${truncateLabel(input.toolName, MAX_TOOL_NAME_CHARS)}`,
    `status=${status}`,
    `chars=${outputChars}`,
    outputLines ? `lines=${outputLines}` : undefined,
    isLarge ? 'compact=yes' : undefined,
    toolState ? `state=${toolState}` : undefined,
    hasCanonical ? 'canonical=yes' : undefined,
    artifactLabel ? `artifact=${artifactLabel}` : hasArtifact ? 'artifact=yes' : undefined,
  ].filter(Boolean)
  return {
    text: facts.join(' | '),
    color: input.param.is_error ? 'red' : undefined,
    dimColor: !input.param.is_error,
  }
}

export function useGetToolFromMessages(toolUseID, tools, lookups) {
  const $ = _c(7);
  let t0;
  if ($[0] !== lookups.toolUseByToolUseID || $[1] !== toolUseID || $[2] !== tools) {
    bb0: {
      const toolUse = lookups.toolUseByToolUseID.get(toolUseID);
      if (!toolUse) {
        t0 = null;
        break bb0;
      }
      const tool = findToolByName(tools, toolUse.name);
      if (!tool) {
        t0 = null;
        break bb0;
      }
      let t1;
      if ($[4] !== tool || $[5] !== toolUse) {
        t1 = {
          tool,
          toolUse
        };
        $[4] = tool;
        $[5] = toolUse;
        $[6] = t1;
      } else {
        t1 = $[6];
      }
      t0 = t1;
    }
    $[0] = lookups.toolUseByToolUseID;
    $[1] = toolUseID;
    $[2] = tools;
    $[3] = t0;
  } else {
    t0 = $[3];
  }
  return t0;
}
