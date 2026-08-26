import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { OperationLogsService } from './operation-logs.service';
import type { CreateOperationLogInput, StoredOperationLog } from './operation-logs.types';

@Controller('api/v1/operation-logs')
export class OperationLogsController {
  constructor(private readonly operationLogsService: OperationLogsService) {}

  @Post()
  create(@Body() input: CreateOperationLogInput): StoredOperationLog {
    return this.operationLogsService.create(input);
  }

  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('serverId') serverId?: string,
    @Query('sessionId') sessionId?: string,
  ): StoredOperationLog[] {
    return this.operationLogsService.findAll({ limit, serverId, sessionId });
  }

  @Delete()
  clear(@Query('serverId') serverId?: string): { deleted: number } {
    return this.operationLogsService.clear(serverId);
  }
}
