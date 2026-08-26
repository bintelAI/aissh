import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { AiSessionsService } from './ai-sessions.service';

describe('AiSessionsService', () => {
  function createService(): { database: DatabaseService; service: AiSessionsService } {
    const database = new DatabaseService(mkdtempSync(join(tmpdir(), 'aissh-ai-sessions-')));
    return { database, service: new AiSessionsService(database) };
  }

  it('creates sessions and filters them by server', () => {
    const { database, service } = createService();

    const first = service.createSession({ serverId: 'server-1', title: 'Linux', mode: 'chat' });
    service.createSession({ serverId: 'server-2', title: 'Network', mode: 'action' });

    expect(service.listSessions('server-1')).toEqual([first]);
    expect(service.listSessions()).toHaveLength(2);
    database.close();
  });

  it('persists, updates, and clears messages while updating the session timestamp', () => {
    const { database, service } = createService();

    const session = service.createSession({ serverId: null, title: 'General', mode: 'chat' });
    const message = service.createMessage(session.id, { role: 'user', content: '检查 CPU' });
    const updated = service.updateMessage(session.id, message.id, { content: '检查 CPU 负载' });

    expect(service.listMessages(session.id)).toEqual([updated]);
    expect(service.clearMessages(session.id)).toEqual({ deleted: 1 });
    expect(service.listMessages(session.id)).toEqual([]);
    database.close();
  });

  it('deletes a session and cascades its messages', () => {
    const { database, service } = createService();

    const session = service.createSession({ title: 'Delete me' });
    service.createMessage(session.id, { role: 'assistant', content: '已删除' });
    service.deleteSession(session.id);

    expect(service.listSessions()).toEqual([]);
    expect(() => service.listMessages(session.id)).toThrow('session not found');
    database.close();
  });

  it('rejects invalid session and message input', () => {
    const { database, service } = createService();

    expect(() => service.createSession({ title: '', mode: 'chat' })).toThrow('title');
    expect(() => service.createSession({ title: 'Bad mode', mode: 'invalid' })).toThrow('mode');
    expect(() => service.createMessage('missing', { role: 'user', content: 'hello' })).toThrow('session not found');

    database.close();
  });
});
