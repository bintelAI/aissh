import { ChatMessage, ChatSession } from '../types';
import { extractTaskSummary } from './aiSummaryParser';

type AiSessionMode = ChatSession['mode'];
type AiMessageRole = ChatMessage['role'];

interface ApiAiSession {
  id: string;
  serverId: string | null;
  title: string;
  mode: AiSessionMode;
  createdAt: string;
  updatedAt: string;
}

interface ApiAiMessage {
  id: string;
  sessionId: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
}

export interface CreateAiSessionInput {
  serverId?: string;
  title?: string;
  mode?: AiSessionMode;
}

export interface UpdateAiSessionInput {
  title?: string;
  mode?: AiSessionMode;
}

export interface CreateAiMessageInput {
  role: AiMessageRole;
  content: string;
}

export function toChatSession(session: ApiAiSession, messages: ChatMessage[] = []): ChatSession {
  return {
    id: session.id,
    serverId: session.serverId ?? undefined,
    title: session.title,
    mode: session.mode,
    messages,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  };
}

export function toChatMessage(message: ApiAiMessage): ChatMessage {
  const isDone = message.content.startsWith('### 🏁 任务完成');
  const summary = isDone
    ? extractTaskSummary(message.content.replace(/^### 🏁 任务完成\n?/, ''))
    : undefined;
  return {
    id: message.id,
    role: message.role,
    content: isDone ? `### 🏁 任务完成\n${summary}` : message.content,
    timestamp: new Date(message.createdAt),
    isThought: !isDone && message.content.startsWith('**💡 思考**:'),
    isDone,
    summary,
  };
}

export async function listAiSessions(serverId?: string): Promise<ChatSession[]> {
  const query = serverId ? `?serverId=${encodeURIComponent(serverId)}` : '';
  return (await request<ApiAiSession[]>(`/api/v1/ai/sessions${query}`)).map((session) => toChatSession(session));
}

export async function createAiSession(input: CreateAiSessionInput): Promise<ChatSession> {
  return toChatSession(await request<ApiAiSession>('/api/v1/ai/sessions', { method: 'POST', body: input }));
}

export async function updateAiSession(id: string, input: UpdateAiSessionInput): Promise<ChatSession> {
  return toChatSession(await request<ApiAiSession>(`/api/v1/ai/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }));
}

export async function deleteAiSession(id: string): Promise<void> {
  await request<{ deleted: true }>(`/api/v1/ai/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listAiMessages(sessionId: string): Promise<ChatMessage[]> {
  return (await request<ApiAiMessage[]>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/messages`)).map(toChatMessage);
}

export async function createAiMessage(sessionId: string, input: CreateAiMessageInput): Promise<ChatMessage> {
  return toChatMessage(await request<ApiAiMessage>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/messages`, { method: 'POST', body: input }));
}

export async function updateAiMessage(sessionId: string, messageId: string, content: string): Promise<ChatMessage> {
  return toChatMessage(await request<ApiAiMessage>(
    `/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'PATCH', body: { content } },
  ));
}

export async function clearAiMessages(sessionId: string): Promise<void> {
  await request<{ deleted: number }>(`/api/v1/ai/sessions/${encodeURIComponent(sessionId)}/messages`, { method: 'DELETE' });
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${await backendBaseUrl()}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

async function backendBaseUrl(): Promise<string> {
  if (window.electron?.isElectron) {
    return `http://127.0.0.1:${await window.electron.getBackendPort()}`;
  }
  return import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3001';
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
  } catch {
    // Fall back to a stable error when a proxy returns a non-JSON response.
  }
  return `AI 会话服务请求失败（${response.status}）`;
}
