import { Module } from '@nestjs/common';
import { ConnectionSessionsModule } from '../connection-sessions/connection-sessions.module';
import { SshService } from './ssh.service';
import { SshGateway } from './ssh.gateway';

@Module({
  imports: [ConnectionSessionsModule],
  providers: [SshService, SshGateway],
})
export class SshModule {}
