export type ConnectionSessionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

export interface ConnectionSession {
  id: string;
  serverId: string;
  deviceName: string;
  serverIp: string;
  username: string;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  status: ConnectionSessionStatus;
  endReason?: string;
}

export interface CreateConnectionSessionInput {
  id: unknown;
  serverId: unknown;
  deviceName: unknown;
  serverIp: unknown;
  username: unknown;
}

export interface ConnectionSessionPage {
  items: ConnectionSession[];
  page: number;
  pageSize: number;
  total: number;
}
