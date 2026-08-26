import type { AiMessage } from './aiClient';

export const REDACTED_DEVICE_PASSWORD = '[设备密码已隐藏]';

const SENSITIVE_ASSIGNMENT = /(password|passwd|passphrase|private[_-]?key|secret)\s*[:=]\s*([^\s,;]+)/gi;
const SSHPASS_ARGUMENT = /(sshpass\s+-p\s+)([^\s]+)/gi;

export function sanitizeAiContent(content: string, secrets: readonly string[] = []): string {
  let sanitized = content;
  const uniqueSecrets = [...new Set(secrets.filter((secret) => secret.trim()))]
    .sort((left, right) => right.length - left.length);

  for (const secret of uniqueSecrets) {
    sanitized = sanitized.split(secret).join(REDACTED_DEVICE_PASSWORD);
  }

  sanitized = sanitized.replace(SENSITIVE_ASSIGNMENT, `$1=${REDACTED_DEVICE_PASSWORD}`);
  return sanitized.replace(SSHPASS_ARGUMENT, `$1${REDACTED_DEVICE_PASSWORD}`);
}

export function sanitizeAiMessages(messages: readonly AiMessage[], secrets: readonly string[] = []): AiMessage[] {
  return messages.map((message) => ({
    ...message,
    content: sanitizeAiContent(message.content, secrets),
  }));
}
