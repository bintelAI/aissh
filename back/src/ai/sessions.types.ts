export type AiChatSessionMode = 'chat' | 'action';
export type AiChatMessageRole = 'user' | 'assistant' | 'system';

export interface AiChatSession {
  id: string;
  serverId: string | null;
  title: string;
  mode: AiChatSessionMode;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatMessage {
  id: string;
  sessionId: string;
  role: AiChatMessageRole;
  content: string;
  createdAt: string;
}

export interface CreateAiChatSessionInput {
  serverId?: unknown;
  title?: unknown;
  mode?: unknown;
}

export interface UpdateAiChatSessionInput {
  title?: unknown;
  mode?: unknown;
}

export interface CreateAiChatMessageInput {
  role?: unknown;
  content?: unknown;
}
