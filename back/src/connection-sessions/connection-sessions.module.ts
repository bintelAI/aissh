import { Module } from '@nestjs/common';
import { ConnectionSessionsController } from './connection-sessions.controller';
import { ConnectionSessionsService } from './connection-sessions.service';

@Module({
  controllers: [ConnectionSessionsController],
  providers: [ConnectionSessionsService],
  exports: [ConnectionSessionsService],
})
export class ConnectionSessionsModule {}
