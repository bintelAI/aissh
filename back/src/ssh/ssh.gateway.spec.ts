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
    const gateway = new SshGateway(
      { createConnection } as never,
      database,
      { start: jest.fn(), finish: jest.fn() } as never,
    );
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

  it('records a failed session when a saved server has no credential', () => {
    const database = new DatabaseService(
      mkdtempSync(join(tmpdir(), 'aissh-gateway-missing-credential-')),
    );
    database.connection
      .prepare(
        `INSERT INTO servers (id, name, host, port, username, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(
        'server-1',
        'Web 01',
        '10.0.0.1',
        22,
        'root',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    const sessions = { start: jest.fn(), finish: jest.fn() };
    const gateway = new SshGateway({ createConnection: jest.fn() } as never, database, sessions as never);
    gateway.server = { to: jest.fn(() => ({ emit: jest.fn() })) } as never;

    gateway.handleConnect({ id: 'client-1' } as never, {
      serverId: 'server-1',
      auditSessionId: 'audit-1',
    });

    expect(sessions.start).toHaveBeenCalledWith({
      id: 'audit-1',
      serverId: 'server-1',
      deviceName: 'Web 01',
      serverIp: '10.0.0.1',
      username: 'root',
    });
    expect(sessions.finish).toHaveBeenCalledWith(
      'audit-1',
      'failed',
      '服务器凭据未在后端配置，请先保存密码',
    );
    database.close();
  });
});
