import { Body, Controller, Delete, Post, Put, Res } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { AiService } from './ai.service';
import type { AiChatRequest } from './ai.types';
import { CredentialService } from './credential.service';

@Controller('api/v1/ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly credentialService: CredentialService,
  ) {}

  @Put('credential')
  async saveCredential(@Body() input: { apiKey?: unknown }): Promise<{ configured: true }> {
    await this.credentialService.setApiKey(input?.apiKey);
    return { configured: true };
  }

  @Delete('credential')
  async deleteCredential(): Promise<{ configured: false }> {
    await this.credentialService.clearApiKey();
    return { configured: false };
  }

  @Post('chat')
  async chat(@Body() input: AiChatRequest, @Res() response: Response): Promise<void> {
    const request = this.aiService.validateChatRequest(input);
    const upstream = await this.aiService.createChatCompletion(request);

    if (!request.stream) {
      response.status(200).json({ content: await this.aiService.readContent(upstream) });
      return;
    }

    response.status(200).set({
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (!upstream.body) {
      response.end();
      return;
    }
    Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(response);
  }
}
