import { Injectable } from '@nestjs/common';
import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { Server } from 'socket.io';
import {
  classifyConnectionError,
  getConnectionErrorMessage,
  getRetryDelay,
  isRetryableConnectionError,
  shouldRetryConnection,
  SshErrorType,
} from './ssh.connection-policy';

export { SshErrorType } from './ssh.connection-policy';

export class SshConnectionConfig {
  ip: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  serverId: string;
  connectionId?: string;
  algorithms?: ConnectConfig['algorithms'];
  hostVerifier?: ConnectConfig['hostVerifier'];
}

type SessionState = 'connecting' | 'connected';

interface ManagedSession {
  attempt: number;
  client?: Client;
  generation: number;
  retryTimer?: ReturnType<typeof setTimeout>;
  state: SessionState;
  stream?: ClientChannel;
}

@Injectable()
export class SshService {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly termTypes = ['xterm-256color', 'xterm', 'vt100', 'linux'];
  private createClient: () => Client = () => new Client();
  private generation = 0;

  static createForTesting(createClient: () => Client): SshService {
    const service = new SshService();
    service.createClient = createClient;
    return service;
  }

  createConnection(
    socketId: string,
    config: SshConnectionConfig,
    server: Server,
  ): void {
    const sessionKey = this.getSessionKey(socketId, config.serverId);
    this.cancelSession(sessionKey);

    const session: ManagedSession = {
      attempt: 0,
      generation: ++this.generation,
      state: 'connecting',
    };
    this.sessions.set(sessionKey, session);
    this.startAttempt(sessionKey, session, socketId, config, server);
  }

  executeCommand(socketId: string, serverId: string, command: string): void {
    const session = this.sessions.get(this.getSessionKey(socketId, serverId));
    if (session?.stream) {
      session.stream.write(command.endsWith('\n') ? command : `${command}\n`);
    }
  }

  writeToStream(socketId: string, serverId: string, data: string): void {
    this.sessions
      .get(this.getSessionKey(socketId, serverId))
      ?.stream?.write(data);
  }

  resize(socketId: string, serverId: string, cols: number, rows: number): void {
    this.sessions
      .get(this.getSessionKey(socketId, serverId))
      ?.stream?.setWindow(rows, cols, 0, 0);
  }

