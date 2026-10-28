import { randomUUID } from 'node:crypto';
import type { NormalizedToolCall, ParsedAssistantResponse, ToolDefinition } from './types.js';

function removeFence(value: string): string {
  const trimmed = value.trim();
  const fence = String.fromCharCode(96).repeat(3);
  if (!trimmed.startsWith(fence)) return trimmed;
  const firstNewline = trimmed.indexOf('\n');
  const lastFence = trimmed.lastIndexOf(fence);
  if (firstNewline < 0 || lastFence <= firstNewline) return trimmed;
  return trimmed.slice(firstNewline + 1, lastFence).trim();
}

function parseJsonObject(text: string): unknown {
  const normalized = removeFence(text);
  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    const first = normalized.indexOf('{');
    const last = normalized.lastIndexOf('}');
    if (first < 0 || last <= first) throw new Error('No JSON object in assistant response.');
    return JSON.parse(normalized.slice(first, last + 1)) as unknown;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAssistantResponse(raw: string, toolDefinitions: ToolDefinition[] = []): ParsedAssistantResponse {
  let data: unknown;
  try {
    data = parseJsonObject(raw);
  } catch {
    return { kind: 'final', content: raw.trim() };
  }
  if (!isRecord(data)) return { kind: 'final', content: raw.trim() };

  if (data.type === 'final' && typeof data.content === 'string') {
    return { kind: 'final', content: data.content };
  }
  if (data.type !== 'tool_calls' || !Array.isArray(data.tool_calls)) {
    return { kind: 'final', content: raw.trim() };
  }

  const allowed = new Set(toolDefinitions.map((tool) => tool.function.name));
  const calls: NormalizedToolCall[] = [];
  for (const item of data.tool_calls) {
    if (!isRecord(item) || typeof item.name !== 'string' || !isRecord(item.arguments)) {
      return { kind: 'final', content: 'WebQuota rejected a malformed tool call. The model must return a tool name and an object-valued arguments field.' };
    }
    if (!allowed.has(item.name)) {
      return { kind: 'final', content: 'WebQuota rejected an unknown tool name: ' + item.name };
    }
    calls.push({
      id: 'call_' + randomUUID().replaceAll('-', '').slice(0, 24),
      type: 'function',
      function: { name: item.name, arguments: JSON.stringify(item.arguments) },
    });
  }

  if (calls.length === 0) return { kind: 'final', content: 'WebQuota received an empty tool-call list and stopped safely.' };
  return { kind: 'tool_calls', toolCalls: calls };
}
