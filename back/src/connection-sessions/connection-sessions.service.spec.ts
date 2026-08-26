import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { ConnectionSessionsService } from './connection-sessions.service';

describe('ConnectionSessionsService', () => {
  let database: DatabaseService;
  let service: ConnectionSessionsService;

  beforeEach(() => {
    database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-connection-sessions-')));
    service = new ConnectionSessionsService(database);
  });

  afterEach(() => database.close());

  it('tracks one connection from start through disconnect', () => {
    service.start({
      id: 'session-1',
      serverId: 'server-1',
      deviceName: 'Production API',
      serverIp: '10.0.0.8',
      username: 'deploy',
    });
    const connected = service.markConnected('session-1');
    const closed = service.finish('session-1', 'disconnected', '用户主动断开');

    expect(connected.status).toBe('connected');
    expect(connected.connectedAt).toEqual(expect.any(String));
    expect(closed.status).toBe('disconnected');
    expect(closed.endedAt).toEqual(expect.any(String));
    expect(closed.endReason).toBe('用户主动断开');
  });

  it('returns newest sessions in pages of the requested size', () => {
    for (let index = 1; index <= 3; index += 1) {
      service.start({
        id: `session-${index}`,
        serverId: `server-${index}`,
        deviceName: `Device ${index}`,
        serverIp: `10.0.0.${index}`,
        username: 'root',
      });
    }

    const result = service.list({ page: 2, pageSize: 2 });
    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('session-1');
  });
});
