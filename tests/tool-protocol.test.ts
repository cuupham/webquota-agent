import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssistantResponse } from '../src/core/tool-protocol.js';
import type { ToolDefinition } from '../src/core/types.js';

const tools: ToolDefinition[] = [{
  type: 'function',
  function: { name: 'read_file', parameters: { type: 'object', properties: { path: { type: 'string' } } } },
}];

test('parses a final answer', () => {
  assert.deepEqual(
    parseAssistantResponse('{"type":"final","content":"done"}', tools),
    { kind: 'final', content: 'done' },
  );
});

test('parses allowed tool calls into OpenAI format', () => {
  const parsed = parseAssistantResponse(
    '{"type":"tool_calls","tool_calls":[{"name":"read_file","arguments":{"path":"README.md"}}]}',
    tools,
  );
  assert.equal(parsed.kind, 'tool_calls');
  if (parsed.kind === 'tool_calls') {
    assert.equal(parsed.toolCalls[0]?.function.name, 'read_file');
    assert.deepEqual(JSON.parse(parsed.toolCalls[0]!.function.arguments), { path: 'README.md' });
    assert.match(parsed.toolCalls[0]!.id, /^call_/);
  }
});

test('rejects unknown tool names', () => {
  const parsed = parseAssistantResponse(
    '{"type":"tool_calls","tool_calls":[{"name":"delete_everything","arguments":{}}]}',
    tools,
  );
  assert.equal(parsed.kind, 'final');
  if (parsed.kind === 'final') assert.match(parsed.content, /unknown tool name/);
});

test('rejects malformed arguments safely', () => {
  const parsed = parseAssistantResponse(
    '{"type":"tool_calls","tool_calls":[{"name":"read_file","arguments":"not an object"}]}',
    tools,
  );
  assert.equal(parsed.kind, 'final');
});

test('falls back to plain text when not JSON', () => {
  assert.deepEqual(
    parseAssistantResponse('The answer is 42.', tools),
    { kind: 'final', content: 'The answer is 42.' },
  );
});
