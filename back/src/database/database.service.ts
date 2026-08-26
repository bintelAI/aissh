import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { createSecretStore, SecretStore } from './crypto.util';

interface Migration {
  version: number;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS server_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES server_folders(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        folder_id TEXT REFERENCES server_folders(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        credential_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS command_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        description TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS prompt_nodes (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES prompt_nodes(id) ON DELETE CASCADE,
        node_type TEXT NOT NULL CHECK (node_type IN ('folder', 'prompt')),
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        device_type TEXT,
        prompt TEXT,
        rules_json TEXT NOT NULL DEFAULT '[]',
        is_expanded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_preferences (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS command_history (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        executed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS multi_ip_operation_archives (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        expires_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_servers_folder_id ON servers(folder_id);
      CREATE INDEX IF NOT EXISTS idx_command_history_executed_at ON command_history(executed_at DESC);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        server_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at
        ON operation_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_operation_logs_server_id
        ON operation_logs(server_id);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE servers ADD COLUMN password TEXT;
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id TEXT PRIMARY KEY,
        server_id TEXT,
        title TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('chat', 'action')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_server_id
        ON ai_chat_sessions(server_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id
        ON ai_chat_messages(session_id, created_at ASC);
    `,
  },
];

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly database: DatabaseSync;
  private readonly secrets: SecretStore;

  constructor(@Optional() appDataDirectory?: string) {
    const resolvedDataDir = appDataDirectory ?? process.env.APP_DATA_DIR ?? join(process.cwd(), '.aissh');
    const dataDirectory = join(resolvedDataDir, 'data');
    mkdirSync(dataDirectory, { recursive: true });

    this.database = new DatabaseSync(join(dataDirectory, 'aissh.sqlite'), {
      enableForeignKeyConstraints: true,
    });
    this.database.exec('PRAGMA journal_mode = WAL');
    this.database.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
    );
    this.applyMigrations();
    this.secrets = createSecretStore(resolvedDataDir);
    this.migrateEncryptPasswords();
  }

  get connection(): DatabaseSync {
    return this.database;
  }

  getPreference<T>(key: string): T | null {
    const row = this.database
      .prepare('SELECT value_json FROM app_preferences WHERE key = ?')
      .get(key) as { value_json: string } | undefined;

    return row ? (JSON.parse(row.value_json) as T) : null;
  }

  findServer(serverId: string): { host: string; port: number; username: string; password?: string } | null {
    const row = this.database
      .prepare('SELECT host, port, username, password FROM servers WHERE id = ?')
      .get(serverId) as { host: string; port: number; username: string; password: string | null } | undefined;
    if (row?.password) {
      const password = this.secrets.decrypt(row.password);
      if (password) {
        return { host: row.host, port: row.port, username: row.username, password };
      }
    }
    if (row) return { host: row.host, port: row.port, username: row.username };
    return row ?? null;
  }

  getServerPasswords(): string[] {
    return (this.database
      .prepare("SELECT password FROM servers WHERE password IS NOT NULL AND password != ''")
      .all() as Array<{ password: string }>)
      .map((server) => this.secrets.decrypt(server.password))
      .filter((password): password is string => Boolean(password));
  }

  encryptPassword(plain: string): string {
    return this.secrets.encrypt(plain);
  }

  decryptPassword(stored: string | null | undefined): string | null {
    return stored ? this.secrets.decrypt(stored) : null;
  }

  private migrateEncryptPasswords(): void {
    const rows = this.database
      .prepare("SELECT id, password FROM servers WHERE password IS NOT NULL AND password != ''")
      .all() as Array<{ id: string; password: string }>;
    const update = this.database.prepare('UPDATE servers SET password = ? WHERE id = ?');
    for (const row of rows) {
      if (this.secrets.isEncrypted(row.password)) continue;
      update.run(this.secrets.encrypt(row.password), row.id);
    }
  }

  setPreference(key: string, value: unknown): void {
    this.database
      .prepare(
        `INSERT INTO app_preferences (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), new Date().toISOString());
  }

  deletePreference(key: string): void {
    this.database.prepare('DELETE FROM app_preferences WHERE key = ?').run(key);
  }

  migrationVersions(): number[] {
    return (
      this.database
        .prepare('SELECT version FROM schema_migrations ORDER BY version')
        .all() as Array<{ version: number }>
    ).map((row) => row.version);
  }

  transaction<T>(operation: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }

  onModuleDestroy(): void {
    this.close();
  }

  private applyMigrations(): void {
    const applied = new Set(this.migrationVersions());

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;

      this.transaction(() => {
        this.database.exec(migration.sql);
        this.database
          .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .run(migration.version, new Date().toISOString());
      });
    }
  }
}
