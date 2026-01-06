use crate::types::*;
use socketioxide::extract::SocketRef;
use ssh2::Session;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::{mpsc, Arc, Mutex};
use tokio::task;
use tracing::{error, info};

enum SshChannelCmd {
    Write(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Disconnect,
    Exec {
        command: String,
        reply_tx: mpsc::Sender<Result<String, String>>,
    },
}

struct SshSession {
    session: Arc<Mutex<Session>>,
    tx: mpsc::Sender<SshChannelCmd>,
}

pub struct SshService {
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
}

impl SshService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn connect(&self, socket: SocketRef, config: SshConnectionConfig) {
        let session_key = format!("{}:{}", socket.id, config.server_id);
        let sessions = self.sessions.clone();

        self.disconnect(&socket.id.to_string(), &config.server_id);

        let server_id = config.server_id.clone();
        let ip = config.ip.clone();
        let port = config.port.unwrap_or(22);

        task::spawn_blocking(move || {
            info!("Connecting to TCP {}:{}", ip, port);
            let addr = format!("{}:{}", ip, port);
            let socket_addr = match addr.to_socket_addrs().map(|mut addrs| addrs.next()) {
                Ok(Some(a)) => a,
                _ => {
                    error!("Invalid address: {}", addr);
                    let _ = socket.emit(
                        "ssh-error",
                        &SshErrorPayload {
                            server_id,
                            message: format!("Invalid address: {}", addr),
                        },
                    );
                    return;
                }
            };

            let tcp =
                match TcpStream::connect_timeout(&socket_addr, std::time::Duration::from_secs(15)) {
                    Ok(t) => {
                        let _ = t.set_nonblocking(false);
                        t
                    }
                    Err(e) => {
                        error!("TCP connection failed for server {} ({}:{}): {}", server_id, ip, port, e);
                        let _ = socket.emit(
                            "ssh-error",
                            &SshErrorPayload {
                                server_id,
                                message: format!("Connection timeout or failed ({}:{}): {}", ip, port, e),
                            },
                        );
                        return;
                    }
                };

            info!("TCP connected to {}:{}, performing SSH handshake...", ip, port);
            let mut sess = Session::new().unwrap();
            sess.set_tcp_stream(tcp);
            sess.set_timeout(15000);
            if let Err(e) = sess.handshake() {
                error!("SSH handshake failed for {} ({}:{}): {}", server_id, ip, port, e);
                let _ = socket.emit(
                    "ssh-error",
                    &SshErrorPayload {
                        server_id,
                        message: format!("SSH handshake failed ({}:{}): {}", ip, port, e),
                    },
                );
                return;
            }
            info!("SSH handshake done for server {} ({}:{})", server_id, ip, port);

            if let Some(password) = config.password {
                info!("Attempting password auth for user: {} on server: {}", config.username, server_id);
                if let Err(e) = sess.userauth_password(&config.username, &password) {
                    error!("SSH Auth failed for {}: {}", config.username, e);
                    let _ = socket.emit(
                        "ssh-error",
                        &SshErrorPayload {
                            server_id,
                            message: format!("Authentication failed: {}. Please check your credentials.", e),
                        },
                    );
                    return;
                }
            } else if let Some(pk) = config.private_key {
                if let Err(e) = sess.userauth_pubkey_memory(&config.username, None, &pk, None) {
                    let _ = socket.emit(
                        "ssh-error",
                        &SshErrorPayload {
                            server_id,
                            message: format!("Private key authentication failed: {}", e),
                        },
                    );
                    return;
                }
            } else {
                let _ = socket.emit(
                    "ssh-error",
                    &SshErrorPayload {
                        server_id,
                        message: "No authentication method provided".to_string(),
                    },
                );
                return;
            }

            info!("SSH authenticated for server {}", server_id);

            let _ = socket.emit(
                "ssh-status",
                &SshStatusPayload {
                    server_id: server_id.clone(),
                    status: "connected".to_string(),
                    message: Some(format!("Connected to {}", ip)),
                },
            );

            let mut channel = match sess.channel_session() {
                Ok(c) => c,
                Err(e) => {
                    let _ = socket.emit(
                        "ssh-error",
                        &SshErrorPayload {
                            server_id,
                            message: format!("Failed to create channel: {}", e),
                        },
                    );
                    return;
                }
            };

            if let Err(e) = channel.request_pty("xterm-256color", None, None) {
                let _ = socket.emit(
                    "ssh-error",
                    &SshErrorPayload {
                        server_id,
                        message: format!("Failed to request PTY: {}", e),
                    },
                );
                return;
            }

            let _ = channel.request_pty_size(80, 24, None, None);

            if let Err(e) = channel.shell() {
                let _ = socket.emit(
                    "ssh-error",
                    &SshErrorPayload {
                        server_id,
                        message: format!("Failed to start shell: {}", e),
                    },
                );
                return;
            }

            sess.set_timeout(100);

            let (tx, rx) = mpsc::channel::<SshChannelCmd>();
            let session = Arc::new(Mutex::new(sess));
            let ssh_session = SshSession {
                session: session.clone(),
                tx,
            };

            sessions
                .lock()
                .unwrap()
                .insert(session_key.clone(), ssh_session);

            let socket_inner = socket.clone();
            let server_id_inner = server_id.clone();
            let session_inner = session.clone(); // Keep session alive
            let sessions_inner = sessions.clone();
            let session_key_inner = session_key.clone();

            task::spawn_blocking(move || {
                let mut buffer = [0u8; 8192];
                let mut disconnect_requested = false;
                'outer: loop {
                    loop {
                        match rx.try_recv() {
                            Ok(SshChannelCmd::Write(data)) => {
                                let _ = channel.write_all(&data);
                                let _ = channel.flush();
                            }
                            Ok(SshChannelCmd::Resize { cols, rows }) => {
                                let _ = channel.request_pty_size(cols, rows, None, None);
                            }
                            Ok(SshChannelCmd::Disconnect) => {
                                disconnect_requested = true;
                                break 'outer;
                            }
                            Ok(SshChannelCmd::Exec { command, reply_tx }) => {
                                let result = (|| {
                                    let sess = session_inner.lock().unwrap();
                                    let prev_timeout = sess.timeout();
                                    sess.set_timeout(60000); // 执行命令时设置 60s 超时

                                    let res = (|| {
                                        let mut exec_channel = sess.channel_session().map_err(|e| e.to_string())?;
                                        exec_channel.exec(&command).map_err(|e| e.to_string())?;
                                        let mut output = String::new();
                                        exec_channel.read_to_string(&mut output).map_err(|e| e.to_string())?;
                                        Ok(output)
                                    })();

                                    sess.set_timeout(prev_timeout);
                                    res
                                })();
                                let _ = reply_tx.send(result);
                            }
                            Err(mpsc::TryRecvError::Empty) => break,
                            Err(mpsc::TryRecvError::Disconnected) => {
                                disconnect_requested = true;
                                break 'outer;
                            }
                        }
                    }

                    match channel.read(&mut buffer) {
                        Ok(0) => {
                            info!("Channel EOF for server {}", server_id_inner);
                            break 'outer;
                        }
                        Ok(n) => {
                            let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                            let _ = socket_inner.emit(
                                "ssh-data",
                                &SshDataPayload {
                                    server_id: server_id_inner.clone(),
                                    data,
                                },
                            );
                        }
                        Err(e)
                            if e.kind() == std::io::ErrorKind::TimedOut
                                || e.kind() == std::io::ErrorKind::WouldBlock => {}
                        Err(e) => {
                            error!("Channel read error for server {}: {}", server_id_inner, e);
                            break 'outer;
                        }
                    }
                }

                let _ = disconnect_requested;
                let _ = channel.send_eof();
                let _ = channel.close();

                if let Ok(sess) = session_inner.lock() {
                    let _ = sess.disconnect(None, "Disconnected", None);
                }
                drop(session_inner);

                info!("Cleaning up session {}", session_key_inner);
                sessions_inner.lock().unwrap().remove(&session_key_inner);

                let _ = socket_inner.emit(
                    "ssh-status",
                    &SshStatusPayload {
                        server_id: server_id_inner,
                        status: "disconnected".to_string(),
                        message: None,
                    },
                );
            });
        });
    }

    pub fn write(&self, socket_id: &str, server_id: &str, data: &str) {
        let key = format!("{}:{}", socket_id, server_id);
        if let Some(session) = self.sessions.lock().unwrap().get(&key) {
            let _ = session
                .tx
                .send(SshChannelCmd::Write(data.as_bytes().to_vec()));
        }
    }

    pub fn resize(&self, socket_id: &str, server_id: &str, cols: u32, rows: u32) {
        let key = format!("{}:{}", socket_id, server_id);
        if let Some(session) = self.sessions.lock().unwrap().get(&key) {
            let _ = session.tx.send(SshChannelCmd::Resize { cols, rows });
        }
    }

    pub fn disconnect(&self, socket_id: &str, server_id: &str) {
        let key = format!("{}:{}", socket_id, server_id);
        if let Some(session) = self.sessions.lock().unwrap().remove(&key) {
            let _ = session.tx.send(SshChannelCmd::Disconnect);
            let sess = session.session.lock().unwrap();
            let _ = sess.disconnect(None, "Disconnected", None);
        }
    }

    pub fn disconnect_all(&self, socket_id: &str) {
        let server_ids: Vec<String> = {
            let sessions = self.sessions.lock().unwrap();
            sessions
                .keys()
                .filter_map(|k| {
                    k.strip_prefix(&format!("{}:", socket_id))
                        .map(|v| v.to_string())
                })
                .collect()
        };

        for server_id in server_ids {
            self.disconnect(socket_id, &server_id);
        }
    }

    pub async fn exec(
        &self,
        socket_id: &str,
        server_id: &str,
        command: String,
    ) -> Result<String, String> {
        let key = format!("{}:{}", socket_id, server_id);
        let tx = {
            let sessions = self.sessions.lock().unwrap();
            sessions
                .get(&key)
                .map(|s| s.tx.clone())
                .ok_or("Session not found")?
        };

        let (reply_tx, reply_rx) = mpsc::channel();
        tx.send(SshChannelCmd::Exec { command, reply_tx })
            .map_err(|e| e.to_string())?;

        task::spawn_blocking(move || {
            reply_rx
                .recv()
                .map_err(|e| e.to_string())?
        })
        .await
        .map_err(|e| e.to_string())?
    }
}
