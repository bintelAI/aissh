import type { ConnectionSessionPage } from '../types';

export async function loadConnectionSessions(
  page = 1,
  pageSize = 100,
): Promise<ConnectionSessionPage> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(
    `${await backendBaseUrl()}/api/v1/connection-sessions?${query}`,
  );
  if (!response.ok) {
    throw new Error(`Connection session service returned ${response.status}`);
  }
  return (await response.json()) as ConnectionSessionPage;
}

async function backendBaseUrl(): Promise<string> {
  if (window.electron?.isElectron) {
    return `http://127.0.0.1:${await window.electron.getBackendPort()}`;
  }
  return import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3001';
}
