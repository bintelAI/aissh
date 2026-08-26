import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigurationModule } from './configuration/configuration.module';
import { DatabaseModule } from './database/database.module';
import { OperationLogsModule } from './operation-logs/operation-logs.module';
import { SshModule } from './ssh/ssh.module';

@Module({
  imports: [DatabaseModule, ConfigurationModule, OperationLogsModule, SshModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
