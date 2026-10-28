import 'dotenv/config';
import { readConfig } from './config.js';
import { ChromeExtensionBridge } from './adapters/chrome-extension-bridge.js';
import { createApp } from './server.js';

async function main(): Promise<void> {
  const config = readConfig();
  const bridge = new ChromeExtensionBridge(config);
  const app = createApp(config, bridge);
  const server = app.listen(config.port, config.host, () => {
    console.log('WebQuota Agent API listening at http://' + config.host + ':' + config.port);
    console.log('Open the WebQuota Extension Bridge panel in Chrome and connect it with the API key from .env.');
  });

  const shutdown = async () => {
    server.close();
    await bridge.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
