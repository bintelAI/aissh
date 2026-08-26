import { BadRequestException } from '@nestjs/common';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { OperationLogsService } from './operation-logs.service';

describe('OperationLogsService', () => {
  let database: DatabaseService;
  let service: OperationLogsService;

  beforeEach(() => {
    database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-operation-logs-')));
    service = new OperationLogsService(database);
  });

  afterEach(() => database.close());

  it('creates and reads logs in chronological order', () => {
    const second = service.create({
      timestamp: '10:00:02',
      type: 'info',
      content: 'connected',
      serverId: 'server-1',
    });
    const first = service.create({
      timestamp: '10:00:01',
      type: 'command',
      content: '$ uptime',
      serverId: 'server-1',
    });

    expect(second.id).toEqual(expect.any(String));
    expect(service.findAll({ limit: 1 })).toEqual([first]);
  });

  it('filters and clears logs by server', () => {
    service.create({ timestamp: '10:00:01', type: 'info', content: 'one', serverId: 'server-1' });
    service.create({ timestamp: '10:00:02', type: 'warning', content: 'two', serverId: 'server-2' });

    expect(service.findAll({ serverId: 'server-1' })).toHaveLength(1);
    expect(service.clear('server-1')).toEqual({ deleted: 1 });
    expect(service.findAll({})).toEqual([expect.objectContaining({ serverId: 'server-2' })]);
    expect(service.clear()).toEqual({ deleted: 1 });
  });

  it.each([
    [{ timestamp: '', type: 'info', content: 'ok', serverId: 'server-1' }, 'timestamp'],
    [{ timestamp: '10:00:00', type: 'debug', content: 'ok', serverId: 'server-1' }, 'type'],
    [{ timestamp: '10:00:00', type: 'info', content: '', serverId: 'server-1' }, 'content'],
    [{ timestamp: '10:00:00', type: 'info', content: 'ok', serverId: '' }, 'serverId'],
  ])('rejects invalid log input %#', (input, expectedField) => {
    expect(() => service.create(input)).toThrow(BadRequestException);
    expect(() => service.create(input)).toThrow(expectedField);
  });

  it('rejects oversized log content and excessive query limits', () => {
    expect(() =>
      service.create({
        timestamp: '10:00:00',
        type: 'info',
        content: 'x'.repeat(20_001),
        serverId: 'server-1',
      }),
    ).toThrow('content');
    expect(() => service.findAll({ limit: 5_001 })).toThrow('limit');
  });

  it('rejects a missing request body as a bad request', () => {
    expect(() => service.create(null as never)).toThrow(BadRequestException);
  });
});
