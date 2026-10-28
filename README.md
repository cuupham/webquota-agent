# WebQuota Agent

WebQuota Agent is an experimental Windows-local OpenAI-compatible HTTP gateway that uses a Chrome extension to interact with a ChatGPT tab you open in your normal Chrome profile. It does not launch a separate Playwright Chromium instance.

## Current prototype

- Local endpoints: \`GET /health\`, \`GET /v1/models\`, \`POST /v1/chat/completions\`.
- Extension bridge endpoints: \`GET /bridge/next\` and \`POST /bridge/result\`.
- Manual authentication in your existing Chrome profile.
- JSON-based simulated tool calls. These are not native model function calls.
- Local API uses a bearer key and binds to loopback by default.
- OpenCode or another compatible client is responsible for executing local tools.

## Windows setup

Requirements: Windows 10/11, Node.js 22 or newer, Git, PowerShell, and Google Chrome.

Clone and set up the local API:

    git clone https://github.com/cuupham/webquota-agent.git
    cd webquota-agent
    Set-ExecutionPolicy -Scope Process Bypass
    .\scripts\setup.ps1

Start the API in PowerShell:

    .\scripts\start.ps1

The setup script creates a random API key in \`.env\` and installs Node.js dependencies. It no longer installs a separate browser.

## Install the Chrome extension

1. Open \`chrome://extensions\` in your normal Chrome profile.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository's \`extension\` folder.
4. Open \`https://chatgpt.com\` in that same Chrome profile. Sign in manually if needed. If ChatGPT was already open when you loaded the extension, reload the ChatGPT tab once.
5. Click the WebQuota Agent Bridge extension icon. It opens the Bridge Panel in a separate tab.
6. Copy \`WEBQUOTA_API_KEY\` from the root \`.env\` file into the Bridge Panel, then click **Connect**.
7. Keep the Bridge Panel and ChatGPT tab open while using the API.

The extension interacts only with \`https://chatgpt.com/*\` and calls the local gateway at \`http://127.0.0.1:4153\`. It does not access saved passwords or extract ChatGPT cookies. If a sign-in or security challenge appears, handle it manually in Chrome.

More details: [extension/README.md](extension/README.md).

## Verify the API

Open a second PowerShell window in the project folder:

    $keyLine = Get-Content .env | Where-Object { $_ -match '^WEBQUOTA_API_KEY=' } | Select-Object -First 1
    $key = ($keyLine -split '=', 2)[1].Trim()
    $headers = @{ Authorization = "Bearer $key" }
    Invoke-RestMethod -Uri "http://127.0.0.1:4153/health"
    Invoke-RestMethod -Uri "http://127.0.0.1:4153/v1/models" -Headers $headers

Then test ChatGPT through the browser bridge:

    $body = @{
      model = "webquota-chatgpt-free"
      messages = @(@{ role = "user"; content = "Reply with exactly WEBQUOTA_OK" })
      stream = $false
    } | ConvertTo-Json -Depth 20

    $result = Invoke-RestMethod -Uri "http://127.0.0.1:4153/v1/chat/completions" -Method Post -Headers $headers -ContentType "application/json" -Body $body
    $result.choices[0].message | Format-List

## OpenCode integration

Configure the provider base URL as \`http://127.0.0.1:4153/v1\` and use the same secret as \`WEBQUOTA_API_KEY\`. OpenCode compatibility has to be tested with your installed version before relying on it for coding tasks.

Start with read-only tools. Add file writes and terminal execution only after a real tool-call loop has been verified and approval policies are enforced by the local runtime.

## Known limitations

- The Bridge Panel tab must stay open; one ChatGPT tab acts as one serial worker.
- ChatGPT UI selectors can change. If a selector breaks, update \`extension/content.js\`.
- The API resends the supplied transcript in each browser task and starts a new ChatGPT conversation for each task. Tool-heavy jobs can create many conversations.
- Streaming is emulated after the browser response is complete; upstream token-by-token streaming is not implemented.
- Token usage is a rough character-based estimate.
- Images/audio are not forwarded.
- This gateway does not execute local tools or enforce their permissions.
- The model may not follow the JSON tool-call protocol consistently.

## Security

- Keep the API bound to loopback. Do not expose it via port forwarding or a public tunnel.
- Never commit \`.env\` or private project data.
- Treat prompts, source snippets, logs and tool outputs as untrusted data.
- Enforce filesystem, shell and Git permissions in the local runtime.
- Stop on security verification, login expiry, usage-limit notices or selector drift.
- Review applicable service terms before enabling automated interaction and extraction from the ChatGPT Web interface.

See [docs/architecture.md](docs/architecture.md) and [docs/security.md](docs/security.md).

## Uninstall

Stop the server with Ctrl+C, then run:

    .\scripts\uninstall.ps1

This removes project dependencies and build output while keeping the API key in \`.env\`. To also delete local configuration and any legacy Playwright profile:

    .\scripts\uninstall.ps1 -RemoveLocalData

To remove the browser extension, open \`chrome://extensions\` and remove **WebQuota Agent Bridge**. Removing the extension clears its locally stored API key. The uninstall script does not remove Node.js, Git, or shared Chrome data.
