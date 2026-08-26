import { ChatMessage, ChatSession } from '../types';
import { toChatMessage, toChatSession } from './aiSessionService';

const session: ChatSession = toChatSession({
  id: 'session-1',
  serverId: 'server-1',
  title: '运维会话',
  mode: 'chat',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
});

const message: ChatMessage = toChatMessage({
  id: 'message-1',
  sessionId: 'session-1',
  role: 'assistant',
  content: '已恢复会话消息',
  createdAt: '2026-08-20T00:00:00.000Z',
});

void session;
void message;
