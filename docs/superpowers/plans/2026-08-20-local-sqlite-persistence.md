# Local SQLite Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser `localStorage` as the long-term source for the desktop application's configuration with SQLite stored in Electron's user-data directory.

**Architecture:** Electron's main process supplies `APP_DATA_DIR` when it forks the existing NestJS sidecar. The sidecar owns schema migration and transactional configuration persistence. React/Zustand remains the immediate UI state; a small client hydrates it from the sidecar and debounces complete configuration snapshots after mutations. SQLite intentionally excludes passwords, private keys, and AI keys.

**Tech Stack:** Electron 39 (Node 22.21), NestJS 11, TypeScript, `node:sqlite`, Jest, React, Zustand.

---

### Task 1: SQLite lifecycle and migration

**Files:**
- Modify: `back/package.json`
- Modify: `electron/main.cjs`
- Modify: `back/src/main.ts`
- Create: `back/src/database/database.service.ts`
- Create: `back/src/database/database.module.ts`
- Test: `back/src/database/database.service.spec.ts`

- [ ] **Step 1: Write a failing database service test**

```ts
it('creates the schema once and reopens persisted preferences', () => {
  const first = new DatabaseService(tempDirectory);
  first.setPreference('selectedPromptIds', ['p-linux']);
  first.close();

  const reopened = new DatabaseService(tempDirectory);
  expect(reopened.getPreference('selectedPromptIds')).toEqual(['p-linux']);
  expect(reopened.migrationVersions()).toEqual([1]);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the module does not exist**

Run: `pnpm --dir back test -- database.service.spec.ts --runInBand`

- [ ] **Step 3: Implement `DatabaseService` with `node:sqlite` and register `DatabaseModule`**

```ts
const databasePath = join(appDataDirectory, 'data', 'aissh.sqlite');
this.database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
this.database.exec('PRAGMA journal_mode = WAL');
```

The service must obtain its directory only from `APP_DATA_DIR`, defaulting to `back/.data` for direct NestJS development, and must make the directory before opening the file.

- [ ] **Step 4: Pass `APP_DATA_DIR` from Electron and bind NestJS to localhost**

```js
const appDataDir = app.getPath('userData');
fs.mkdirSync(path.join(appDataDir, 'data'), { recursive: true });
env: { ...process.env, APP_DATA_DIR: appDataDir }
```

```ts
await app.listen(port, '127.0.0.1');
```

- [ ] **Step 5: Re-run the focused test**

Run: `pnpm --dir back test -- database.service.spec.ts --runInBand`
Expected: PASS.

### Task 2: Transactional configuration snapshot API

**Files:**
- Create: `back/src/configuration/configuration.types.ts`
- Create: `back/src/configuration/configuration.service.ts`
- Create: `back/src/configuration/configuration.controller.ts`
- Create: `back/src/configuration/configuration.module.ts`
- Modify: `back/src/app.module.ts`
- Test: `back/src/configuration/configuration.service.spec.ts`
- Test: `back/test/app.e2e-spec.ts`

- [ ] **Step 1: Write failing tests for a full configuration round-trip and validation rollback**

```ts
expect(service.replace({ servers: [{ id: 'server-1', host: '10.0.0.1', port: 22 }] })).toEqual(
  expect.objectContaining({ servers: [expect.objectContaining({ id: 'server-1' })] }),
);
expect(() => service.replace({ servers: [{ id: 'bad', host: '', port: 0 }] })).toThrow();
expect(service.read().servers).toHaveLength(1);
```

- [ ] **Step 2: Run the focused test and confirm it fails because the configuration service does not exist**

Run: `pnpm --dir back test -- configuration.service.spec.ts --runInBand`

- [ ] **Step 3: Implement normalized SQLite tables and snapshot replacement in one transaction**

The tables are `server_folders`, `servers`, `command_templates`, `prompt_nodes`, `app_preferences`, `command_history`, and `multi_ip_operation_archives`. Before each replacement, remove existing rows in dependency order; validate the complete payload before the transaction; never store `password`, `privateKey`, or `customKey`.

- [ ] **Step 4: Expose `GET /api/v1/configuration`, `PUT /api/v1/configuration`, and `POST /api/v1/configuration/import-local`**

The controller returns status 200 for reads and writes, and status 400 for malformed data. `import-local` uses the same transactional replacement path and is only used when the database is empty.

- [ ] **Step 5: Re-run unit and e2e tests**

Run: `pnpm --dir back test -- configuration.service.spec.ts --runInBand && pnpm --dir back test:e2e --runInBand`
Expected: PASS.

### Task 3: Frontend hydration and debounced persistence

**Files:**
- Create: `components/AISSH/services/configurationPersistence.ts`
- Modify: `components/AISSH/store/useSSHStore.ts`
- Modify: `components/AISSH/store/usePromptStore.ts`
- Modify: `components/AISSH/store/useAIStore.ts`
- Modify: `components/AISSH/store/useMultiIPStore.ts`
- Modify: `components/AISSH/AISSH.tsx`
- Modify: `components/AISSH/types/index.ts`

- [ ] **Step 1: Add a failing client test or type-level compile assertion for snapshot filtering**

```ts
expect(toPersistedServer({ id: '1', password: 'secret' })).not.toHaveProperty('password');
```

- [ ] **Step 2: Implement a single local API client with a snapshot provider**

```ts
registerConfigurationSnapshotProvider(() => ({
  servers: useSSHStore.getState().servers.map(toPersistedServer),
  folders: useSSHStore.getState().folders,
  promptTree: usePromptStore.getState().promptTree,
  selectedPromptIds: usePromptStore.getState().selectedPromptIds,
  agentConfig: toPersistedAgentConfig(useAIStore.getState().agentConfig),
  operations: completedOperations(useMultiIPStore.getState().operations),
}));
```

The API client must obtain Electron's dynamic backend port through `window.electron.getBackendPort()` and debounce writes. It must never write an `ssh_*` browser key.

- [ ] **Step 3: Replace local-storage initialization and writes with hydration actions and persistence notifications**

Each Store adds a synchronous `hydrate` action that does not schedule persistence. Mutations schedule a snapshot write after state changes. AI chat sessions, active terminal data, logs, and active operations remain memory-only.

- [ ] **Step 4: Hydrate in `AISSH` before user edits and display a retryable error if the sidecar cannot be reached**

Run: `pnpm run build`
Expected: TypeScript/Vite build succeeds.

### Task 4: Local import, backup, and packaging verification

**Files:**
- Create: `back/src/database/backup.service.ts`
- Modify: `back/src/configuration/configuration.controller.ts`
- Modify: `back/package.json`
- Modify: `package.json`
- Modify: `推进方案/1. 处理存储机制.md`
- Test: `back/src/database/backup.service.spec.ts`

- [ ] **Step 1: Write a failing backup test**

```ts
expect(backupService.createBackup()).toMatch(/backups\/aissh-.*\.sqlite$/);
expect(existsSync(backupService.createBackup())).toBe(true);
```

- [ ] **Step 2: Implement SQLite backup using `VACUUM INTO` and expose an explicit backup endpoint**

Backups go under `APP_DATA_DIR/backups`, retain the newest seven scheduled backups, and an explicit backup must be exportable outside `APP_DATA_DIR` through a later Electron save-dialog integration.

- [ ] **Step 3: Configure native SQLite packaging and test it**

Run `pnpm run build:back`, then use the packaged Electron runtime with `ELECTRON_RUN_AS_NODE=1` to open an in-memory `node:sqlite` database. This proves no native module tree needs copying beside the sidecar.

- [ ] **Step 4: Run all verification**

Run: `pnpm --dir back test -- --runInBand && pnpm --dir back test:e2e --runInBand && pnpm --dir back build && pnpm run build`
Expected: all commands exit 0.
