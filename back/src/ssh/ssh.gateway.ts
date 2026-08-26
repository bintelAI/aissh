import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SshService, SshConnectionConfig } from './ssh.service';
import { DatabaseService } from '../database/database.service';
import { ConnectionSessionsService } from '../connection-sessions/connection-sessions.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'null'],
  },
})
export class SshGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly sshService: SshService,
    private readonly databaseService: DatabaseService,
    private readonly connectionSessionsService: ConnectionSessionsService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.sshService.disconnectAll(client.id);
  }

  @SubscribeMessage('ssh-connect')
  handleConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() config: SshConnectionConfig,
  ): void {
    const savedTarget = this.databaseService.findServer(
      config.serverId.split('#')[0],
    );
    if (!savedTarget || !savedTarget.password) {
      if (savedTarget && config.auditSessionId) {
        this.connectionSessionsService.start({
          id: config.auditSessionId,
          serverId: config.serverId.split('#')[0],
          deviceName: savedTarget.name,
          serverIp: savedTarget.host,
          username: savedTarget.username,
        });
        this.connectionSessionsService.finish(
          config.auditSessionId,
          'failed',
          '服务器凭据未在后端配置，请先保存密码',
        );
      }
      this.server.to(client.id).emit('ssh-error', {
        serverId: config.serverId,
        sessionId: config.auditSessionId,
        errorType: 'missing_credential',
        message: '服务器凭据未在后端配置，请先保存密码',
        retryable: false,
        final: true,
      });
      return;
    }
    const resolvedConfig: SshConnectionConfig = {
      ...config,
      serverId: config.connectionId ?? config.serverId,
      ip: savedTarget.host,
      port: savedTarget.port,
      username: savedTarget.username,
      password: savedTarget.password,
      auditServerId: config.serverId.split('#')[0],
      deviceName: savedTarget.name,
    };
    console.log(
      `Client ${client.id} requesting connection to ${resolvedConfig.ip} (Server: ${resolvedConfig.serverId})`,
    );
    this.sshService.createConnection(client.id, resolvedConfig, this.server);
  }

  @SubscribeMessage('ssh-command')
  handleCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { serverId: string; command: string },
  ) {
    this.sshService.executeCommand(
      client.id,
      payload.serverId,
      payload.command,
    );
  }

  @SubscribeMessage('ssh-input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { serverId: string; data: string },
  ) {
    this.sshService.writeToStream(client.id, payload.serverId, payload.data);
  }

  @SubscribeMessage('ssh-resize')
  handleResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { serverId: string; cols: number; rows: number },
  ) {
    this.sshService.resize(
      client.id,
      payload.serverId,
      payload.cols,
      payload.rows,
    );
  }

  @SubscribeMessage('ssh-exec')
  async handleExec(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { serverId: string; command: string },
  ) {
    try {
      const output = await this.sshService.exec(
        client.id,
        payload.serverId,
        payload.command,
      );
      return { status: 'ok', output };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { status: 'error', message: errorMessage };
    }
  }

  @SubscribeMessage('ssh-disconnect')
  handleDisconnectRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { serverId: string },
  ) {
    this.sshService.disconnect(client.id, payload.serverId, this.server);
  }
}
