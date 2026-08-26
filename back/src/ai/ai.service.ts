import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import type { AiChatRequest, AiMessage, ValidatedAiChatRequest } from './ai.types';
import { CredentialService } from './credential.service';
import { DatabaseService } from '../database/database.service';

const REDACTED_DEVICE_PASSWORD = '[设备密码已隐藏]';
const SENSITIVE_ASSIGNMENT = /(password|passwd|passphrase|private[_-]?key|secret)\s*[:=]\s*([^\s,;]+)/gi;
const SSHPASS_ARGUMENT = /(sshpass\s+-p\s+)([^\s]+)/gi;

@Injectable()
export class AiService {
  constructor(
    private readonly credentialService: CredentialService,
    private readonly databaseService: DatabaseService,
  ) {}

  validateChatRequest(input: AiChatRequest): ValidatedAiChatRequest {
    const baseUrl = this.readString(input.config?.baseUrl);
    const model = this.readString(input.config?.model);

    if (!baseUrl || !model) {
      throw new BadRequestException('AI model configuration is incomplete');
    }

    let endpoint: URL;
    try {
      endpoint = new URL(baseUrl);
    } catch {
      throw new BadRequestException('AI model base URL is invalid');
    }
    if (!['http:', 'https:'].includes(endpoint.protocol)) {
      throw new BadRequestException('AI model base URL is invalid');
    }

    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      throw new BadRequestException('AI messages are required');
    }
    const messages = this.sanitizeMessages(
      input.messages.map((message) => this.validateMessage(message)),
    );
    const temperature = typeof input.temperature === 'number' ? input.temperature : undefined;
    if (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
      throw new BadRequestException('AI temperature is invalid');
    }
    const responseFormat = input.responseFormat;
    if (responseFormat !== undefined && (!this.isJsonObject(responseFormat) || responseFormat.type !== 'json_object')) {
      throw new BadRequestException('AI response format is invalid');
    }

    return {
      config: { baseUrl: endpoint.toString().replace(/\/$/, ''), model },
      messages,
      stream: input.stream === true,
      temperature,
      responseFormat: responseFormat as { type: 'json_object' } | undefined,
    };
  }

  async createChatCompletion(input: ValidatedAiChatRequest): Promise<Response> {
    const apiKey = await this.credentialService.getApiKey();
    if (!apiKey) throw new BadRequestException('AI API key is not configured');

    let response: Response;
    try {
      response = await fetch(`${input.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.config.model,
          messages: input.messages,
          stream: input.stream,
          ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
          ...(input.responseFormat === undefined ? {} : { response_format: input.responseFormat }),
        }),
      });
    } catch {
      throw new BadGatewayException('AI model service is unavailable');
    }

    if (!response.ok) {
      const summary = await this.readUpstreamErrorSummary(response);
      const suffix = summary ? `: ${summary}` : '';
      throw new BadGatewayException(`AI model service returned ${response.status}${suffix}`);
    }
    return response;
  }

  async readContent(response: Response): Promise<string> {
    const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = body.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : '';
  }

  private validateMessage(message: unknown): AiMessage {
    if (!this.isJsonObject(message) || !this.isRole(message.role) || typeof message.content !== 'string') {
      throw new BadRequestException('AI message is invalid');
    }
    return { role: message.role, content: message.content };
  }

  private sanitizeMessages(messages: AiMessage[]): AiMessage[] {
    const passwords = [...new Set(this.databaseService.getServerPasswords())]
      .filter((password) => password.length > 0)
      .sort((left, right) => right.length - left.length);

    return messages.map((message) => {
      let content = message.content;
      for (const password of passwords) content = content.split(password).join(REDACTED_DEVICE_PASSWORD);
      content = content.replace(SENSITIVE_ASSIGNMENT, `$1=${REDACTED_DEVICE_PASSWORD}`);
      return { ...message, content: content.replace(SSHPASS_ARGUMENT, `$1${REDACTED_DEVICE_PASSWORD}`) };
    });
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private isRole(value: unknown): value is AiMessage['role'] {
    return value === 'system' || value === 'user' || value === 'assistant';
  }

  private isJsonObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private async readUpstreamErrorSummary(response: Response): Promise<string> {
    try {
      const body = await response.json() as {
        error?: { message?: unknown };
        message?: unknown;
      };
      const message = body.error?.message ?? body.message;
      if (typeof message !== 'string' || !message.trim()) return '';
      return message.trim().replace(/\s+/g, ' ').slice(0, 240);
    } catch {
      return '';
    }
  }
}
