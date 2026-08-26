import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  it('creates the schema once and reopens persisted preferences', () => {
    const appDataDirectory = mkdtempSync(join(tmpdir(), 'aissh-database-'));
    const first = new DatabaseService(appDataDirectory);

    first.setPreference('selectedPromptIds', ['p-linux']);
    first.close();

    const reopened = new DatabaseService(appDataDirectory);

    expect(reopened.getPreference('selectedPromptIds')).toEqual(['p-linux']);
    expect(reopened.migrationVersions()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(
      reopened.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('operation_logs', 'ai_chat_sessions', 'ai_chat_messages') ORDER BY name")
        .all(),
    ).toEqual([
      { name: 'ai_chat_messages' },
      { name: 'ai_chat_sessions' },
      { name: 'operation_logs' },
    ]);
    expect(
      reopened.connection
        .prepare("SELECT name FROM pragma_table_info('operation_logs') WHERE name = 'server_ip'")
        .get(),
    ).toEqual(expect.objectContaining({ name: 'server_ip' }));
    reopened.close();
  });

  it('returns a saved SSH target by server id with its stored password', () => {
    const appDataDirectory = mkdtempSync(join(tmpdir(), 'aissh-database-'));
    const database = new DatabaseService(appDataDirectory);
    database.connection
      .prepare(
        `INSERT INTO servers (id, name, host, port, username, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('server-1', 'Web 01', '10.0.0.1', 2222, 'root', 'plain-password', new Date().toISOString(), new Date().toISOString());

    expect(database.findServer('server-1')).toEqual({
      name: 'Web 01',
      host: '10.0.0.1',
      port: 2222,
      username: 'root',
      password: 'plain-password',
    });
    database.close();
  });
});
