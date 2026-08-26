export const AI_RESPONSE_TIMEOUT_MS = 2 * 60 * 1000;
export const AI_TIMEOUT_ERROR_MESSAGE = 'AI 响应超过 2 分钟未收到数据，已终止请求';

interface AiRequestTimeout {
  signal: AbortSignal;
  reset: () => void;
  didTimeout: () => boolean;
  dispose: () => void;
}

export function createAiRequestTimeout(
  timeoutMs: number = AI_RESPONSE_TIMEOUT_MS,
  parentSignal?: AbortSignal,
): AiRequestTimeout {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  const onParentAbort = () => controller.abort(parentSignal?.reason);
  const reset = () => {
    if (controller.signal.aborted) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(AI_TIMEOUT_ERROR_MESSAGE));
    }, timeoutMs);
  };

  if (parentSignal?.aborted) {
    onParentAbort();
  } else {
    parentSignal?.addEventListener('abort', onParentAbort, { once: true });
    reset();
  }

  return {
    signal: controller.signal,
    reset,
    didTimeout: () => timedOut,
    dispose: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}
