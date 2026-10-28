# Architecture

## Components

1. Browser adapter: launches a dedicated Playwright persistent context and uses the manually signed-in ChatGPT Web UI. One request at a time is allowed because the page is a shared interactive resource.
2. API gateway: exposes a small OpenAI-compatible Chat Completions surface on loopback and validates a Bearer token and request shape.
3. Prompt adapter: formats system, developer, user, assistant, and tool messages plus incoming tool schemas into one text prompt. Multimodal payloads are not forwarded.
4. Tool protocol adapter: expects one JSON object, either {"type":"final","content":"..."} or {"type":"tool_calls","tool_calls":[{"name":"...","arguments":{}}]}. Tool names must exist in the request schema.
5. Client/runtime: OpenCode or another client receives OpenAI-style tool calls, executes configured tools, and sends the tool result in the next API request.

## Prototype trade-offs

- The browser transcript is resent on each request. Long tool loops may be slow.
- Browser selectors can become stale when ChatGPT changes its frontend.
- Streaming is emulated after the browser response is collected; it is not token-by-token upstream streaming.
- Token usage is a rough character-based estimate, not the upstream token count.
- The gateway verifies tool names and argument object shape, but the runtime must validate schemas and authorize all local actions.

## Request sequence

Client sends transcript and tool schemas to the local gateway. The gateway creates a prompt and submits it through ChatGPT Web. The returned JSON is parsed into an assistant response or tool calls. The client executes any permitted tool and sends the result on the next request.

## Failure behavior

Authentication errors return 401; invalid request shapes return 400; oversized prompts return 413; browser/upstream failures return 502. Browser login is always manual.
