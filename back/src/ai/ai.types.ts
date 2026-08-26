export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiChatRequest {
  config?: {
    baseUrl?: unknown;
    model?: unknown;
  };
  messages?: unknown;
  stream?: unknown;
  temperature?: unknown;
  responseFormat?: unknown;
}

export interface ValidatedAiChatRequest {
  config: {
    baseUrl: string;
    model: string;
  };
  messages: AiMessage[];
  stream: boolean;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
}
