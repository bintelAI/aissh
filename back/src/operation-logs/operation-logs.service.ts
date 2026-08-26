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
}

interface OperationLogRow {
  id: string;
  timestamp: string;
  type: OperationLogType;
  content: string;
  serverId: string;
}

@Injectable()
export class OperationLogsService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(input: CreateOperationLogInput): StoredOperationLog {
    const log = this.normalize(input);
    const id = randomUUID();

    this.databaseService.connection
      .prepare(
        `INSERT INTO operation_logs (id, timestamp, type, content, server_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, log.timestamp, log.type, log.content, log.serverId, new Date().toISOString());

    return { id, ...log };
  }

  findAll(options: FindOperationLogsOptions): StoredOperationLog[] {
    const limit = this.limit(options.limit);
    const serverId = options.serverId === undefined
      ? undefined
      : this.string(options.serverId, 'serverId', 200);
    const database = this.databaseService.connection;
    const rows = serverId
      ? database
          .prepare(
            `SELECT id, timestamp, type, content, server_id AS serverId
             FROM operation_logs WHERE server_id = ?
             ORDER BY created_at DESC, rowid DESC LIMIT ?`,
          )
          .all(serverId, limit)
      : database
          .prepare(
            `SELECT id, timestamp, type, content, server_id AS serverId
             FROM operation_logs ORDER BY created_at DESC, rowid DESC LIMIT ?`,
          )
          .all(limit);

    return (rows as unknown as OperationLogRow[]).reverse();
  }

  clear(serverId?: string): { deleted: number } {
    const result = serverId === undefined
      ? this.databaseService.connection.prepare('DELETE FROM operation_logs').run()
      : this.databaseService.connection
          .prepare('DELETE FROM operation_logs WHERE server_id = ?')
          .run(this.string(serverId, 'serverId', 200));
    return { deleted: Number(result.changes) };
  }

  private normalize(input: CreateOperationLogInput): Omit<StoredOperationLog, 'id'> {
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
    };
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
