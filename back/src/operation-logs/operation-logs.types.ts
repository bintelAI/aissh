export const operationLogTypes = [
  'info',
  'error',
  'warning',
  'command',
  'ai-action',
  'ai-thought',
] as const;

export type OperationLogType = (typeof operationLogTypes)[number];

export interface CreateOperationLogInput {
  timestamp: unknown;
  type: unknown;
  content: unknown;
  serverId: unknown;
  serverIp?: unknown;
  sessionId?: unknown;
}

export interface StoredOperationLog {
  id: string;
  timestamp: string;
  type: OperationLogType;
  content: string;
  serverId: string;
  serverIp?: string;
  sessionId?: string;
  createdAt: string;
}
