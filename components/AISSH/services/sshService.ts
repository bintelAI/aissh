import { io, Socket } from "socket.io-client";
import { LogEntry } from "../types";

export interface SSHStatus {
  serverId: string;
  status: "connected" | "connecting" | "disconnected" | "error";
  message?: string;
  attempt?: number;
  stage?: string;
  retryable?: boolean;
  final?: boolean;
}

interface PendingConnection {
  generation: number;
  reject: (error: Error) => void;
  resolve: () => void;
}

class SSHConnection {
  private static instance: SSHConnection;
  private socket: Socket;
  private connectionGeneration = 0;
  private readonly activeSessions = new Set<string>();
  private readonly dataListeners = new Set<
    (data: string, serverId: string) => void
  >();
  private readonly logListeners = new Set<(log: LogEntry) => void>();
  private readonly pendingConnections = new Map<string, PendingConnection>();
  private readonly statusListeners = new Set<(status: SSHStatus) => void>();

  private constructor() {
    const isElectron =
      typeof window !== "undefined" && window.electron?.isElectron;
    const socketUrl = isElectron
      ? "http://localhost:3001"
      : import.meta.env.PROD
        ? "/"
        : "http://localhost:3001";

    this.socket = io(socketUrl, { autoConnect: false });
    this.bindSocketEvents();
  }

  static getInstance(): SSHConnection {
    if (!SSHConnection.instance) SSHConnection.instance = new SSHConnection();
    return SSHConnection.instance;
  }

  connect(serverId: string, connectionId = serverId): Promise<void> {
    const existing = this.pendingConnections.get(connectionId);
    if (existing)
      return new Promise((resolve, reject) => {
        const unsubscribe = this.onStatus((status) => {
          if (status.serverId !== connectionId) return;
          if (status.status === "connected") {
            unsubscribe();
            resolve();
          } else if (status.status === "error" && status.final) {
            unsubscribe();
            reject(new Error(status.message));
          }
        });
      });

    return this.beginConnection(serverId, connectionId);
  }

  retry(serverId: string, connectionId = serverId): Promise<void> {
    this.cancelPendingConnection(connectionId, "连接请求已被新的手动重试替换");
    this.socket.emit("ssh-disconnect", { serverId: connectionId });
    return this.beginConnection(serverId, connectionId);
  }

  disconnect(serverId: string): void {
    this.cancelPendingConnection(serverId, "连接已由用户取消");
    this.activeSessions.delete(serverId);
    if (this.socket.connected) this.socket.emit("ssh-disconnect", { serverId });
    this.emitStatus({
      serverId,
      status: "disconnected",
      stage: "disconnected",
      message: "已断开连接",
    });
  }

  async executeCommand(command: string, serverId: string): Promise<string> {
    this.emitLog("command", `$ ${command}`, serverId);
    this.writeRaw(`\r\n\x1b[35m[AI] $ ${command}\x1b[0m\r\n`, serverId);
    if (!this.socket.connected) throw new Error("SSH 后端未连接");

    return new Promise((resolve, reject) => {
      this.socket
        .timeout(65_000)
        .emit(
          "ssh-exec",
          { serverId, command },
          (
            error: Error | null,
            response?: { status: string; output?: string; message?: string },
          ) => {
            if (error) return reject(new Error("命令执行请求超时"));
            if (!response || response.status !== "ok") {
              return reject(new Error(response?.message ?? "命令执行失败"));
            }
            const output = response.output ?? "";
            if (output)
              this.writeRaw(
                output.replace(/\n/g, "\r\n") +
                  (output.endsWith("\n") ? "" : "\r\n"),
                serverId,
              );
            resolve(output);
          },
        );
    });
  }

  sendCommand(command: string, serverId: string): void {
    this.emitLog("command", `$ ${command}`, serverId);
    this.socket.emit("ssh-command", { serverId, command });
  }

  sendInput(data: string, serverId: string): void {
    this.socket.emit("ssh-input", { serverId, data });
  }

  resize(cols: number, rows: number, serverId: string): void {
    this.socket.emit("ssh-resize", { serverId, cols, rows });
  }

  writeRaw(data: string, serverId: string): void {
    this.dataListeners.forEach((listener) => listener(data, serverId));
  }

  onData(callback: (data: string, serverId: string) => void): () => void {
    this.dataListeners.add(callback);
    return () => this.dataListeners.delete(callback);
  }

  onLog(callback: (log: LogEntry) => void): () => void {
    this.logListeners.add(callback);
    return () => this.logListeners.delete(callback);
  }

