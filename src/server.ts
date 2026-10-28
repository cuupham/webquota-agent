import { randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { AppConfig } from './config.js';
import { ChromeExtensionBridge } from './adapters/chrome-extension-bridge.js';
import { buildBrowserPrompt, estimateTokens } from './core/prompt.js';
import { parseAssistantResponse } from './core/tool-protocol.js';
import type { ChatCompletionRequest, ToolDefinition } from './core/types.js';

const MODEL_ID = 'webquota-chatgpt-free';

function equalSecret(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authenticate(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header('authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match || !equalSecret(match[1]!, config.apiKey)) {
      res.status(401).json({ error: { message: 'Missing or invalid Bearer token.', type: 'authentication_error' } });
      return;
    }
    next();
  };
}

function requestShape(value: unknown): value is ChatCompletionRequest {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.messages) && data.messages.every((item) =>
    item && typeof item === 'object' && typeof (item as Record<string, unknown>).role === 'string');
}

function getToolDefinitions(value: unknown): ToolDefinition[] {
  if (!Array.isArray(value)) return [];
  const output: ToolDefinition[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (record.type !== 'function' || !record.function || typeof record.function !== 'object') continue;
    const fn = record.function as Record<string, unknown>;
    if (typeof fn.name !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(fn.name)) continue;
    output.push({
      type: 'function',
      function: {
        name: fn.name,
        description: typeof fn.description === 'string' ? fn.description.slice(0, 2_000) : undefined,
        parameters: fn.parameters && typeof fn.parameters === 'object'
          ? fn.parameters as Record<string, unknown>
          : { type: 'object', properties: {} },
      },
    });
  }
  return output;
}

function makeChunk(id: string, model: string, delta: Record<string, unknown>, finishReason: string | null) {
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
}

async function sendSse(res: Response, id: string, model: string, parsed: ReturnType<typeof parseAssistantResponse>): Promise<void> {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const emit = (payload: unknown) => res.write('data: ' + JSON.stringify(payload) + '\n\n');
  emit(makeChunk(id, model, { role: 'assistant' }, null));
  if (parsed.kind === 'tool_calls') {
    for (let i = 0; i < parsed.toolCalls.length; i += 1) {
      const call = parsed.toolCalls[i]!;
      emit(makeChunk(id, model, {
        tool_calls: [{
          index: i,
          id: call.id,
          type: 'function',
          function: { name: call.function.name, arguments: call.function.arguments },
        }],
      }, null));
    }
    emit(makeChunk(id, model, {}, 'tool_calls'));
  } else {
    for (let start = 0; start < parsed.content.length; start += 64) {
      emit(makeChunk(id, model, { content: parsed.content.slice(start, start + 64) }, null));
    }
    emit(makeChunk(id, model, {}, 'stop'));
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

export function createApp(config: AppConfig, bridge: ChromeExtensionBridge) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb', strict: true }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'webquota-agent',
      version: '0.2.0',
      bridge: bridge.status(),
    });
  });

  app.get('/bridge/next', authenticate(config), async (req, res, next) => {
    try {
      const parsedWait = Number.parseInt(String(req.query.waitMs ?? '20000'), 10);
      const waitMs = Number.isFinite(parsedWait) ? Math.max(0, Math.min(parsedWait, 25_000)) : 20_000;
      const job = await bridge.nextJob(waitMs);
      res.setHeader('Cache-Control', 'no-store');
      if (!job) {
        res.status(204).end();
        return;
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  app.post('/bridge/result', authenticate(config), (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body.id !== 'string' || typeof body.success !== 'boolean') {
      res.status(400).json({ error: { message: 'Expected id (string) and success (boolean).', type: 'invalid_request_error' } });
      return;
    }
    if (body.success && typeof body.text !== 'string') {
      res.status(400).json({ error: { message: 'A successful result must include text (string).', type: 'invalid_request_error' } });
      return;
    }
    const accepted = bridge.submitResult(
      body.id,
      body.success,
      typeof body.text === 'string' ? body.text.slice(0, 250_000) : '',
      typeof body.error === 'string' ? body.error.slice(0, 4_000) : '',
    );
    if (!accepted) {
      res.status(404).json({ error: { message: 'Unknown, expired, or already completed bridge job.', type: 'invalid_request_error' } });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/v1/models', authenticate(config), (_req, res) => {
    res.json({
      object: 'list',
      data: [{ id: MODEL_ID, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'webquota-agent' }],
    });
  });

  app.post('/v1/chat/completions', authenticate(config), async (req, res, next) => {
    try {
      if (!requestShape(req.body)) {
        res.status(400).json({ error: { message: 'Request must contain a messages array with role fields.', type: 'invalid_request_error' } });
        return;
      }
      const body = req.body;
      const tools = getToolDefinitions(body.tools);
      const prompt = buildBrowserPrompt(body.messages, tools);
      if (prompt.length > config.maxPromptChars) {
        res.status(413).json({
          error: {
            message: 'Prompt is ' + prompt.length + ' characters; configured maximum is ' + config.maxPromptChars + '.',
            type: 'context_length_exceeded',
          },
        });
        return;
      }

      const raw = await bridge.complete(prompt);
      const parsed = parseAssistantResponse(raw, tools);
      const message = parsed.kind === 'tool_calls'
        ? { role: 'assistant', content: null, tool_calls: parsed.toolCalls }
        : { role: 'assistant', content: parsed.content };
      const id = 'chatcmpl-' + randomUUID().replaceAll('-', '');
      const requestedModel = typeof body.model === 'string' ? body.model : MODEL_ID;
      const promptTokens = estimateTokens(prompt);
      const completionText = parsed.kind === 'final' ? parsed.content : JSON.stringify(parsed.toolCalls);
      const completionTokens = estimateTokens(completionText);
      const usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens };

      if (body.stream === true) {
        await sendSse(res, id, requestedModel, parsed);
        return;
      }
      res.json({
        id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: requestedModel,
        choices: [{
          index: 0,
          message,
          finish_reason: parsed.kind === 'tool_calls' ? 'tool_calls' : 'stop',
        }],
        usage,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    const isSyntaxError = error instanceof SyntaxError;
    const status = isSyntaxError ? 400 : (message.includes('Prompt is') ? 413 : 502);
    res.status(status).json({
      error: {
        message: isSyntaxError ? 'Invalid JSON request body.' : message,
        type: status === 413 ? 'context_length_exceeded' : (status === 400 ? 'invalid_request_error' : 'upstream_error'),
      },
    });
  });

  return app;
}
