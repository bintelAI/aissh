import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CredentialService } from '../ai/credential.service';
import { DatabaseService } from '../database/database.service';
import { ConfigurationService } from './configuration.service';

describe('ConfigurationService', () => {
  it('persists server passwords in SQLite without returning them in configuration responses', () => {
    const database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-configuration-')));
    const service = new ConfigurationService(database);

    const saved = service.replace({
      folders: [{ id: 'folder-1', name: '生产环境', parentId: null }],
      servers: [
        {
          id: 'server-1',
          name: 'Web 01',
          ip: '10.0.0.1',
          username: 'root',
          port: 22,
          parentId: 'folder-1',
          password: 'plain-password',
        },
      ],
      commandHistory: ['uptime'],
    });

    expect(saved.servers).toEqual([
      expect.objectContaining({ id: 'server-1', ip: '10.0.0.1', parentId: 'folder-1' }),
    ]);
    expect(saved.servers[0]).not.toHaveProperty('password');
    expect(saved.servers[0].hasCredential).toBe(true);
    const stored = database.connection
      .prepare('SELECT password FROM servers WHERE id = ?')
      .get('server-1') as { password: string };
    expect(stored.password).not.toBe('plain-password');
    expect(stored.password.startsWith('enc:v1:')).toBe(true);
    expect(database.findServer('server-1')?.password).toBe('plain-password');
    expect(service.read().commandHistory).toEqual(['uptime']);
    database.close();
  });

  it('keeps existing data when a replacement is invalid', () => {
    const database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-configuration-')));
    const service = new ConfigurationService(database);

    service.replace({
      servers: [{ id: 'server-1', name: 'Web 01', ip: '10.0.0.1', username: 'root', port: 22, parentId: null }],
    });

    expect(() =>
      service.replace({
        servers: [{ id: 'bad', name: 'Bad', ip: '', username: 'root', port: 0, parentId: null }],
      }),
    ).toThrow('port');
    expect(service.read().servers).toHaveLength(1);
    expect(service.read().servers[0].id).toBe('server-1');
    database.close();
  });

  it('retains an existing stored password when a later configuration snapshot omits it', () => {
    const database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-configuration-')));
    const service = new ConfigurationService(database);
    const server = { id: 'server-1', name: 'Web 01', ip: '10.0.0.1', username: 'root', port: 22, parentId: null };

    service.replace({ servers: [{ ...server, password: 'plain-password' }] });
    service.replace({ servers: [{ ...server, password: '' }] });

    const retained = database.connection
      .prepare('SELECT password FROM servers WHERE id = ?')
      .get('server-1') as { password: string };
    expect(retained.password.startsWith('enc:v1:')).toBe(true);
    expect(database.findServer('server-1')?.password).toBe('plain-password');
    database.close();
  });

  it('retains the AI API key when a configuration snapshot is replaced', async () => {
    const database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-configuration-')));
    const credentials = new CredentialService(database);
    const service = new ConfigurationService(database);

    await credentials.setApiKey('stored-ai-key');
    service.replace({ commandHistory: ['uptime'] });

    await expect(credentials.getApiKey()).resolves.toBe('stored-ai-key');
    database.close();
  });
});
