import { Global, Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { DatabaseService } from './database.service';
import { MaintenanceController } from './maintenance.controller';

@Global()
@Module({
  controllers: [MaintenanceController],
  providers: [DatabaseService, BackupService],
  exports: [DatabaseService, BackupService],
})
export class DatabaseModule {}
