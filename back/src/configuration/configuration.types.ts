export interface StoredFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface StoredServer {
  id: string;
  name: string;
  ip: string;
  username: string;
  port: number;
  parentId: string | null;
  hasCredential: boolean;
}

export interface StoredServerWithPassword extends StoredServer {
  password?: string;
}

export interface StoredCommandTemplate {
  id: string;
  name: string;
  command: string;
  description?: string;
  tags?: string[];
}

export interface StoredPromptNode {
  id: string;
  name: string;
  type: 'folder' | 'prompt';
  parentId: string | null;
  order: number;
  deviceType?: string;
  prompt?: string;
  rules?: unknown[];
  isExpanded?: boolean;
}

export interface MultiIpArchive {
  id: string;
  status: 'completed' | 'error' | 'cancelled';
  [key: string]: unknown;
}

export interface ConfigurationInput {
  folders?: unknown;
  servers?: unknown;
  commandTemplates?: unknown;
  promptTree?: unknown;
  selectedPromptIds?: unknown;
  agentConfig?: unknown;
  commandHistory?: unknown;
  operations?: unknown;
}

export interface StoredConfiguration {
  folders: StoredFolder[];
  servers: StoredServer[];
  commandTemplates: StoredCommandTemplate[];
  promptTree: StoredPromptNode[];
  selectedPromptIds: string[];
  agentConfig: Record<string, unknown>;
  commandHistory: string[];
  operations: MultiIpArchive[];
}
