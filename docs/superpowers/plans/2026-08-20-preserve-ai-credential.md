# Preserve AI Credential Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent ordinary configuration saves from deleting the locally stored AI API credential.

**Architecture:** The configuration service owns snapshot replacement and will retain the credential preference before clearing ordinary preferences, then restore it inside the existing transaction. The credential service remains the only API-facing owner of the credential key.

**Tech Stack:** NestJS, TypeScript, Node SQLite, Jest.

---

### Task 1: Preserve the independent credential preference

**Files:**
- Modify: `back/src/configuration/configuration.service.spec.ts`
- Modify: `back/src/configuration/configuration.service.ts`

- [x] **Step 1: Write the failing test**

```ts
it('retains the AI API key when a configuration snapshot is replaced', async () => {
  const database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-configuration-')));
  const credentials = new CredentialService(database);
  const service = new ConfigurationService(database);

  await credentials.setApiKey('stored-ai-key');
  service.replace({ commandHistory: ['uptime'] });

  await expect(credentials.getApiKey()).resolves.toBe('stored-ai-key');
  database.close();
});
```

- [x] **Step 2: Verify the test fails before the fix**

Run: `pnpm --dir back exec jest configuration/configuration.service.spec.ts --runInBand`

Expected: the new test fails because the returned credential is `null`.

- [x] **Step 3: Add the minimal preservation logic**

```ts
const existingAiApiKey = this.databaseService.getPreference<string>('aiApiKey');
// Replace the ordinary configuration rows.
if (existingAiApiKey) this.databaseService.setPreference('aiApiKey', existingAiApiKey);
```

The read occurs before the existing `DELETE FROM app_preferences`; restoration happens after ordinary preferences are inserted and before the transaction returns.

- [x] **Step 4: Verify the regression test passes**

Run: `pnpm --dir back exec jest configuration/configuration.service.spec.ts --runInBand`

Expected: all configuration service tests pass.

- [x] **Step 5: Verify compilation**

Run: `pnpm --dir back run build`

Expected: Nest compilation exits with code 0.
