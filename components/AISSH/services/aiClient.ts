import { AgentConfig } from '../types';
import { useSSHStore } from '../store/useSSHStore';
import { sanitizeAiMessages } from './aiMessageSanitizer';
import {
  AI_TIMEOUT_ERROR_MESSAGE,
  createAiRequestTimeout,
} from './aiRequestTimeout';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiCompletionOptions {
  temperature?: number;
  responseFormat?: { type: 'json_object' };
  signal?: AbortSignal;
}

function getModelConfig(config: AgentConfig) {
  const baseUrl = config.customUrl?.trim();
  const model = config.customModelName?.trim();

  if (!baseUrl || !model) {
    throw new Error('请在“神经核心配置”中填写模型地址和模型名');
  }
  return { baseUrl, model };
}

function getKnownDevicePasswords(): string[] {
  const { servers, tempSessions } = useSSHStore.getState();
  return [
    ...servers.map((server) => server.password),
    ...Object.values(tempSessions).map((session) => session.password),
  ].filter((password): password is string => typeof password === 'string' && password.length > 0);
}

function sanitizeMessages(messages: AiMessage[]): AiMessage[] {
  return sanitizeAiMessages(messages, getKnownDevicePasswords());
}

async function backendBaseUrl(): Promise<string> {
  if (window.electron?.isElectron) {
    return `http://127.0.0.1:${await window.electron.getBackendPort()}`;
  }
  return import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:3001';
}

export async function saveApiKey(apiKey: string): Promise<void> {
  const response = await fetch(`${await backendBaseUrl()}/api/v1/ai/credential`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function complete(
  config: AgentConfig,
  messages: AiMessage[],
  options: AiCompletionOptions = {},
): Promise<string> {
  const timeout = createAiRequestTimeout(undefined, options.signal);
  try {
    const response = await fetch(`${await backendBaseUrl()}/api/v1/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeout.signal,
      body: JSON.stringify({
        config: getModelConfig(config),
        messages: sanitizeMessages(messages),
        temperature: options.temperature,
        responseFormat: options.responseFormat,
      }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const body = await response.json() as { content?: unknown };
    return typeof body.content === 'string' ? body.content : '';
  } catch (error) {
    if (timeout.didTimeout()) throw new Error(AI_TIMEOUT_ERROR_MESSAGE);
    throw error;
  } finally {
    timeout.dispose();
  }
}

export async function stream(
  config: AgentConfig,
  messages: AiMessage[],
  onChunk: (chunk: string) => void | Promise<void>,
  options: AiCompletionOptions = {},
): Promise<void> {
  const timeout = createAiRequestTimeout(undefined, options.signal);
  try {
    const response = await fetch(`${await backendBaseUrl()}/api/v1/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeout.signal,
      body: JSON.stringify({
        config: getModelConfig(config),
        messages: sanitizeMessages(messages),
        stream: true,
        temperature: options.temperature,
        responseFormat: options.responseFormat,
      }),
    });
    if (!response.ok) throw new Error(await readError(response));
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (value?.byteLength) timeout.reset();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const data = line.trim().replace(/^data:\s*/, '');
        if (!data || data === '[DONE]') continue;
        try {
          const content = (JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }> }).choices?.[0]?.delta?.content;
          if (typeof content === 'string') await onChunk(content);
        } catch {
          // Ignore provider keep-alive or non-JSON SSE lines.
        }
      }
      if (done) break;
    }
  } catch (error) {
    if (timeout.didTimeout()) throw new Error(AI_TIMEOUT_ERROR_MESSAGE);
    throw error;
  } finally {
    timeout.dispose();
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: unknown };
    if (typeof body.message === 'string') return body.message;
  } catch {
    // Fall through to status text.
  }
  return `AI 后端请求失败（${response.status}）`;
}
