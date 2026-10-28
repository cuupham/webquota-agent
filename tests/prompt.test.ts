import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowserPrompt, estimateTokens } from '../src/core/prompt.js';

test('prompt includes messages and tool contract', () => {
  const prompt = buildBrowserPrompt([
    { role: 'system', content: 'Be concise.' },
    { role: 'user', content: 'Read a file.' },
    { role: 'tool', name: 'read_file', tool_call_id: 'call_1', content: 'file data' },
  ], [{
    type: 'function',
    function: { name: 'read_file', description: 'Read workspace file', parameters: { type: 'object' } },
  }]);
  assert.match(prompt, /Be concise/);
  assert.match(prompt, /Read a file/);
  assert.match(prompt, /file data/);
  assert.match(prompt, /read_file/);
});

test('token estimate is positive and explicitly approximate', () => {
  assert.equal(estimateTokens(''), 1);
  assert.equal(estimateTokens('12345678'), 2);
});
