import { Controller, Post } from '@nestjs/common';
import { BackupService } from './backup.service';

@Controller('api/v1/maintenance')
export class MaintenanceController {
  constructor(private readonly backupService: BackupService) {}

  @Post('backup')
  async backup(): Promise<{ path: string }> {
    return { path: await this.backupService.createBackup() };
  }
}
