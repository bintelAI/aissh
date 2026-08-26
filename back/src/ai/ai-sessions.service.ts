import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  AiChatMessage,
  AiChatMessageRole,
  AiChatSession,
  AiChatSessionMode,
  CreateAiChatMessageInput,
  CreateAiChatSessionInput,
  UpdateAiChatSessionInput,
} from './sessions.types';

export interface UpdateAiChatMessageInput {
  content?: unknown;
}

interface SessionRow {
  id: string;
  serverId: string | null;
  title: string;
  mode: AiChatSessionMode;
  createdAt: string;
  updatedAt: string;
}

interface MessageRow {
  id: string;
  sessionId: string;
  role: AiChatMessageRole;
  content: string;
  createdAt: string;
}

@Injectable()
export class AiSessionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  listSessions(serverId?: string): AiChatSession[] {
    const database = this.databaseService.connection;
    if (serverId === undefined) {
      return database
        .prepare(
          `SELECT id, server_id AS serverId, title, mode,
             created_at AS createdAt, updated_at AS updatedAt
           FROM ai_chat_sessions ORDER BY updated_at DESC, rowid DESC`,
        )
        .all() as unknown as AiChatSession[];
    }

    const normalizedServerId = this.string(serverId, 'serverId', 200);
    return database
      .prepare(
        `SELECT id, server_id AS serverId, title, mode,
           created_at AS createdAt, updated_at AS updatedAt
         FROM ai_chat_sessions WHERE server_id = ?
         ORDER BY updated_at DESC, rowid DESC`,
      )
      .all(normalizedServerId) as unknown as AiChatSession[];
  }

  createSession(input: CreateAiChatSessionInput): AiChatSession {
    const title = this.string(input?.title ?? '新的运维会话', 'title', 200);
    const mode = this.mode(input?.mode ?? 'chat');
    const serverId = input?.serverId === undefined || input.serverId === null
      ? null
      : this.string(input.serverId, 'serverId', 200);
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    this.databaseService.connection
      .prepare(
        `INSERT INTO ai_chat_sessions (id, server_id, title, mode, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, serverId, title, mode, timestamp, timestamp);

    return { id, serverId, title, mode, createdAt: timestamp, updatedAt: timestamp };
  }

  updateSession(id: string, input: UpdateAiChatSessionInput): AiChatSession {
    const session = this.requireSession(id);
    const title = input?.title === undefined ? session.title : this.string(input.title, 'title', 200);
    const mode = input?.mode === undefined ? session.mode : this.mode(input.mode);
    const updatedAt = new Date().toISOString();

    this.databaseService.connection
      .prepare('UPDATE ai_chat_sessions SET title = ?, mode = ?, updated_at = ? WHERE id = ?')
      .run(title, mode, updatedAt, session.id);

    return { ...session, title, mode, updatedAt };
  }

  deleteSession(id: string): void {
    this.requireSession(id);
    this.databaseService.connection.prepare('DELETE FROM ai_chat_sessions WHERE id = ?').run(id);
  }

  listMessages(sessionId: string): AiChatMessage[] {
    this.requireSession(sessionId);
    return this.databaseService.connection
      .prepare(
        `SELECT id, session_id AS sessionId, role, content, created_at AS createdAt
         FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC`,
      )
      .all(sessionId) as unknown as AiChatMessage[];
  }

  createMessage(sessionId: string, input: CreateAiChatMessageInput): AiChatMessage {
    this.requireSession(sessionId);
    const role = this.role(input?.role);
    const content = this.content(input?.content);
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    this.databaseService.transaction(() => {
      this.databaseService.connection
        .prepare(
          `INSERT INTO ai_chat_messages (id, session_id, role, content, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(id, sessionId, role, content, createdAt);
      this.touchSession(sessionId, createdAt);
    });

    return { id, sessionId, role, content, createdAt };
  }

  updateMessage(sessionId: string, messageId: string, input: UpdateAiChatMessageInput): AiChatMessage {
    this.requireSession(sessionId);
    const message = this.requireMessage(sessionId, messageId);
    const content = this.content(input?.content);
    const updatedAt = new Date().toISOString();

    this.databaseService.transaction(() => {
      this.databaseService.connection
        .prepare('UPDATE ai_chat_messages SET content = ? WHERE id = ? AND session_id = ?')
        .run(content, message.id, sessionId);
      this.touchSession(sessionId, updatedAt);
    });

    return { ...message, content };
  }

  clearMessages(sessionId: string): { deleted: number } {
    this.requireSession(sessionId);
    const result = this.databaseService.connection
      .prepare('DELETE FROM ai_chat_messages WHERE session_id = ?')
      .run(sessionId);
    this.touchSession(sessionId, new Date().toISOString());
    return { deleted: Number(result.changes) };
  }

  private requireSession(id: string): AiChatSession {
    const sessionId = this.string(id, 'sessionId', 200);
    const row = this.databaseService.connection
      .prepare(
        `SELECT id, server_id AS serverId, title, mode,
           created_at AS createdAt, updated_at AS updatedAt
         FROM ai_chat_sessions WHERE id = ?`,
      )
      .get(sessionId) as SessionRow | undefined;
    if (!row) throw new NotFoundException('session not found');
    return row;
  }

  private requireMessage(sessionId: string, messageId: string): AiChatMessage {
    const row = this.databaseService.connection
      .prepare(
        `SELECT id, session_id AS sessionId, role, content, created_at AS createdAt
         FROM ai_chat_messages WHERE id = ? AND session_id = ?`,
      )
      .get(messageId, sessionId) as MessageRow | undefined;
    if (!row) throw new NotFoundException('message not found');
    return row;
  }

  private touchSession(sessionId: string, updatedAt: string): void {
    this.databaseService.connection
      .prepare('UPDATE ai_chat_sessions SET updated_at = ? WHERE id = ?')
      .run(updatedAt, sessionId);
  }

  private mode(value: unknown): AiChatSessionMode {
    if (value !== 'chat' && value !== 'action') {
      throw new BadRequestException('mode is invalid');
    }
    return value;
  }

  private role(value: unknown): AiChatMessageRole {
    if (value !== 'user' && value !== 'assistant' && value !== 'system') {
      throw new BadRequestException('role is invalid');
    }
    return value;
  }

  private string(value: unknown, field: string, maximumLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumLength) {
      throw new BadRequestException(`${field} must be a non-empty string up to ${maximumLength} characters`);
    }
    return value;
  }

  private content(value: unknown): string {
    if (typeof value !== 'string' || value.length > 200_000) {
      throw new BadRequestException('content must be a string up to 200000 characters');
    }
    return value;
  }
}
