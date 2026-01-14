import { io, Socket } from 'socket.io-client';
import { LogEntry } from '../types';

class SSHConnection {
  private static instance: SSHConnection;
  private socket: Socket | null = null;
  private logListeners: Set<(log: LogEntry) => void> = new Set();
  private dataListeners: Set<(data: string, serverId: string) => void> = new Set();
  private statusListeners: Set<(status: { serverId: string; status: string; message?: string }) => void> = new Set();

  private constructor() {
    // 自动检测环境
    // 1. Electron 环境: 始终连接 localhost:3001 (因为后端由 Electron 主进程启动)
    // 2. Web 生产环境: 使用相对路径 / (通过 Nginx 转发)
    // 3. Web 开发环境: 使用 localhost:3001
    
    // @ts-ignore
    const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;
    // Tauri v2 可能会将接口放在 __TAURI_INTERNALS__ 或其他地方，或者根本不注入
    // 我们检查是否在 tauri:// 协议下运行，或者是否有特定的全局变量
    const isTauri =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'tauri:' ||
       ((window as any).__TAURI__ != null) || 
       ((window as any).__TAURI_INTERNALS__ != null));
    
    let socketUrl;
    if (isElectron || isTauri) {
        // Electron 环境下先设置一个默认值，稍后通过异步方法更新
        socketUrl = 'http://localhost:3001';
    } else {
        socketUrl = import.meta.env.PROD ? '/' : 'http://localhost:3001';
    }

    console.log(`Initializing SSH Connection. Environment: ${isElectron ? 'Electron' : isTauri ? 'Tauri' : 'Web'}, Initial Socket URL: ${socketUrl}`);

    this.socket = io(socketUrl, {
      autoConnect: false,
    });

