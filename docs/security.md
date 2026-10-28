# Security model and operational checklist

## Browser session

- Use your normal Chrome profile only after you sign in manually.
- The extension operates on \`https://chatgpt.com/*\`; it does not extract cookies, passwords, or authentication tokens.
- The extension needs its Bridge Panel tab to remain open. Disconnect it when not using the local API.
- If sign-in expires or a security verification page appears, handle it manually in Chrome. Do not implement CAPTCHA solving, stealth, account rotation, or methods to bypass service controls.

## Local API

- Keep the gateway bound to \`127.0.0.1\`.
- Use a random \`WEBQUOTA_API_KEY\` of at least 32 characters.
- The extension needs host permissions only for \`https://chatgpt.com/*\` and \`http://127.0.0.1:4153/*\`.
- Never expose the local API through port forwarding, a public tunnel, or a shared LAN.
- Do not commit \`.env\`, local browser data, or API keys.

## Local tool boundary

The gateway does not execute local tools. It only proposes tool calls that a client may execute. A trusted local runtime must validate arguments against trusted schemas, restrict paths to allowed workspace roots, reject traversal and unsafe symlinks, require approval for writes and arbitrary processes, enforce timeouts and output limits, record actions without logging secrets, and support cancellation and recovery.

Do not enable unattended arbitrary PowerShell merely because the model returned valid JSON.

## Data handling

Prompts, source snippets, logs, tool results, and assistant responses flow through ChatGPT Web. Do not use this with secrets, production credentials, private customer data, or repositories whose contents must remain local. Automated interaction and extraction from the ChatGPT web interface may be subject to applicable service terms; review them before using this prototype.

## Stop conditions

Stop on login expiry, security verification, a usage-limit notice, unexpected redirects, repeated malformed outputs, or selector drift.
