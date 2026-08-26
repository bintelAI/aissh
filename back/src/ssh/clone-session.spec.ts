jest.mock('../../../components/AISSH/services/operationLogService', () => ({
  appendOperationLog: jest.fn(),
  clearOperationLogs: jest.fn(),
}));

import { useSSHStore } from '../../../components/AISSH/store/useSSHStore';

describe('temporary SSH sessions', () => {
  beforeEach(() => {
    useSSHStore.setState({
      servers: [
        {
          id: 'server-1',
          name: 'Production',
          ip: '10.0.0.1',
          username: 'root',
          hasCredential: true,
          port: 22,
          status: 'connected',
          parentId: null,
        },
      ],
      openSessions: ['server-1'],
      activeSessionId: 'server-1',
      tempSessions: {},
      connectionStatus: { 'server-1': 'connected' },
      failureCounts: {},
    });
  });

  it('preserves backend credential availability when cloning a session', () => {
    useSSHStore.getState().createTempSessionFrom('server-1');

    const clonedSessionId = useSSHStore.getState().activeSessionId as string;
    const clonedSession = useSSHStore.getState().tempSessions[clonedSessionId];

    expect(clonedSession).toMatchObject({
      baseId: 'server-1',
      hasCredential: true,
    });
    expect(clonedSession.password).toBeUndefined();
  });
});
