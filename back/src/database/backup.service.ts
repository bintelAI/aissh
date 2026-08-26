import { Injectable, Optional } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { backup } from 'node:sqlite';
import { DatabaseService } from './database.service';

@Injectable()
export class BackupService {
  private readonly backupsDirectory: string;

  constructor(
    private readonly databaseService: DatabaseService,
    @Optional() appDataDirectory?: string,
  ) {
    appDataDirectory ??= process.env.APP_DATA_DIR ?? join(process.cwd(), '.aissh');
    this.backupsDirectory = join(appDataDirectory, 'backups');
    mkdirSync(this.backupsDirectory, { recursive: true });
  }

  async createBackup(): Promise<string> {
    const backupPath = join(this.backupsDirectory, `aissh-${this.timestamp()}.sqlite`);
    await backup(this.databaseService.connection, backupPath);
    this.trimScheduledBackups();
    return backupPath;
  }

  private trimScheduledBackups(): void {
    const backups = readdirSync(this.backupsDirectory)
      .filter((name) => /^aissh-.*\.sqlite$/.test(name))
      .sort()
      .reverse();

    backups.slice(7).forEach((name) => {
      const path = join(this.backupsDirectory, name);
      if (existsSync(path)) rmSync(path);
    });
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}
