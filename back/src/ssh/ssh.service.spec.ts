import { EventEmitter } from 'node:events';
import { Client, ClientChannel } from 'ssh2';
import { Server } from 'socket.io';
import { SshConnectionConfig, SshService } from './ssh.service';

class FakeClient extends EventEmitter {
  readonly connect = jest.fn();
  readonly end = jest.fn();
  readonly shell = jest.fn();
  readonly exec = jest.fn();
}

const config: SshConnectionConfig = {
  ip: '10.0.0.1',
  username: 'root',
  password: 'secret',
  serverId: 'server-1',
};

function createServer() {
  const emit = jest.fn();
  return {
    server: { to: jest.fn(() => ({ emit })) } as unknown as Server,
    emit,
  };
}

describe('SshService', () => {
  afterEach(() => jest.useRealTimers());

  it('retries a refused connection up to three attempts', () => {
    jest.useFakeTimers();
    const attempts = [new FakeClient(), new FakeClient(), new FakeClient()];
    const clients = [...attempts];
    const service = SshService.createForTesting(
      () => clients.shift() as unknown as Client,
    );
    const { server, emit } = createServer();

    service.createConnection('socket-1', config, server);
    attempts[0].emit(
      'error',
      Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    );
    jest.runOnlyPendingTimers();
    attempts[1].emit(
      'error',
      Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    );
    jest.runOnlyPendingTimers();
    attempts[2].emit(
      'error',
      Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    );

    expect(emit).toHaveBeenLastCalledWith(
      'ssh-error',
      expect.objectContaining({
        errorType: 'connection_refused',
        final: true,
        attempt: 3,
      }),
    );
  });

  it('ignores late events from a replaced connection generation', () => {
    const first = new FakeClient();
    const second = new FakeClient();
    const clients = [first, second];
    const service = SshService.createForTesting(() => {
      const client = clients.shift();
      if (!client) throw new Error('No fake client available');
      return client as unknown as Client;
    });
    const { server, emit } = createServer();

    service.createConnection('socket-1', config, server);
    service.createConnection('socket-1', config, server);
    first.emit('error', new Error('ECONNREFUSED'));

    expect(emit).not.toHaveBeenCalledWith(
      'ssh-error',
      expect.objectContaining({ attempt: 1 }),
    );
    expect(first.end).toHaveBeenCalled();
  });

  it('cancels scheduled retries when the user disconnects', () => {
    jest.useFakeTimers();
    const first = new FakeClient();
    const factory = jest.fn(() => first as unknown as Client);
    const service = SshService.createForTesting(factory);
    const { server } = createServer();

    service.createConnection('socket-1', config, server);
    first.emit(
      'error',
      Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    );
    service.disconnect('socket-1', config.serverId);
    jest.runOnlyPendingTimers();

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('does not report connected until the interactive shell is ready', () => {
    const client = new FakeClient();
    const stream = new EventEmitter() as ClientChannel;
    Object.assign(stream, { stderr: new EventEmitter() });
    client.shell.mockImplementation(
      (
        _options: unknown,
        callback: (error?: Error, stream?: ClientChannel) => void,
      ) => {
        callback(undefined, stream);
        return client as never;
      },
    );
    const service = SshService.createForTesting(
      () => client as unknown as Client,
    );
    const { server, emit } = createServer();

    service.createConnection('socket-1', config, server);
    client.emit('ready');

    expect(emit).toHaveBeenCalledWith(
      'ssh-status',
      expect.objectContaining({
        status: 'connected',
        stage: 'ready',
        attempt: 1,
      }),
    );
  });
});
