import type { LogEntry, Server } from '../types';

export interface LogHistoryFilters {
  serverIp?: string;
  startAt?: string;
  endAt?: string;
  commandQuery?: string;
  alertsOnly?: boolean;
}

export function resolveLogIp(log: LogEntry, servers: Server[]): string {
  if (log.serverIp) return log.serverIp;
  if (log.serverId === 'system') return '系统';
  const serverId = log.serverId.split('#')[0];
  return servers.find((server) => server.id === serverId)?.ip ?? '已删除设备';
}

export function filterOperationLogs(
  logs: LogEntry[],
  servers: Server[],
  filters: LogHistoryFilters,
): LogEntry[] {
  const startAt = parseDate(filters.startAt);
  const endAt = parseDate(filters.endAt);
  const commandQuery = filters.commandQuery?.trim().toLocaleLowerCase();

  return logs.filter((log) => {
    if (filters.serverIp && resolveLogIp(log, servers) !== filters.serverIp) {
      return false;
    }

    const createdAt = parseDate(log.createdAt);
    if (startAt && (!createdAt || createdAt < startAt)) return false;
    if (endAt && (!createdAt || createdAt > endAt)) return false;
    if (
      commandQuery &&
      (log.type !== 'command' ||
        !log.content.toLocaleLowerCase().includes(commandQuery))
    ) {
      return false;
    }
    if (
      filters.alertsOnly &&
      !(['error', 'warning', 'info'] as LogEntry['type'][]).includes(log.type)
    ) {
      return false;
    }
    return true;
  });
}

export function paginateOperationLogs<T>(
  items: T[],
  page: number,
  pageSize = 100,
): { currentPage: number; totalPages: number; items: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  return {
    currentPage,
    totalPages,
    items: items.slice(startIndex, startIndex + pageSize),
  };
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