    // 如果是 Electron 环境，异步获取真实端口并重定向 socket
    if (isElectron) {
      // @ts-ignore
      window.electron.getBackendPort().then((port: number) => {
        const dynamicUrl = `http://localhost:${port}`;
        console.log(`[SSHService] Electron Backend Port Received: ${port}, Target URL: ${dynamicUrl}`);
        if (this.socket) {
          // @ts-ignore
          const manager = (this.socket as any).io;
          if (manager.uri !== dynamicUrl) {
            console.log(`[SSHService] Updating Socket URI from ${manager.uri} to ${dynamicUrl}`);
            manager.uri = dynamicUrl;
            // 如果已经连接了错误的地址，强制断开
            if (this.socket.connected) {
              this.socket.disconnect();
            }
          }
        }
      }).catch((err: any) => {
        console.error('[SSHService] Failed to get backend port:', err);
      });
    }

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      // 在终端显示连接错误，使用红色
      this.dataListeners.forEach(cb => cb(`\r\n\x1b[31m[Error] Connection failed to backend: ${err.message}. Please check if the sidecar is running.\x1b[0m\r\n`, 'global'));
    });

    this.socket.on('connect', () => {
      console.log('Connected to backend');
    });

    this.socket.on('ssh-data', (data: { serverId: string; data: string }) => {
      // Emit raw data for xterm
      this.dataListeners.forEach(cb => cb(data.data, data.serverId));

      // Keep legacy log behavior for AI/Log view
      const lines = data.data.split('\n');
      lines.forEach(line => {
          if (line.trim().length > 0) {
             this.emitLog('info', line.replace(/\r/g, ''), data.serverId);
          }
      });
    });

    this.socket.on('ssh-error', (data: { serverId: string; message: string }) => {
      this.emitLog('error', data.message, data.serverId);
      // 将错误信息直接输出到终端，使用红色
      this.dataListeners.forEach(cb => cb(`\r\n\x1b[31m[Error] ${data.message}\x1b[0m\r\n`, data.serverId));
      this.statusListeners.forEach(cb => cb({ serverId: data.serverId, status: 'error', message: data.message }));
    });

    this.socket.on('ssh-status', (data: { serverId: string; status: string; message?: string }) => {
      if (data.message) {
        this.emitLog('info', data.message, data.serverId);
        // 将状态信息直接输出到终端，使用绿色（连接成功）或黄色（其他状态）
        const color = data.status === 'connected' ? '\x1b[32m' : '\x1b[33m';
        this.dataListeners.forEach(cb => cb(`\r\n${color}[Status] ${data.message}\x1b[0m\r\n`, data.serverId));
      }
      this.statusListeners.forEach(cb => cb(data));
    });
  }

  public static getInstance(): SSHConnection {
    if (!SSHConnection.instance) {
      SSHConnection.instance = new SSHConnection();
    }
    return SSHConnection.instance;
  }

  connect(ip: string, username: string, password: string, serverId: string) {
    console.log(`[SSHService] Connect request for ${ip} (ServerID: ${serverId})`);
    
    // 确保在连接前，socket 的 URL 已经更新为正确的随机端口
    const attemptConnect = (port: number | null = null) => {
      if (this.socket) {
        // @ts-ignore
        const manager = (this.socket as any).io;
        if (port) {
          const dynamicUrl = `http://localhost:${port}`;
          if (manager.uri !== dynamicUrl) {
            console.log(`[SSHService] connect() - Force updating URI to: ${dynamicUrl}`);
            manager.uri = dynamicUrl;
            if (this.socket.connected) this.socket.disconnect();
          }
        }
        
        console.log(`[SSHService] Final socket target: ${manager.uri}`);
        if (!this.socket.connected) {
          console.log('[SSHService] Socket not connected, calling connect()...');
          this.socket.connect();
        }
      }

      // 在终端显示连接中状态，使用青色
      this.dataListeners.forEach(cb => cb(`\r\n\x1b[36m[Status] Connecting to ${ip}...\x1b[0m\r\n`, serverId));

      console.log('[SSHService] Emitting ssh-connect event');
      this.socket?.emit('ssh-connect', { ip, username, password, serverId });
    };

    // @ts-ignore
    const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;
    if (isElectron) {
        console.log('[SSHService] Electron environment detected, fetching port...');
        // @ts-ignore
        window.electron.getBackendPort().then((port: number) => {
            console.log(`[SSHService] connect() - Received port: ${port}`);
            attemptConnect(port);
        }).catch((err: any) => {
            console.error('[SSHService] connect() - Failed to get port, using default:', err);
            attemptConnect();
        });
    } else {
        attemptConnect();
    }
    
    return new Promise((resolve) => {
       resolve(true); 
    });
  }

  onLog(callback: (log: LogEntry) => void) {
    this.logListeners.add(callback);
    return () => this.logListeners.delete(callback);
  }

  onData(callback: (data: string, serverId: string) => void) {
    this.dataListeners.add(callback);
    return () => this.dataListeners.delete(callback);
  }

  onStatus(callback: (status: { serverId: string; status: string; message?: string }) => void) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private emitLog(type: LogEntry['type'], content: string, serverId: string) {
    const log = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      content,
      serverId
    };
    this.logListeners.forEach(cb => cb(log));
  }

  // AI 专用的命令执行方法，返回执行结果字符串
  async executeCommand(command: string, serverId: string): Promise<string> {
    this.emitLog('command', `$ ${command}`, serverId);
    
    // 将 AI 命令显式写入 xterm 数据流，模拟回显
    // 使用洋红色 (Magenta) \x1b[35m 区分 AI 操作
    this.dataListeners.forEach(cb => cb(`\r\n\x1b[35m[AI] $ ${command}\x1b[0m\r\n`, serverId));
    
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        return reject("Not connected to backend");
      }
      
      this.socket.emit('ssh-exec', { serverId, command }, (response: { status: string, output?: string, message?: string }) => {
        if (response.status === 'ok') {
          // Log the output to the terminal as well, so the user sees it happened
          if (response.output) {
            response.output.split('\n').forEach(line => {
              if (line.trim()) this.emitLog('info', line, serverId);
            });

            // 将输出写入 xterm
            // 确保换行符转换为 \r\n 以正确显示
            const formattedOutput = response.output.replace(/\n/g, '\r\n');
            this.dataListeners.forEach(cb => cb(formattedOutput, serverId));
            // 确保末尾有换行
            if (!formattedOutput.endsWith('\r\n')) {
                 this.dataListeners.forEach(cb => cb('\r\n', serverId));
            }
          }
          resolve(response.output || '');
        } else {
          const errorMsg = response.message || 'Unknown error';
          this.emitLog('error', errorMsg, serverId);
          
          // 将错误写入 xterm
          this.dataListeners.forEach(cb => cb(`\r\n\x1b[31m[AI Error]: ${errorMsg}\x1b[0m\r\n`, serverId));
          
          resolve(`Error: ${errorMsg}`); // Resolve with error text so AI sees it
        }
      });
    });
  }

  // 传统的发送方法，不等待结果 (Used by legacy terminal input)
  sendCommand(command: string, serverId: string) {
    this.emitLog('command', `$ ${command}`, serverId);
    this.socket?.emit('ssh-command', { serverId, command });
  }

  // Raw input for xterm (keypresses, etc)
  sendInput(data: string, serverId: string) {
    this.socket?.emit('ssh-input', { serverId, data });
  }

  resize(cols: number, rows: number, serverId: string) {
    this.socket?.emit('ssh-resize', { serverId, cols, rows });
  }

  // 向本地终端写入原始数据
  writeRaw(data: string, serverId: string) {
    this.dataListeners.forEach(cb => cb(data, serverId));
  }

  disconnect(serverId: string) {
    if (!this.socket?.connected) {
      this.statusListeners.forEach(cb => cb({ serverId, status: 'disconnected', message: 'Disconnected (socket idle)' }));
      return;
    }
    this.dataListeners.forEach(cb => cb(`\r\n\x1b[33m[Status] Disconnecting...\x1b[0m\r\n`, serverId));
    this.socket.emit('ssh-disconnect', { serverId });
    this.statusListeners.forEach(cb => cb({ serverId, status: 'disconnected', message: 'Disconnected by user' }));
  }
}

export const sshManager = SSHConnection.getInstance();