  onStatus(callback: (status: SSHStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private async beginConnection(
    serverId: string,
    connectionId: string,
  ): Promise<void> {
    const generation = ++this.connectionGeneration;
    this.activeSessions.add(connectionId);
    this.emitStatus({
      serverId: connectionId,
      status: "connecting",
      stage: "backend",
      message: "正在连接 SSH 后端",
    });

    const result = new Promise<void>((resolve, reject) => {
      this.pendingConnections.set(connectionId, {
        generation,
        resolve,
        reject,
      });
    });

    try {
      await this.configureElectronEndpoint();
      await this.ensureSocketConnected();
      if (this.pendingConnections.get(connectionId)?.generation !== generation)
        return result;
      this.socket.emit("ssh-connect", { serverId, connectionId });
    } catch (error) {
      if (
        this.pendingConnections.get(connectionId)?.generation === generation
      ) {
        this.pendingConnections.delete(connectionId);
        this.activeSessions.delete(connectionId);
        const message =
          error instanceof Error ? error.message : "SSH 后端连接失败";
        this.emitStatus({
          serverId: connectionId,
          status: "error",
          stage: "backend",
          message,
          final: true,
          retryable: true,
        });
        throw error;
      }
    }
    return result;
  }

  private bindSocketEvents(): void {
    this.socket.on("connect", () => console.info("[SSH] 后端连接已建立"));
    this.socket.on("connect_error", (error) =>
      console.error("[SSH] 后端连接失败:", error.message),
    );
    this.socket.on("disconnect", (reason) => {
      for (const serverId of this.activeSessions) {
        this.cancelPendingConnection(serverId, `SSH 后端已断开：${reason}`);
        this.emitStatus({
          serverId,
          status: "error",
          stage: "backend",
          message: `SSH 后端已断开：${reason}`,
          final: true,
          retryable: true,
        });
      }
      this.activeSessions.clear();
    });
    this.socket.on("ssh-data", (data: { serverId: string; data: string }) => {
      this.writeRaw(data.data, data.serverId);
      data.data.split("\n").forEach((line) => {
        if (line.trim())
          this.emitLog("info", line.replace(/\r/g, ""), data.serverId);
      });
    });
    this.socket.on("ssh-status", (status: SSHStatus) => {
      if (status.status === "connected") {
        this.pendingConnections.get(status.serverId)?.resolve();
        this.pendingConnections.delete(status.serverId);
      }
      if (status.status === "disconnected") {
        this.activeSessions.delete(status.serverId);
        this.cancelPendingConnection(
          status.serverId,
          status.message ?? "SSH 连接已断开",
        );
      }
      if (status.message) this.emitLog("info", status.message, status.serverId);
      this.emitStatus(status);
    });
    this.socket.on("ssh-error", (error: Omit<SSHStatus, "status">) => {
      const status: SSHStatus = { ...error, status: "error" };
      if (status.final) {
        this.activeSessions.delete(status.serverId);
        this.cancelPendingConnection(
          status.serverId,
          status.message ?? "SSH 连接失败",
        );
      }
      this.emitLog("error", status.message ?? "SSH 连接失败", status.serverId);
      this.writeRaw(
        `\r\n\x1b[31m[错误] ${status.message ?? "SSH 连接失败"}\x1b[0m\r\n`,
        status.serverId,
      );
      this.emitStatus(status);
    });
  }

  private async configureElectronEndpoint(): Promise<void> {
    if (typeof window === "undefined" || !window.electron?.isElectron) return;
    const port = await window.electron.getBackendPort();
    const manager = this.socket.io as unknown as { uri: string };
    const endpoint = `http://localhost:${port}`;
    if (manager.uri === endpoint) return;
    if (this.socket.connected) this.socket.disconnect();
    manager.uri = endpoint;
  }

  private ensureSocketConnected(): Promise<void> {
    if (this.socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("等待 SSH 后端连接超时"));
      }, 10_000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        this.socket.off("connect", onConnect);
        this.socket.off("connect_error", onError);
      };
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new Error(`SSH 后端连接失败：${error.message}`));
      };
      this.socket.once("connect", onConnect);
      this.socket.once("connect_error", onError);
      this.socket.connect();
    });
  }

  private cancelPendingConnection(serverId: string, message: string): void {
    const pending = this.pendingConnections.get(serverId);
    if (!pending) return;
    this.pendingConnections.delete(serverId);
    pending.reject(new Error(message));
  }

  private emitLog(
    type: LogEntry["type"],
    content: string,
    serverId: string,
  ): void {
    const log: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      content,
      serverId,
    };
    this.logListeners.forEach((listener) => listener(log));
  }

  private emitStatus(status: SSHStatus): void {
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export const sshManager = SSHConnection.getInstance();
