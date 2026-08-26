import { AgentConfig, CommandTemplate, Folder, PromptNode, Server } from '../types';
import { MultiIPOperation } from '../types/multiIP';

export interface LocalConfiguration {
  folders: Folder[];
  servers: Array<Omit<Server, 'status'> & { hasCredential?: boolean }>;
  commandTemplates: CommandTemplate[];
  promptTree: PromptNode[];
  selectedPromptIds: string[];
  agentConfig: Omit<AgentConfig, 'customKey'>;
  commandHistory: string[];
  operations: MultiIPOperation[];
}

type SnapshotProvider = () => LocalConfiguration;

let snapshotProvider: SnapshotProvider | null = null;
let persistenceTimer: ReturnType<typeof setTimeout> | null = null;
let lastPersistedSnapshot = '';
let pendingWrite = false;

export function registerConfigurationSnapshotProvider(provider: SnapshotProvider): void {
  snapshotProvider = provider;
}

export function beginConfigurationHydration(): void {
  pendingWrite = true;
}

export function finishConfigurationHydration(): void {
  pendingWrite = false;
  if (snapshotProvider) lastPersistedSnapshot = JSON.stringify(snapshotProvider());
}

export function observeConfigurationChanges(): () => void {
  return () => {
    if (persistenceTimer) clearTimeout(persistenceTimer);
  };
}

export function scheduleConfigurationSave(): void {
  if (pendingWrite || !snapshotProvider) return;

  const snapshot = snapshotProvider();
  const serialized = JSON.stringify(snapshot);
  if (serialized === lastPersistedSnapshot) return;

  if (persistenceTimer) clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(() => {
    void replaceConfiguration(snapshot, serialized);
  }, 250);
}

export async function exportConfiguration(): Promise<LocalConfiguration> {
  if (snapshotProvider) return snapshotProvider();
  return deserializeConfiguration(await request<LocalConfiguration>('/api/v1/configuration'));
}

export async function importConfiguration(configuration: LocalConfiguration): Promise<LocalConfiguration> {
  const saved = await request<LocalConfiguration>('/api/v1/configuration/import', {
    method: 'POST',
    body: configuration,
  });
  lastPersistedSnapshot = JSON.stringify(saved);
  return deserializeConfiguration(saved);
}

export async function saveServerCredential(serverId: string, password: string): Promise<void> {
  await request(`/api/v1/configuration/servers/${encodeURIComponent(serverId)}/credential`, {
    method: 'PUT',
    body: { password },
  });
}

export function saveConfigurationExport(fileName: string, contents: string): Promise<{ canceled: boolean; path?: string }> {
  if (window.electron?.isElectron) {
    return window.electron.saveConfiguration(fileName, contents);
  }

  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return Promise.resolve({ canceled: false });
}

export async function initializeConfiguration(defaultConfiguration: LocalConfiguration): Promise<LocalConfiguration> {
  const existing = await request<LocalConfiguration>('/api/v1/configuration');
  if (!isEmpty(existing)) return deserializeConfiguration(existing);

  const saved = await request<LocalConfiguration>('/api/v1/configuration', {
    method: 'PUT',
    body: defaultConfiguration,
  });
  return deserializeConfiguration(saved);
}

function isEmpty(configuration: LocalConfiguration): boolean {
  return (
    configuration.folders.length === 0 &&
    configuration.servers.length === 0 &&
    configuration.commandTemplates.length === 0 &&
    configuration.promptTree.length === 0 &&
    configuration.commandHistory.length === 0 &&
    configuration.operations.length === 0
  );
}

async function replaceConfiguration(snapshot: LocalConfiguration, serialized: string): Promise<void> {
  try {
    await request<LocalConfiguration>('/api/v1/configuration', { method: 'PUT', body: snapshot });
    lastPersistedSnapshot = serialized;
  } catch (error) {
    console.error('Failed to persist local configuration:', error);
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${await backendBaseUrl()}${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) throw new Error(`Local configuration service returned ${response.status}`);
  return (await response.json()) as T;
}

async function backendBaseUrl(): Promise<string> {
  if (window.electron?.isElectron) {
    return `http://127.0.0.1:${await window.electron.getBackendPort()}`;
  }
  return import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3001';
}

export function toPersistedServer(server: Server): Omit<Server, 'status'> & { hasCredential?: boolean } {
  const { status: _status, ...withoutStatus } = server;
  const { privateKey: _privateKey, passphrase: _passphrase, ...persisted } = withoutStatus as typeof withoutStatus & {
    privateKey?: unknown;
    passphrase?: unknown;
  };
  return persisted;
}

export function toPersistedAgentConfig(config: AgentConfig): Omit<AgentConfig, 'customKey'> {
  const { customKey: _customKey, ...persisted } = config;
  return persisted;
}

export function toPersistedOperations(operations: MultiIPOperation[]): MultiIPOperation[] {
  return operations.filter(isCompletedOperation).map((operation) => JSON.parse(JSON.stringify(operation)) as MultiIPOperation);
}

export function deserializeConfiguration(configuration: LocalConfiguration): LocalConfiguration {
  return {
    ...configuration,
    operations: configuration.operations.map(deserializeOperation),
  };
}

function isCompletedOperation(operation: MultiIPOperation): boolean {
  return operation.status === 'completed' || operation.status === 'error' || operation.status === 'cancelled';
}

function deserializeOperation(operation: MultiIPOperation): MultiIPOperation {
  return {
    ...operation,
    createdAt: new Date(operation.createdAt),
    startedAt: operation.startedAt ? new Date(operation.startedAt) : undefined,
    completedAt: operation.completedAt ? new Date(operation.completedAt) : undefined,
    steps: operation.steps.map((step) => ({
      ...step,
      startTime: new Date(step.startTime),
      endTime: step.endTime ? new Date(step.endTime) : undefined,
      serverResults: step.serverResults.map((result) => ({
        ...result,
        startTime: result.startTime ? new Date(result.startTime) : undefined,
        endTime: result.endTime ? new Date(result.endTime) : undefined,
      })),
    })),
  };
}
