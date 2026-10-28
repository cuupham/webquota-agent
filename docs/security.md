# Security model and operational checklist

This prototype controls a logged-in browser profile. Use only a dedicated, user-controlled environment.

## Before first run

- Review applicable service terms before automating a web interface.
- Use a dedicated Playwright profile. Do not import or copy cookies from your normal browser.
- Generate a random WEBQUOTA_API_KEY of at least 32 characters.
- Keep the service bound to 127.0.0.1.
- Confirm .env and browser-profile are ignored by Git.

## Local tool boundary

The gateway does not execute local tools. It only proposes tool calls that a client may execute. A trusted local runtime must validate arguments against trusted schemas, restrict paths to allowed workspace roots, reject traversal and unsafe symlinks, require approval for writes and arbitrary processes, enforce timeouts and output limits, record actions without logging secrets, and support cancellation and recovery.

Do not enable unattended arbitrary PowerShell merely because the model returned valid JSON.

## Data handling

Prompts, system messages, source snippets, logs, and test output are sent through ChatGPT Web. Do not use this with secrets, production credentials, private customer data, or repositories whose contents must remain local.

## Stop conditions

Stop on login expiry, security verification, a usage-limit notice, unexpected redirects, repeated malformed outputs, or selector drift. Do not implement CAPTCHA solving, account rotation, stealth behavior, or methods to bypass service controls.
