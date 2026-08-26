import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { SshGateway } from './ssh.gateway';

describe('SshGateway', () => {
  it('uses only the persisted server credentials for a saved server', () => {
    const database = new DatabaseService(
      mkdtempSync(join(tmpdir(), 'aissh-gateway-')),
    );
    database.connection
      .prepare(
        `INSERT INTO servers (id, name, host, port, username, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'server-1',
        'Web 01',
        '10.0.0.1',
        2222,
        'root',
        'stored-password',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    const createConnection = jest.fn();
    const gateway = new SshGateway({ createConnection } as never, database);
    gateway.server = {} as never;

    gateway.handleConnect({ id: 'client-1' } as never, {
      serverId: 'server-1',
      ip: 'attacker.example',
      port: 22,
      username: 'attacker',
      password: 'attacker-password',
    });

    expect(createConnection).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({
        serverId: 'server-1',
        ip: '10.0.0.1',
        port: 2222,
        username: 'root',
        password: 'stored-password',
      }),
      gateway.server,
    );
    database.close();
  });
});
