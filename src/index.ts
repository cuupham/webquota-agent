import 'dotenv/config';
import { readConfig } from './config.js';
import { ChatGPTWebAdapter } from './adapters/chatgpt-web.js';
import { createApp } from './server.js';

async function main(): Promise<void> {
  const config = readConfig();
  const adapter = new ChatGPTWebAdapter(config);
  await adapter.start();

  const app = createApp(config, adapter);
  const server = app.listen(config.port, config.host, () => {
    console.log('WebQuota Agent listening at http://' + config.host + ':' + config.port);
    console.log('Sign in manually in the dedicated browser window. Keep the profile and API key private.');
  });

  const shutdown = async () => {
    server.close();
    await adapter.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
