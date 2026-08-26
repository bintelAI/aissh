import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiSessionsController } from './ai-sessions.controller';
import { AiSessionsService } from './ai-sessions.service';
import { CredentialService } from './credential.service';

@Module({
  controllers: [AiController, AiSessionsController],
  providers: [AiService, AiSessionsService, CredentialService],
})
export class AiModule {}
