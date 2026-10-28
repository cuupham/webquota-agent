# WebQuota Agent

WebQuota Agent is an experimental Windows-local HTTP gateway that submits prompts through a manually signed-in ChatGPT Web browser session and translates responses into an OpenAI-compatible Chat Completions response. A separate client such as OpenCode remains responsible for executing local tools.

## Prototype status

This is an early proof of concept, not a production-ready agent. It relies on ChatGPT Web UI selectors that can change. It does not automate login, solve verification, bypass usage controls, or execute local tools itself. Tool calls are simulated by prompting the model to emit a JSON contract; they are not native model function calls.

## Features

- Local endpoints: GET /health, GET /v1/models, POST /v1/chat/completions.
- Dedicated Playwright browser profile with manual sign-in.
- OpenAI-style non-streaming responses and basic SSE framing.
- JSON tool-call adapter that only accepts names present in the incoming tool schema.
- Bearer-token authentication, loopback-only binding, request-size limits, serial browser requests, unit tests, and GitHub Actions validation.

## Windows setup

Requirements: Windows 10/11, Node.js 22 or newer, Git, and PowerShell.

Clone this repository, enter the directory, then run:

    Set-ExecutionPolicy -Scope Process Bypass
    .\scripts\setup.ps1
    .\scripts\start.ps1

The setup script installs npm dependencies and Playwright Chromium, then creates a local .env with a random API key if it does not already exist. It never signs into ChatGPT for you. A dedicated browser window will open on first start; sign in manually there.

To run checks manually, use npm run check. The API listens on 127.0.0.1 port 4153 by default.

## Smoke test

Open a second PowerShell window. Read WEBQUOTA_API_KEY from the local .env file, then set the same value in the current PowerShell session:

    $env:WEBQUOTA_API_KEY = "YOUR_GENERATED_KEY"
    $headers = @{ Authorization = "Bearer $env:WEBQUOTA_API_KEY" }
    Invoke-RestMethod -Uri "http://127.0.0.1:4153/health"
    Invoke-RestMethod -Uri "http://127.0.0.1:4153/v1/models" -Headers $headers

Send a chat request to POST http://127.0.0.1:4153/v1/chat/completions using a JSON body with model webquota-chatgpt-free and a messages array.

## OpenCode integration

The local provider can use base URL http://127.0.0.1:4153/v1 and the same key as WEBQUOTA_API_KEY. Provider support and tool-call compatibility must be tested against your installed OpenCode version before use.

Start with read-only tools and explicit approvals. Do not enable unattended write or shell execution until the end-to-end tool loop and local permissions have been verified.

## Known limitations

- Each request sends the provided transcript through a new ChatGPT Web interaction. Long tool loops may be slow.
- Browser selectors can break when ChatGPT changes its frontend.
- Streaming is emitted after the browser response has completed; upstream token-by-token streaming is not provided.
- Token counts are rough character-based estimates.
- Images and audio are not forwarded; non-text content is replaced with a placeholder.
- The gateway does not execute tools or enforce the client's local permissions.
- The model may not follow the JSON tool protocol consistently.

## Security

- Keep the API bound to loopback. Do not expose it through port forwarding, a public tunnel, or a shared LAN.
- Never commit .env or browser-profile data.
- Use a dedicated browser profile; do not copy cookies from your normal browser.
- Treat prompts, code, logs, and tool output as untrusted input.
- Enforce filesystem, shell, and Git permissions in the local runtime, not only in model prompts.
- Stop if sign-in expires, verification appears, the site reports a usage limit, or the adapter becomes unstable.

Read docs/architecture.md and docs/security.md before connecting a coding agent.

## Quick setup helper

Run the commands above once per machine. To update dependencies later, run npm install and npm run check.

## Uninstall

Stop the running server first with Ctrl+C in its terminal. Then run:

    .\scripts\uninstall.ps1

By default this removes \`node_modules\` and generated \`dist\` files, while keeping \`.env\` and \`browser-profile\` so your local key/configuration and browser session are not lost.

To also delete that local data:

    .\scripts\uninstall.ps1 -RemoveLocalData

Review the confirmation prompts carefully. This does not remove Node.js, Git, or the shared Playwright browser cache.
