export type ConnectionAttemptSource = 'manual' | 'batch';

export function shouldAbortConnection(
  source: ConnectionAttemptSource,
  failureCount: number,
): boolean {
  return source === 'batch' && failureCount >= 2;
}
