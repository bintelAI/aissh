import type { LogEntry, Server } from '../types';
import {
  filterOperationLogs,
  paginateOperationLogs,
  resolveLogIp,
} from './logHistory';

const servers: Server[] = [
  {
    id: 'server-1',
    name: 'Production',
    ip: '10.0.0.8',
    username: 'root',
    port: 22,
    status: 'connected',
    parentId: null,
  },
];

const logs: LogEntry[] = [
  {
    timestamp: '09:00:00',
    createdAt: '2026-08-26T01:00:00.000Z',
    type: 'info',
    content: 'connected',
    serverId: 'server-1',
    serverIp: '10.0.0.8',
  },
  {
    timestamp: '10:00:00',
    createdAt: '2026-08-26T02:00:00.000Z',
    type: 'command',
    content: '$ uptime',
    serverId: 'legacy-server',
  },
  {
    timestamp: '11:00:00',
    createdAt: '2026-08-26T03:00:00.000Z',
    type: 'info',
    content: 'batch start',
    serverId: 'system',
  },
];

function toDateTimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

describe('operation log history', () => {
  it('filters by persisted IP and inclusive date-time range', () => {
    const createdAt = new Date(logs[0].createdAt!);
    const filtered = filterOperationLogs(logs, servers, {
      serverIp: '10.0.0.8',
      startAt: toDateTimeLocalValue(new Date(createdAt.getTime() - 30 * 60_000)),
      endAt: toDateTimeLocalValue(new Date(createdAt.getTime() + 30 * 60_000)),
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0]).toBe(logs[0]);
  });

  it('resolves legacy and system log IP labels without losing old logs', () => {
    expect(resolveLogIp(logs[1], servers)).toBe('已删除设备');
    expect(resolveLogIp(logs[2], servers)).toBe('系统');
  });

  it('filters command logs by command content', () => {
    const filtered = filterOperationLogs(logs, servers, {
      commandQuery: 'UPTIME',
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0]).toBe(logs[1]);
  });

  it('treats error, warning, and info logs as alerts', () => {
    const filtered = filterOperationLogs(logs, servers, { alertsOnly: true });
    expect(filtered.length).toBe(2);
    expect(filtered[0]).toBe(logs[0]);
    expect(filtered[1]).toBe(logs[2]);
  });

  it('returns 100 records for each full page', () => {
    const entries = Array.from({ length: 201 }, (_, index) => index + 1);
    const page = paginateOperationLogs(entries, 2);
    expect(page.currentPage).toBe(2);
    expect(page.totalPages).toBe(3);
    expect(page.items.length).toBe(100);
    expect(page.items[0]).toBe(101);
    expect(page.items[99]).toBe(200);
  });
});
