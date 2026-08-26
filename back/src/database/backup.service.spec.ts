import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupService } from './backup.service';
import { DatabaseService } from './database.service';

describe('BackupService', () => {
  it('creates a SQLite snapshot in the local backups directory', async () => {
    const appDataDirectory = mkdtempSync(join(tmpdir(), 'aissh-backup-'));
    const database = new DatabaseService(appDataDirectory);
    database.setPreference('selectedPromptIds', ['p-linux']);
    const backupService = new BackupService(database, appDataDirectory);

    const backupPath = await backupService.createBackup();

    expect(backupPath).toMatch(/backups\/aissh-.*\.sqlite$/);
    expect(existsSync(backupPath)).toBe(true);
    database.close();
  });
});
