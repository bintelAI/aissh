import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  CreateOperationLogInput,
  operationLogTypes,
  OperationLogType,
  StoredOperationLog,
} from './operation-logs.types';

interface FindOperationLogsOptions {
  limit?: number | string;
  serverId?: string;
  sessionId?: string;
}

interface OperationLogRow {
  id: string;
  timestamp: string;
  type: OperationLogType;
  content: string;
  serverId: string;
  serverIp: string | null;
  sessionId: string | null;
  createdAt: string;
}

interface NormalizedOperationLog {
  timestamp: string;
  type: OperationLogType;
  content: string;
  serverId: string;
  serverIp?: string;
  sessionId?: string;
}

@Injectable()
export class OperationLogsService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(input: CreateOperationLogInput): StoredOperationLog {
    const log = this.normalize(input);
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    this.databaseService.connection
      .prepare(
        `INSERT INTO operation_logs (id, timestamp, type, content, server_id, server_ip, session_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        log.timestamp,
        log.type,
        log.content,
        log.serverId,
        log.serverIp ?? null,
        log.sessionId ?? null,
        createdAt,
      );

    return { id, ...log, createdAt };
  }

  findAll(options: FindOperationLogsOptions): StoredOperationLog[] {
    const limit = this.limit(options.limit);
    const serverId = options.serverId === undefined
      ? undefined
      : this.string(options.serverId, 'serverId', 200);
    const sessionId = options.sessionId === undefined
      ? undefined
      : this.string(options.sessionId, 'sessionId', 200);
    const database = this.databaseService.connection;
    const clauses: string[] = [];
    const parameters: Array<string | number> = [];
    if (serverId) {
      clauses.push('server_id = ?');
      parameters.push(serverId);
    }
    if (sessionId) {
      clauses.push('session_id = ?');
      parameters.push(sessionId);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = database
      .prepare(
        `SELECT id, timestamp, type, content, server_id AS serverId,
                server_ip AS serverIp, session_id AS sessionId, created_at AS createdAt
         FROM operation_logs${where}
         ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(...parameters, limit);

    return (rows as unknown as OperationLogRow[])
      .reverse()
      .map(({ serverIp, sessionId, ...log }) => ({
        ...log,
        ...(serverIp ? { serverIp } : {}),
        ...(sessionId ? { sessionId } : {}),
      }));
  }

  clear(serverId?: string): { deleted: number } {
    const result = serverId === undefined
      ? this.databaseService.connection.prepare('DELETE FROM operation_logs').run()
      : this.databaseService.connection
          .prepare('DELETE FROM operation_logs WHERE server_id = ?')
          .run(this.string(serverId, 'serverId', 200));
    return { deleted: Number(result.changes) };
  }

  private normalize(input: CreateOperationLogInput): NormalizedOperationLog {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('operation log body must be an object');
    }
    const type = this.string(input.type, 'type', 30);
    if (!operationLogTypes.includes(type as OperationLogType)) {
      throw new BadRequestException('type is invalid');
    }

    return {
      timestamp: this.string(input.timestamp, 'timestamp', 100),
      type: type as OperationLogType,
      content: this.string(input.content, 'content', 20_000),
      serverId: this.string(input.serverId, 'serverId', 200),
      serverIp: this.optionalString(input.serverIp, 'serverIp', 200),
      sessionId: this.optionalString(input.sessionId, 'sessionId', 200),
    };
  }

  private optionalString(value: unknown, field: string, maximumLength: number): string | undefined {
    if (value === undefined || value === null) return undefined;
    return this.string(value, field, maximumLength);
  }

  private string(value: unknown, field: string, maximumLength: number): string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumLength) {
      throw new BadRequestException(`${field} must be a non-empty string up to ${maximumLength} characters`);
    }
    return value;
  }

  private limit(value: number | string | undefined): number {
    const limit = value === undefined ? 1_000 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 5_000) {
      throw new BadRequestException('limit must be an integer between 1 and 5000');
    }
    return limit;
  }
}
