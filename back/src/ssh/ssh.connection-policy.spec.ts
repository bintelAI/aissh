import {
  classifyConnectionError,
  getRetryDelay,
  isRetryableConnectionError,
  SshErrorType,
  shouldRetryConnection,
} from './ssh.connection-policy';

describe('SSH connection policy', () => {
  it('retries transient transport failures but not authentication failures', () => {
    expect(
      classifyConnectionError({ message: 'connect ECONNREFUSED 10.0.0.1:22' }),
    ).toBe(SshErrorType.CONNECTION_REFUSED);
    expect(shouldRetryConnection(SshErrorType.CONNECTION_REFUSED, 1)).toBe(
      true,
    );

    expect(
      classifyConnectionError({
        message: 'All configured authentication methods failed',
      }),
    ).toBe(SshErrorType.AUTH_FAILED);
    expect(shouldRetryConnection(SshErrorType.AUTH_FAILED, 1)).toBe(false);
  });

  it('stops after the third connection attempt', () => {
    expect(shouldRetryConnection(SshErrorType.TIMEOUT, 1)).toBe(true);
    expect(shouldRetryConnection(SshErrorType.TIMEOUT, 2)).toBe(true);
    expect(shouldRetryConnection(SshErrorType.TIMEOUT, 3)).toBe(false);
    expect(isRetryableConnectionError(SshErrorType.TIMEOUT)).toBe(true);
    expect(isRetryableConnectionError(SshErrorType.AUTH_FAILED)).toBe(false);
  });

  it('uses capped exponential backoff with bounded jitter', () => {
    expect(getRetryDelay(1, () => 0)).toBe(400);
    expect(getRetryDelay(2, () => 1)).toBe(1100);
    expect(getRetryDelay(3, () => 0.5)).toBe(1750);
  });
});
