import { shouldShowServerTree } from './appLayout';

describe('application view layout', () => {
  it('shows the server tree only in the workspace', () => {
    expect(shouldShowServerTree('workspace')).toBe(true);
    expect(shouldShowServerTree('logs')).toBe(false);
    expect(shouldShowServerTree('settings')).toBe(false);
  });
});
