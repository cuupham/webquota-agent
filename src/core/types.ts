export type ChatRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool' | 'function';

export interface ChatMessage {
  role: ChatRole | string;
  content?: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  tool_choice?: unknown;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  user?: string;
  [key: string]: unknown;
}

export interface NormalizedToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ParsedAssistantResponse =
  | { kind: 'final'; content: string }
  | { kind: 'tool_calls'; toolCalls: NormalizedToolCall[] };
