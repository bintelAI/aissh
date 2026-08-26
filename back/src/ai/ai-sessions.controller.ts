import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AiSessionsService } from './ai-sessions.service';
import type { UpdateAiChatMessageInput } from './ai-sessions.service';
import type {
  AiChatMessage,
  AiChatSession,
  CreateAiChatMessageInput,
  CreateAiChatSessionInput,
  UpdateAiChatSessionInput,
} from './sessions.types';

@Controller('api/v1/ai/sessions')
export class AiSessionsController {
  constructor(private readonly aiSessionsService: AiSessionsService) {}

  @Get()
  listSessions(@Query('serverId') serverId?: string): AiChatSession[] {
    return this.aiSessionsService.listSessions(serverId);
  }

  @Post()
  createSession(@Body() input: CreateAiChatSessionInput): AiChatSession {
    return this.aiSessionsService.createSession(input);
  }

  @Patch(':sessionId')
  updateSession(
    @Param('sessionId') sessionId: string,
    @Body() input: UpdateAiChatSessionInput,
  ): AiChatSession {
    return this.aiSessionsService.updateSession(sessionId, input);
  }

  @Delete(':sessionId')
  deleteSession(@Param('sessionId') sessionId: string): { deleted: true } {
    this.aiSessionsService.deleteSession(sessionId);
    return { deleted: true };
  }

  @Get(':sessionId/messages')
  listMessages(@Param('sessionId') sessionId: string): AiChatMessage[] {
    return this.aiSessionsService.listMessages(sessionId);
  }

  @Post(':sessionId/messages')
  createMessage(
    @Param('sessionId') sessionId: string,
    @Body() input: CreateAiChatMessageInput,
  ): AiChatMessage {
    return this.aiSessionsService.createMessage(sessionId, input);
  }

  @Patch(':sessionId/messages/:messageId')
  updateMessage(
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Body() input: UpdateAiChatMessageInput,
  ): AiChatMessage {
    return this.aiSessionsService.updateMessage(sessionId, messageId, input);
  }

  @Delete(':sessionId/messages')
  clearMessages(@Param('sessionId') sessionId: string): { deleted: number } {
    return this.aiSessionsService.clearMessages(sessionId);
  }
}
