import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ConfigurationInput,
  MultiIpArchive,
  StoredCommandTemplate,
  StoredConfiguration,
  StoredFolder,
  StoredPromptNode,
  StoredServer,
  StoredServerWithPassword,
} from './configuration.types';

const now = (): string => new Date().toISOString();

@Injectable()
export class ConfigurationService {
  constructor(private readonly databaseService: DatabaseService) {}

  read(): StoredConfiguration {
    const database = this.databaseService.connection;
    const folders = database
      .prepare('SELECT id, name, parent_id AS parentId FROM server_folders ORDER BY sort_order, name')
      .all() as unknown as StoredFolder[];
    const servers = (
      (database
        .prepare(
          `SELECT id, name, host AS ip, username, port, folder_id AS parentId,
             CASE WHEN password IS NULL OR password = '' THEN 0 ELSE 1 END AS hasCredential
           FROM servers ORDER BY name`,
        )
        .all() as unknown) as Array<Omit<StoredServer, 'hasCredential'> & { hasCredential: number }>
    ).map((server) => ({ ...server, hasCredential: Boolean(server.hasCredential) }));
    const commandTemplates = (
      (database
        .prepare('SELECT id, name, command, description, tags_json FROM command_templates ORDER BY name')
        .all() as unknown) as Array<StoredCommandTemplate & { tags_json: string }>
    ).map(({ tags_json, ...template }) => ({ ...template, tags: JSON.parse(tags_json) as string[] }));
    type PromptNodeRow = {
      id: string;
      name: string;
      type: 'folder' | 'prompt';
      parentId: string | null;
      order: number;
      deviceType: string | null;
      prompt: string | null;
      rules_json: string;
      isExpanded: number;
    };
    const promptTree: StoredPromptNode[] = (
      (database
        .prepare(
          `SELECT id, name, node_type AS type, parent_id AS parentId, sort_order AS "order",
             device_type AS deviceType, prompt, rules_json, is_expanded AS isExpanded
           FROM prompt_nodes ORDER BY sort_order, name`,
        )
        .all() as unknown) as PromptNodeRow[]
    ).map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      parentId: row.parentId,
      order: row.order,
      ...(row.deviceType ? { deviceType: row.deviceType } : {}),
      ...(row.prompt ? { prompt: row.prompt } : {}),
      rules: JSON.parse(row.rules_json) as unknown[],
      isExpanded: Boolean(row.isExpanded),
    }));
    const commandHistory = (
      database
        .prepare('SELECT command FROM command_history ORDER BY executed_at DESC')
        .all() as Array<{ command: string }>
    ).map((entry) => entry.command);
    const operations = (
      database
        .prepare('SELECT payload_json FROM multi_ip_operation_archives ORDER BY completed_at DESC')
        .all() as Array<{ payload_json: string }>
    ).map((entry) => JSON.parse(entry.payload_json) as MultiIpArchive);

    return {
      folders,
      servers,
      commandTemplates,
      promptTree,
      selectedPromptIds: this.databaseService.getPreference<string[]>('selectedPromptIds') ?? [],
      agentConfig: this.databaseService.getPreference<Record<string, unknown>>('agentConfig') ?? {},
      commandHistory,
      operations,
    };
  }

  validate(input: ConfigurationInput): void {
    this.normalize(input);
  }

  replace(input: ConfigurationInput): StoredConfiguration {
    const configuration = this.normalize(input);

    return this.databaseService.transaction(() => {
      const database = this.databaseService.connection;
      const existingPasswords = new Map(
        (database
          .prepare('SELECT id, password FROM servers WHERE password IS NOT NULL AND password != \'\'')
          .all() as Array<{ id: string; password: string }>)
          .map((server) => [server.id, server.password] as const),
      );
      const existingAiApiKey = this.databaseService.getPreference<string>('aiApiKey');
      database.exec(`
        DELETE FROM multi_ip_operation_archives;
        DELETE FROM command_history;
        DELETE FROM app_preferences;
        DELETE FROM prompt_nodes;
        DELETE FROM command_templates;
        DELETE FROM servers;
        DELETE FROM server_folders;
      `);

      const timestamp = now();
      const insertFolder = database.prepare(
        'INSERT INTO server_folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      );
      configuration.folders.forEach((folder, index) =>
        insertFolder.run(folder.id, folder.name, folder.parentId, index, timestamp, timestamp),
      );

      const insertServer = database.prepare(
        `INSERT INTO servers (id, folder_id, name, host, port, username, credential_ref, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      );
      configuration.servers.forEach((server) =>
        insertServer.run(
          server.id,
          server.parentId,
          server.name,
          server.ip,
          server.port,
          server.username,
          server.password
            ? this.databaseService.encryptPassword(server.password)
            : (existingPasswords.get(server.id) ?? null),
          timestamp,
          timestamp,
        ),
      );

      const insertTemplate = database.prepare(
        `INSERT INTO command_templates (id, name, command, description, tags_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      configuration.commandTemplates.forEach((template) =>
        insertTemplate.run(
          template.id,
          template.name,
          template.command,
          template.description ?? null,
          JSON.stringify(template.tags ?? []),
          timestamp,
          timestamp,
        ),
      );

      const insertPromptNode = database.prepare(
        `INSERT INTO prompt_nodes
          (id, parent_id, node_type, name, sort_order, device_type, prompt, rules_json, is_expanded, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      configuration.promptTree.forEach((node) =>
        insertPromptNode.run(
          node.id,
          node.parentId,
          node.type,
          node.name,
          node.order,
          node.deviceType ?? null,
          node.prompt ?? null,
          JSON.stringify(node.rules ?? []),
          node.isExpanded ? 1 : 0,
          timestamp,
          timestamp,
        ),
      );

      this.databaseService.setPreference('selectedPromptIds', configuration.selectedPromptIds);
      this.databaseService.setPreference('agentConfig', configuration.agentConfig);
      this.databaseService.setPreference('configurationInitialized', true);
      if (existingAiApiKey) this.databaseService.setPreference('aiApiKey', existingAiApiKey);

      const insertHistory = database.prepare(
        'INSERT INTO command_history (id, command, executed_at) VALUES (?, ?, ?)',
      );
      configuration.commandHistory.forEach((command, index) =>
        insertHistory.run(`history-${index}`, command, new Date(Date.now() - index).toISOString()),
      );

      const insertOperation = database.prepare(
        `INSERT INTO multi_ip_operation_archives (id, payload_json, status, completed_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      configuration.operations.forEach((operation) =>
        insertOperation.run(
          operation.id,
          JSON.stringify(operation),
          operation.status,
          typeof operation.completedAt === 'string' ? operation.completedAt : timestamp,
          null,
        ),
      );

      return this.read();
    });
  }

  isEmpty(): boolean {
    return this.databaseService.getPreference<boolean>('configurationInitialized') !== true;
  }

  saveServerCredential(serverId: string, password: unknown): StoredServer {
    if (typeof password !== 'string' || password.trim().length === 0) {
      throw new Error('server password is required');
    }
    const database = this.databaseService.connection;
    const result = database
      .prepare('UPDATE servers SET password = ?, updated_at = ? WHERE id = ?')
      .run(this.databaseService.encryptPassword(password), now(), serverId);
    if (result.changes === 0) throw new Error('server not found');
    const server = this.read().servers.find((entry) => entry.id === serverId);
    if (!server) throw new Error('server not found');
    return server;
  }

  clearServerCredential(serverId: string): StoredServer {
    const database = this.databaseService.connection;
    const result = database
      .prepare('UPDATE servers SET password = NULL, updated_at = ? WHERE id = ?')
      .run(now(), serverId);
    if (result.changes === 0) throw new Error('server not found');
    const server = this.read().servers.find((entry) => entry.id === serverId);
    if (!server) throw new Error('server not found');
    return server;
  }

  private normalize(input: ConfigurationInput): Omit<StoredConfiguration, 'servers'> & { servers: StoredServerWithPassword[] } {
    const folders = this.normalizeFolders(input.folders);
    const folderIds = new Set(folders.map((folder) => folder.id));
    if (folders.some((folder) => folder.parentId && !folderIds.has(folder.parentId))) {
      throw new Error('folder parentId must reference an existing folder');
    }

    const servers = this.normalizeServers(input.servers);
    if (servers.some((server) => server.parentId && !folderIds.has(server.parentId))) {
      throw new Error('server parentId must reference an existing folder');
    }

    const promptTree = this.normalizePromptNodes(input.promptTree);
    const promptIds = new Set(promptTree.map((node) => node.id));
    if (promptTree.some((node) => node.parentId && !promptIds.has(node.parentId))) {
      throw new Error('prompt parentId must reference an existing prompt node');
    }

    const agentConfig = this.object(input.agentConfig);
    delete agentConfig.customKey;

    return {
      folders,
      servers,
      commandTemplates: this.normalizeTemplates(input.commandTemplates),
      promptTree,
      selectedPromptIds: this.stringArray(input.selectedPromptIds, 'selectedPromptIds'),
      agentConfig,
      commandHistory: this.stringArray(input.commandHistory, 'commandHistory').slice(0, 100),
      operations: this.normalizeOperations(input.operations),
    };
  }

  private normalizeFolders(value: unknown): StoredFolder[] {
    const folders = this.array(value, 'folders').map((entry) => {
      const folder = this.object(entry);
      return {
        id: this.string(folder.id, 'folder id'),
        name: this.string(folder.name, 'folder name'),
        parentId: this.nullableString(folder.parentId, 'folder parentId'),
      };
    });
    return this.orderByParent(folders, 'folder');
  }

  private normalizeServers(value: unknown): StoredServerWithPassword[] {
    return this.array(value, 'servers').map((entry) => {
      const server = this.object(entry);
      const port = server.port;
      if (!Number.isInteger(port) || typeof port !== 'number' || port < 1 || port > 65535) {
        throw new Error('server port must be an integer between 1 and 65535');
      }
      const password = server.password === '' ? undefined : server.password;
      if (password !== undefined && typeof password !== 'string') {
        throw new Error('server password must be a non-empty string when provided');
      }
      return {
        id: this.string(server.id, 'server id'),
        name: this.string(server.name, 'server name'),
        ip: this.string(server.ip, 'server ip'),
        username: this.string(server.username, 'server username'),
        port,
        parentId: this.nullableString(server.parentId, 'server parentId'),
        hasCredential: typeof password === 'string',
        ...(typeof password === 'string' ? { password } : {}),
      };
    });
  }

  private normalizeTemplates(value: unknown): StoredCommandTemplate[] {
    return this.array(value, 'commandTemplates').map((entry) => {
      const template = this.object(entry);
      const description = template.description;
      return {
        id: this.string(template.id, 'template id'),
        name: this.string(template.name, 'template name'),
        command: this.string(template.command, 'template command'),
        ...(typeof description === 'string' ? { description } : {}),
        tags: this.stringArray(template.tags, 'template tags'),
      };
    });
  }

  private normalizePromptNodes(value: unknown): StoredPromptNode[] {
    const nodes: StoredPromptNode[] = this.array(value, 'promptTree').map((entry) => {
      const node = this.object(entry);
      const type = node.type;
      if (type !== 'folder' && type !== 'prompt') throw new Error('prompt node type must be folder or prompt');
      if (!Number.isInteger(node.order) || typeof node.order !== 'number') {
        throw new Error('prompt node order must be an integer');
      }
      return {
        id: this.string(node.id, 'prompt node id'),
        name: this.string(node.name, 'prompt node name'),
        type,
        parentId: this.nullableString(node.parentId, 'prompt parentId'),
        order: node.order,
        ...(typeof node.deviceType === 'string' ? { deviceType: node.deviceType } : {}),
        ...(typeof node.prompt === 'string' ? { prompt: node.prompt } : {}),
        rules: this.array(node.rules, 'prompt rules'),
        ...(typeof node.isExpanded === 'boolean' ? { isExpanded: node.isExpanded } : {}),
      };
    });
    return this.orderByParent(nodes, 'prompt node');
  }

  private normalizeOperations(value: unknown): MultiIpArchive[] {
    return this.array(value, 'operations').map((entry) => {
      const operation = this.object(entry);
      const status = operation.status;
      if (status !== 'completed' && status !== 'error' && status !== 'cancelled') {
        throw new Error('only completed, error, and cancelled operations can be archived');
      }
      return { ...operation, id: this.string(operation.id, 'operation id'), status } as MultiIpArchive;
    });
  }

  private array(value: unknown, name: string): unknown[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
    return value;
  }

  private stringArray(value: unknown, name: string): string[] {
    return this.array(value, name).map((entry) => this.string(entry, name));
  }

  private object(value: unknown): Record<string, unknown> {
    if (value === undefined) return {};
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('configuration entry must be an object');
    return { ...(value as Record<string, unknown>) };
  }

  private string(value: unknown, name: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} must be a non-empty string`);
    return value;
  }

  private nullableString(value: unknown, name: string): string | null {
    if (value === null || value === undefined) return null;
    return this.string(value, name);
  }

  private orderByParent<T extends { id: string; parentId: string | null }>(items: T[], label: string): T[] {
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered: T[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (item: T): void => {
      if (visited.has(item.id)) return;
      if (visiting.has(item.id)) throw new Error(`${label} hierarchy contains a cycle`);
      visiting.add(item.id);
      if (item.parentId) {
        const parent = byId.get(item.parentId);
        if (!parent) throw new Error(`${label} parentId must reference an existing item`);
        visit(parent);
      }
      visiting.delete(item.id);
      visited.add(item.id);
      ordered.push(item);
    };

    items.forEach(visit);
    return ordered;
  }
}
