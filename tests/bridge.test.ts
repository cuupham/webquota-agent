import test from 'node:test';
import assert from 'node:assert/strict';
import { ChromeExtensionBridge } from '../src/adapters/chrome-extension-bridge.js';
import type { AppConfig } from '../src/config.js';

function config(timeout = 1_000): AppConfig {
  return {
    apiKey: 'a'.repeat(48),
    host: '127.0.0.1',
    port: 4153,
    responseTimeoutMs: timeout,
    maxPromptChars: 80_000,
  };
}

test('dispatches a queued prompt to the extension and resolves the waiting request', async () => {
  const bridge = new ChromeExtensionBridge(config());
  const poll = bridge.nextJob(1_000);
  const response = bridge.complete('prompt-from-client');
  const job = await poll;
  assert.ok(job);
  assert.equal(job.prompt, 'prompt-from-client');
  assert.equal(bridge.submitResult(job.id, true, 'reply-from-chatgpt'), true);
  assert.equal(await response, 'reply-from-chatgpt');
  await bridge.close();
});

test('rejects a result for a job that does not exist', () => {
  const bridge = new ChromeExtensionBridge(config());
  assert.equal(bridge.submitResult('missing-job', true, 'ignored'), false);
});

test('times out if the extension does not return a result', async () => {
  const bridge = new ChromeExtensionBridge(config(80));
  const poll = bridge.nextJob(500);
  const response = bridge.complete('never-completed');
  const job = await poll;
  assert.ok(job);
  await assert.rejects(response, /Timed out waiting for ChatGPT Web/);
  assert.equal(bridge.submitResult(job.id, true, 'too late'), false);
  await bridge.close();
});
