import { LogEntry } from '../types';

interface StoredOperationLog extends LogEntry {
  id: string;
}

export async function loadOperationLogs(limit = 1_000): Promise<LogEntry[]> {
  return request<StoredOperationLog[]>(`/api/v1/operation-logs?limit=${limit}`);
}

export async function appendOperationLog(log: LogEntry): Promise<void> {
  await request<StoredOperationLog>('/api/v1/operation-logs', {
    method: 'POST',
    body: log,
  });
}

export async function clearOperationLogs(serverId?: string): Promise<void> {
  const query = serverId ? `?serverId=${encodeURIComponent(serverId)}` : '';
  await request<{ deleted: number }>(`/api/v1/operation-logs${query}`, { method: 'DELETE' });
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${await backendBaseUrl()}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) throw new Error(`Operation log service returned ${response.status}`);
  return (await response.json()) as T;
}

async function backendBaseUrl(): Promise<string> {
  if (window.electron?.isElectron) {
    return `http://127.0.0.1:${await window.electron.getBackendPort()}`;
  }
  return import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3001';
}
