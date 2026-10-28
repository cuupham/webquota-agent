export interface AppConfig {
  apiKey: string;
  host: string;
  port: number;
  responseTimeoutMs: number;
  maxPromptChars: number;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(name + ' must be a positive integer.');
  }
  return value;
}

export function readConfig(): AppConfig {
  const apiKey = process.env.WEBQUOTA_API_KEY?.trim() ?? '';
  if (apiKey.length < 32 || apiKey.startsWith('replace-with-')) {
    throw new Error('Set WEBQUOTA_API_KEY in .env to a random secret of at least 32 characters before starting the gateway.');
  }

  const host = process.env.WEBQUOTA_HOST?.trim() || '127.0.0.1';
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    throw new Error('For safety, WEBQUOTA_HOST must be a loopback address (127.0.0.1, localhost, or ::1).');
  }

  return {
    apiKey,
    host,
    port: positiveInt('WEBQUOTA_PORT', 4153),
    responseTimeoutMs: positiveInt('WEBQUOTA_RESPONSE_TIMEOUT_MS', 180_000),
    maxPromptChars: positiveInt('WEBQUOTA_MAX_PROMPT_CHARS', 80_000),
  };
}