  async exec(
    socketId: string,
    serverId: string,
    command: string,
  ): Promise<string> {
    const session = this.sessions.get(this.getSessionKey(socketId, serverId));
    if (!session?.client || session.state !== 'connected') {
      throw new Error('Session not found or disconnected');
    }

    return new Promise((resolve, reject) => {
      session.client?.exec(command, (error, stream) => {
        if (error) return reject(error);
        let output = '';
        stream.on('close', () => resolve(output));
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        stream.stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });
      });
    });
  }

  disconnect(socketId: string, serverId: string): void {
    const sessionKey = this.getSessionKey(socketId, serverId);
    if (!this.cancelSession(sessionKey)) return;
  }

  disconnectAll(socketId: string): void {
    for (const key of [...this.sessions.keys()]) {
      if (key.startsWith(`${socketId}:`)) this.cancelSession(key);
    }
  }

  private startAttempt(
    sessionKey: string,
    session: ManagedSession,
    socketId: string,
    config: SshConnectionConfig,
    server: Server,
  ): void {
    if (!this.isActive(sessionKey, session)) return;

    session.retryTimer = undefined;
    session.attempt += 1;
    session.state = 'connecting';
    const client = this.createClient();
    session.client = client;
    const attempt = session.attempt;
    let terminalReady = false;
    let failed = false;

    this.emitStatus(server, socketId, config.serverId, 'connecting', {
      attempt,
      stage: attempt === 1 ? 'connecting' : 'retrying',
      message:
        attempt === 1
          ? '正在建立 SSH 连接'
          : `正在进行第 ${attempt} 次连接尝试`,
    });

    const fail = (error: unknown, errorType?: SshErrorType): void => {
      if (
        failed ||
        !this.isActive(sessionKey, session) ||
        session.client !== client
      )
        return;
      failed = true;
      this.handleAttemptFailure(
        sessionKey,
        session,
        socketId,
        config,
        server,
        errorType ?? classifyConnectionError(this.toErrorEvent(error)),
      );
    };

    client.on('ready', () => {
      if (
        !this.isActive(sessionKey, session) ||
        session.client !== client ||
        failed
      )
        return;
      this.tryShell(
        client,
        sessionKey,
        session,
        socketId,
        config,
        server,
        () => {
          terminalReady = true;
        },
        fail,
      );
    });
    client.on(
      'keyboard-interactive',
      (_name, _instructions, _lang, prompts, finish) => {
        finish(
          config.password && prompts.length
            ? prompts.map(() => config.password as string)
            : [],
        );
      },
    );
    client.on('error', fail);
    client.on('end', () => {
      if (
        !this.isActive(sessionKey, session) ||
        session.client !== client ||
        failed
      )
        return;
      if (!terminalReady)
        fail(
          new Error('SSH connection ended before the terminal was ready'),
          SshErrorType.NETWORK_ERROR,
        );
      else
        this.handleUnexpectedDisconnect(
          sessionKey,
          session,
          socketId,
          config.serverId,
          server,
        );
    });
    client.on('close', () => {
      if (
        !this.isActive(sessionKey, session) ||
        session.client !== client ||
        failed
      )
        return;
      if (!terminalReady)
        fail(
          new Error('SSH connection closed before the terminal was ready'),
          SshErrorType.NETWORK_ERROR,
        );
      else
        this.handleUnexpectedDisconnect(
          sessionKey,
          session,
          socketId,
          config.serverId,
          server,
        );
    });

    try {
      client.connect(this.toConnectConfig(config));
    } catch (error) {
      fail(error);
    }
  }

  private tryShell(
    client: Client,
    sessionKey: string,
    session: ManagedSession,
    socketId: string,
    config: SshConnectionConfig,
    server: Server,
    onReady: () => void,
    onFailure: (error: unknown, errorType?: SshErrorType) => void,
    termIndex = 0,
  ): void {
    if (termIndex >= this.termTypes.length) {
      onFailure(
        new Error('No compatible terminal type'),
        SshErrorType.SHELL_FAILED,
      );
      return;
    }

    client.shell(
      { term: this.termTypes[termIndex], rows: 24, cols: 80 },
      (error, stream) => {
        if (!this.isActive(sessionKey, session) || session.client !== client)
          return;
        if (error) {
          if (termIndex + 1 < this.termTypes.length) {
            this.tryShell(
              client,
              sessionKey,
              session,
              socketId,
              config,
              server,
              onReady,
              onFailure,
              termIndex + 1,
            );
          } else {
            onFailure(error, SshErrorType.SHELL_FAILED);
          }
          return;
        }

        session.stream = stream;
        session.state = 'connected';
        onReady();
        this.emitStatus(server, socketId, config.serverId, 'connected', {
          attempt: session.attempt,
          stage: 'ready',
          message: `已连接到 ${config.ip}`,
        });

        stream.on('close', () => {
          if (!this.isActive(sessionKey, session) || session.stream !== stream)
            return;
          this.handleUnexpectedDisconnect(
            sessionKey,
            session,
            socketId,
            config.serverId,
            server,
          );
          client.end();
        });
        stream.on('data', (data: Buffer) => {
          if (this.isActive(sessionKey, session)) {
            server.to(socketId).emit('ssh-data', {
              serverId: config.serverId,
              data: data.toString('utf-8'),
            });
          }
        });
        stream.stderr.on('data', (data: Buffer) => {
          if (this.isActive(sessionKey, session)) {
            server.to(socketId).emit('ssh-data', {
              serverId: config.serverId,
              data: data.toString('utf-8'),
            });
          }
        });
      },
    );
  }

  private handleAttemptFailure(
    sessionKey: string,
    session: ManagedSession,
    socketId: string,
    config: SshConnectionConfig,
    server: Server,
    errorType: SshErrorType,
  ): void {
    const retryable = shouldRetryConnection(errorType, session.attempt);
    if (!retryable) {
      this.sessions.delete(sessionKey);
      session.client?.end();
      server.to(socketId).emit('ssh-error', {
        serverId: config.serverId,
        errorType,
        message: getConnectionErrorMessage(errorType),
        retryable: isRetryableConnectionError(errorType),
        final: true,
        attempt: session.attempt,
      });
      return;
    }

    const delay = getRetryDelay(session.attempt);
    this.emitStatus(server, socketId, config.serverId, 'connecting', {
      attempt: session.attempt,
      stage: 'retrying',
      message: `${getConnectionErrorMessage(errorType)}，${Math.ceil(delay / 1000)} 秒后重试`,
    });
    session.client?.end();
    session.client = undefined;
    session.retryTimer = setTimeout(() => {
      this.startAttempt(sessionKey, session, socketId, config, server);
    }, delay);
  }

  private handleUnexpectedDisconnect(
    sessionKey: string,
    session: ManagedSession,
    socketId: string,
    serverId: string,
    server: Server,
  ): void {
    if (!this.isActive(sessionKey, session)) return;
    this.sessions.delete(sessionKey);
    this.emitStatus(server, socketId, serverId, 'disconnected', {
      attempt: session.attempt,
      stage: 'disconnected',
      message: 'SSH 连接已断开，请手动重试',
    });
  }

  private cancelSession(sessionKey: string): boolean {
    const session = this.sessions.get(sessionKey);
    if (!session) return false;
    this.sessions.delete(sessionKey);
    if (session.retryTimer) clearTimeout(session.retryTimer);
    session.stream?.close();
    session.client?.end();
    return true;
  }

  private emitStatus(
    server: Server,
    socketId: string,
    serverId: string,
    status: 'connecting' | 'connected' | 'disconnected',
    details: { attempt: number; stage: string; message?: string },
  ): void {
    server.to(socketId).emit('ssh-status', { serverId, status, ...details });
  }

  private isActive(sessionKey: string, session: ManagedSession): boolean {
    return this.sessions.get(sessionKey)?.generation === session.generation;
  }

  private toErrorEvent(error: unknown): {
    code?: string;
    level?: string;
    message?: string;
  } {
    if (error instanceof Error) {
      return Object.assign({ message: error.message }, error);
    }
    return { message: String(error) };
  }

  private toConnectConfig(config: SshConnectionConfig): ConnectConfig {
    return {
      host: config.ip,
      port: config.port ?? 22,
      username: config.username,
      password: config.password,
      privateKey: config.privateKey,
      passphrase: config.passphrase,
      algorithms: config.algorithms ?? this.getCompatibleAlgorithms(),
      hostVerifier: config.hostVerifier,
      readyTimeout: 20_000,
      keepaliveInterval: 60_000,
      keepaliveCountMax: 3,
      tryKeyboard: true,
    };
  }

  private getCompatibleAlgorithms(): ConnectConfig['algorithms'] {
    return {
      kex: [
        'curve25519-sha256',
        'curve25519-sha256@libssh.org',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521',
        'diffie-hellman-group-exchange-sha256',
        'diffie-hellman-group14-sha256',
        'diffie-hellman-group15-sha512',
        'diffie-hellman-group16-sha512',
        'diffie-hellman-group18-sha512',
        'diffie-hellman-group14-sha1',
      ],
      cipher: [
        'aes256-gcm@openssh.com',
        'aes128-gcm@openssh.com',
        'aes256-ctr',
        'aes192-ctr',
        'aes128-ctr',
        'aes256-cbc',
        'aes192-cbc',
        'aes128-cbc',
        '3des-cbc',
      ],
      serverHostKey: [
        'ssh-ed25519',
        'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521',
        'rsa-sha2-512',
        'rsa-sha2-256',
        'ssh-rsa',
      ],
      hmac: [
        'hmac-sha2-256-etm@openssh.com',
        'hmac-sha2-512-etm@openssh.com',
        'hmac-sha2-256',
        'hmac-sha2-512',
        'hmac-sha1',
      ],
    };
  }

  private getSessionKey(socketId: string, serverId: string): string {
    return `${socketId}:${serverId}`;
  }
}
