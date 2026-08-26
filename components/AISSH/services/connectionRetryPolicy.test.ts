import { shouldAbortConnection } from './connectionRetryPolicy';

describe('shouldAbortConnection', () => {
  it('allows a manual retry after previous failures', () => {
    expect(shouldAbortConnection('manual', 2)).toBe(false);
  });

  it('stops an automated batch target after two failures', () => {
    expect(shouldAbortConnection('batch', 2)).toBe(true);
  });
});
