import { Controller, Get, Query } from '@nestjs/common';
import { ConnectionSessionsService } from './connection-sessions.service';
import type { ConnectionSessionPage } from './connection-sessions.types';

@Controller('api/v1/connection-sessions')
export class ConnectionSessionsController {
  constructor(private readonly connectionSessionsService: ConnectionSessionsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): ConnectionSessionPage {
    return this.connectionSessionsService.list({ page, pageSize });
  }
}
