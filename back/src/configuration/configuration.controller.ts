import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import type { ConfigurationInput, StoredConfiguration } from './configuration.types';
import { BackupService } from '../database/backup.service';

@Controller('api/v1/configuration')
export class ConfigurationController {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly backupService: BackupService,
  ) {}

  @Get()
  read(): StoredConfiguration {
    return this.configurationService.read();
  }

  @Put()
  replace(@Body() input: ConfigurationInput): StoredConfiguration {
    return this.replaceConfiguration(input);
  }

  @Post('import-local')
  importLocal(@Body() input: ConfigurationInput): StoredConfiguration {
    if (!this.configurationService.isEmpty()) {
      throw new BadRequestException('local SQLite configuration is not empty');
    }
    return this.replaceConfiguration(input);
  }

  @Put('servers/:serverId/credential')
  saveServerCredential(@Param('serverId') serverId: string, @Body() input: { password?: unknown }): StoredConfiguration['servers'][number] {
    try {
      return this.configurationService.saveServerCredential(serverId, input?.password);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'invalid server credential');
    }
  }

  @Delete('servers/:serverId/credential')
  clearServerCredential(@Param('serverId') serverId: string): StoredConfiguration['servers'][number] {
    try {
      return this.configurationService.clearServerCredential(serverId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'invalid server credential');
    }
  }

  @Post('import')
  async import(@Body() input: ConfigurationInput): Promise<StoredConfiguration> {
    try {
      this.configurationService.validate(input);
      await this.backupService.createBackup();
      return this.configurationService.replace(input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'invalid configuration');
    }
  }

  private replaceConfiguration(input: ConfigurationInput): StoredConfiguration {
    try {
      return this.configurationService.replace(input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'invalid configuration');
    }
  }
}
