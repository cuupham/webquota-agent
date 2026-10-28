# Architecture

## Components

1. **Chrome extension panel**: a regular extension-owned tab that polls the local gateway. Keeping the panel open avoids relying on a background service worker to remain alive indefinitely.
2. **Content script**: loaded only on \`https://chatgpt.com/*\`. It submits a prompt through the visible composer and reads the resulting assistant message. Authentication remains manual in the user's normal Chrome profile.
3. **Local API gateway**: exposes OpenAI-compatible Chat Completions endpoints and authenticated extension-bridge endpoints on loopback only.
4. **Prompt adapter**: formats supplied system, developer, user, assistant and tool messages plus tool schemas into a JSON-oriented prompt. Multimodal payloads are not forwarded.
5. **Tool protocol adapter**: expects either \`{"type":"final","content":"..."}\` or \`{"type":"tool_calls","tool_calls":[{"name":"...","arguments":{}}]}\`. Tool names must exist in the incoming schema.
6. **Client/runtime**: OpenCode or another client receives OpenAI-style tool calls, executes configured local tools, and sends tool results in the next API request.

## Local bridge protocol

- \`GET /bridge/next?waitMs=20000\` returns the next job or HTTP 204 when the poll times out.
- \`POST /bridge/result\` accepts \`{"id":"...","success":true,"text":"..."}\` or an explicit error result.
- Both endpoints require the same bearer token as the OpenAI-compatible API.
- The browser bridge serializes jobs because one visible ChatGPT tab is used as a single interactive worker.

## Prototype trade-offs

- The extension needs its Bridge Panel tab and a signed-in ChatGPT tab to stay open.
- ChatGPT UI selectors can change.
- Streaming is emulated after the browser response is collected; it is not token-by-token upstream streaming.
- Token usage is a rough character-based estimate, not an upstream token count.
- The gateway validates tool names and argument-object shape; a local tool runtime must validate schemas and authorize all actions.
- Each API request starts a new ChatGPT Web conversation and sends the supplied transcript. Tool-heavy tasks can create many conversations.

## Failure behavior

Authentication errors return 401; invalid request shapes return 400; oversized prompts return 413; bridge/upstream failures return 502; expired or unknown bridge jobs return 404. The extension does not automate login, solve security challenges, or bypass account controls.
