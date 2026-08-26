import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ConnectionSession,
  ConnectionSessionPage,
  ConnectionSessionStatus,
  CreateConnectionSessionInput,
} from './connection-sessions.types';

interface ListConnectionSessionsOptions {
  page?: number | string;
  pageSize?: number | string;
}

@Injectable()
export class ConnectionSessionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  start(input: CreateConnectionSessionInput): ConnectionSession {
    const id = this.string(input?.id, 'id', 200);
    const serverId = this.string(input?.serverId, 'serverId', 200);
    const deviceName = this.string(input?.deviceName, 'deviceName', 200);
    const serverIp = this.string(input?.serverIp, 'serverIp', 200);
    const username = this.string(input?.username, 'username', 200);
    const startedAt = new Date().toISOString();

    this.databaseService.connection
      .prepare(
        `INSERT INTO connection_sessions
         (id, server_id, device_name, server_ip, username, started_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'connecting')`,
      )
      .run(id, serverId, deviceName, serverIp, username, startedAt);

    return { id, serverId, deviceName, serverIp, username, startedAt, status: 'connecting' };
  }

  markConnected(id: string): ConnectionSession {
    const session = this.require(id);
    if (session.endedAt || session.status === 'connected') return session;
    const connectedAt = new Date().toISOString();
    this.databaseService.connection
      .prepare("UPDATE connection_sessions SET status = 'connected', connected_at = ? WHERE id = ?")
      .run(connectedAt, session.id);
    return { ...session, status: 'connected', connectedAt };
  }

  finish(
    id: string,
    status: Extract<ConnectionSessionStatus, 'disconnected' | 'failed'>,
    endReason?: string,
  ): ConnectionSession {
    const session = this.require(id);
    if (session.endedAt) return session;
    const endedAt = new Date().toISOString();
    const reason = endReason === undefined ? undefined : this.string(endReason, 'endReason', 1_000);
    this.databaseService.connection
      .prepare('UPDATE connection_sessions SET status = ?, ended_at = ?, end_reason = ? WHERE id = ?')
      .run(status, endedAt, reason ?? null, session.id);
    return { ...session, status, endedAt, ...(reason ? { endReason: reason } : {}) };
  }

  list(options: ListConnectionSessionsOptions = {}): ConnectionSessionPage {
    const page = this.page(options.page);
    const pageSize = this.pageSize(options.pageSize);
    const offset = (page - 1) * pageSize;
    const database = this.databaseService.connection;
    const total = Number((database.prepare('SELECT COUNT(*) AS total FROM connection_sessions').get() as { total: number }).total);
    const items = database
      .prepare(
        `SELECT id, server_id AS serverId, device_name AS deviceName, server_ip AS serverIp,
                username, started_at AS startedAt, connected_at AS connectedAt,
                ended_at AS endedAt, status, end_reason AS endReason
         FROM connection_sessions ORDER BY started_at DESC, rowid DESC LIMIT ? OFFSET ?`,
      )
      .all(pageSize, offset) as unknown as Array<ConnectionSession & { connectedAt: string | null; endedAt: string | null; endReason: string | null }>;

    return {
      items: items.map(({ connectedAt, endedAt, endReason, ...session }) => ({
        ...session,
        ...(connectedAt ? { connectedAt } : {}),
        ...(endedAt ? { endedAt } : {}),
        ...(endReason ? { endReason } : {}),
      })),
      page,
      pageSize,
      total,
    };
  }

  private require(id: string): ConnectionSession {
    const sessionId = this.string(id, 'id', 200);
    const row = this.databaseService.connection
      .prepare(
        `SELECT id, server_id AS serverId, device_name AS deviceName, server_ip AS serverIp,
                username, started_at AS startedAt, connected_at AS connectedAt,
                ended_at AS endedAt, status, end_reason AS endReason
         FROM connection_sessions WHERE id = ?`,
      )
      .get(sessionId) as (ConnectionSession & { connectedAt: string | null; endedAt: string | null; endReason: string | null }) | undefined;
    if (!row) throw new NotFoundException('connection session not found');
    const { connectedAt, endedAt, endReason, ...session } = row;
    return {
      ...session,
      ...(connectedAt ? { connectedAt } : {}),
      ...(endedAt ? { endedAt } : {}),
      ...(endReason ? { endReason } : {}),
    };
  }

  private page(value?: number | string): number {
    const page = value === undefined ? 1 : Number(value);
    if (!Number.isInteger(page) || page < 1) throw new BadRequestException('page must be a positive integer');
    return page;
  }

  private pageSize(value?: number | string): number {
    const pageSize = value === undefined ? 100 : Number(value);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new BadRequestException('pageSize must be an integer between 1 and 100');
    }
    return pageSize;
  }

  private string(value: unknown, field: string, maximumLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumLength) {
      throw new BadRequestException(`${field} must be a non-empty string up to ${maximumLength} characters`);
    }
    return value;
  }
}
