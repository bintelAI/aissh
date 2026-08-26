import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_RESPONSE_TIMEOUT_MS, createAiRequestTimeout } from './aiRequestTimeout.ts';

test('aborts an AI request after two minutes without activity', async () => {
  assert.equal(AI_RESPONSE_TIMEOUT_MS, 120_000);
  const timeout = createAiRequestTimeout(20);

  const abortPromise = new Promise<AbortSignal>((resolve) => {
    timeout.signal.addEventListener('abort', () => resolve(timeout.signal), { once: true });
  });

  await new Promise((resolve) => setTimeout(resolve, 40));
  const signal = await abortPromise;

  assert.equal(signal.aborted, true);
  assert.equal(timeout.didTimeout(), true);
  timeout.dispose();
});

test('resets the inactivity timeout when a stream receives data', async () => {
  const timeout = createAiRequestTimeout(40);
  let aborted = false;
  timeout.signal.addEventListener('abort', () => {
    aborted = true;
  }, { once: true });

  await new Promise((resolve) => setTimeout(resolve, 20));
  timeout.reset();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(aborted, false);
  timeout.dispose();
});
