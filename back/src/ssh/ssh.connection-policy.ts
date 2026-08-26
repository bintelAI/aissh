export enum SshErrorType {
  TIMEOUT = 'timeout',
  CONNECTION_REFUSED = 'connection_refused',
  NETWORK_ERROR = 'network_error',
  AUTH_FAILED = 'auth_failed',
  HOST_NOT_FOUND = 'host_not_found',
  HOST_KEY_REJECTED = 'host_key_rejected',
  HANDSHAKE_FAILED = 'handshake_failed',
  PERMISSION_DENIED = 'permission_denied',
  SHELL_FAILED = 'shell_failed',
  UNKNOWN = 'unknown',
}

interface SshErrorEvent {
  code?: string;
  level?: string;
  message?: string;
}

const RETRYABLE_ERRORS = new Set<SshErrorType>([
  SshErrorType.TIMEOUT,
  SshErrorType.CONNECTION_REFUSED,
  SshErrorType.NETWORK_ERROR,
  SshErrorType.HANDSHAKE_FAILED,
]);

export function classifyConnectionError(error: SshErrorEvent): SshErrorType {
  const message = error.message?.toLowerCase() ?? '';
  const code = error.code?.toUpperCase() ?? '';
  const level = error.level?.toLowerCase() ?? '';

  if (
    level === 'client-timeout' ||
    code === 'ETIMEDOUT' ||
    message.includes('timeout')
  ) {
    return SshErrorType.TIMEOUT;
  }
  if (code === 'ECONNREFUSED' || message.includes('econnrefused')) {
    return SshErrorType.CONNECTION_REFUSED;
  }
  if (
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    message.includes('enotfound')
  ) {
    return SshErrorType.HOST_NOT_FOUND;
  }
  if (
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'EPIPE'
  ) {
    return SshErrorType.NETWORK_ERROR;
  }
  if (
    message.includes('host verification failed') ||
    message.includes('host key verification failed')
  ) {
    return SshErrorType.HOST_KEY_REJECTED;
  }
  if (
    message.includes('authentication failed') ||
    message.includes('all configured authentication methods failed')
  ) {
    return SshErrorType.AUTH_FAILED;
  }
  if (message.includes('permission denied')) {
    return SshErrorType.PERMISSION_DENIED;
  }
  if (
    (message.includes('handshake') && message.includes('failed')) ||
    (message.includes('unable to exchange') &&
      message.includes('identification')) ||
    (message.includes('ssh protocol') && message.includes('mismatch')) ||
    (message.includes('key exchange') && message.includes('failed')) ||
    (message.includes('algorithm') &&
      message.includes('negotiation') &&
      message.includes('failed')) ||
    message.includes('invalid packet length')
  ) {
    return SshErrorType.HANDSHAKE_FAILED;
  }
  return SshErrorType.UNKNOWN;
}

export function shouldRetryConnection(
  errorType: SshErrorType,
  attempt: number,
): boolean {
  return attempt < 3 && isRetryableConnectionError(errorType);
}

export function isRetryableConnectionError(errorType: SshErrorType): boolean {
  return RETRYABLE_ERRORS.has(errorType);
}

export function getRetryDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const baseDelay = Math.min(2_000, 400 * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.min(1, Math.max(0, random())) * 300);
  return Math.min(2_000, baseDelay + jitter);
}

export function getConnectionErrorMessage(errorType: SshErrorType): string {
  const messages: Record<SshErrorType, string> = {
    [SshErrorType.TIMEOUT]: '连接超时，请检查网络或 IP 地址是否正确',
    [SshErrorType.CONNECTION_REFUSED]: '连接被拒绝，请检查 SSH 端口或服务状态',
    [SshErrorType.NETWORK_ERROR]: '网络连接中断，请检查网络和服务器状态',
    [SshErrorType.AUTH_FAILED]: '认证失败，请检查用户名、密码或密钥',
    [SshErrorType.HOST_NOT_FOUND]:
      '无法解析主机地址，请检查 IP 地址或 DNS 设置',
    [SshErrorType.HOST_KEY_REJECTED]: '主机密钥校验失败，请确认目标服务器身份',
    [SshErrorType.HANDSHAKE_FAILED]:
      '协议握手失败，可能是 SSH 版本或加密算法不兼容',
    [SshErrorType.PERMISSION_DENIED]: '权限被拒绝，请检查用户权限或 SSH 配置',
    [SshErrorType.SHELL_FAILED]: '远程终端启动失败，请检查服务器 shell 配置',
    [SshErrorType.UNKNOWN]: 'SSH 连接发生未知错误',
  };
  return messages[errorType];
}
