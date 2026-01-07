import React, { useState, useEffect, useRef } from 'react';
import { ServerTree, AddServerModal, PasswordModal, AIChatPanel, sshManager } from './index';
import type { AIChatPanelRef } from './index';
import { useSSHStore } from './store/useSSHStore';
import { SessionTabs } from './components/SessionTabs';
import { TerminalArea } from './components/TerminalArea';
import { CommandInput } from './components/CommandInput';

const AISSH: React.FC = () => {
  const { 
    servers, folders, activeSessionId, openSessions, logs, failureCounts,
    setActiveSessionId, setOpenSessions, 
    addLog, updateConnectionStatus, addServer, updateServer, deleteServer,
    addFolder, updateFolder, deleteFolder, resetFailureCount, incrementFailureCount
  } = useSSHStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState<{ parentId: string | null, editData?: any } | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ serverId: string, serverName: string } | null>(null);
  const [commandToInsert, setCommandToInsert] = useState<string | null>(null);
  const aiChatPanelRef = useRef<AIChatPanelRef>(null);

  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(450);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  useEffect(() => {
    const unsubLog = sshManager.onLog((log) => {
      addLog(log);
    });

    const unsubStatus = sshManager.onStatus((status) => {
      let mappedStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
      if (status.status === 'connected') {
        mappedStatus = 'connected';
        resetFailureCount(status.serverId); // 连接成功，重置失败计数
      }
      else if (status.status === 'connecting') mappedStatus = 'connecting';
      else if (status.status === 'error') {
        mappedStatus = 'error';
        incrementFailureCount(status.serverId); // 增加失败计数
        // 如果是超时错误，给一些特别的提示
        if (status.message?.includes('timed out')) {
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            content: `连接服务器 ${status.serverId} 超时 (5s)，请检查网络连接或服务器状态。`,
            serverId: status.serverId
          });
        }
      }
      else if (status.status === 'disconnected') {
        mappedStatus = 'disconnected';
      }
      
      updateConnectionStatus(status.serverId, mappedStatus);
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) setLeftWidth(Math.max(150, Math.min(e.clientX, 500)));
      if (isResizingRight.current) setRightWidth(Math.max(300, Math.min(window.innerWidth - e.clientX, 800)));
    };

    const handleMouseUp = () => {
      isResizingLeft.current = isResizingRight.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      unsubLog();
      unsubStatus();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [addLog, updateConnectionStatus]);

  const handleSelectServer = (id: string) => {
    if (!openSessions.includes(id)) setOpenSessions(prev => [...prev, id]);
    setActiveSessionId(id);
    
    // 每次从菜单点击（ServerTree）时，通知 AI 面板创建新会话
    if (aiChatPanelRef.current) {
      aiChatPanelRef.current.createNewSession(id);
    }

    const server = servers.find(s => s.id === id);
    if (server) {
      if (server.status === 'connected') return; // Already connected
      
      // 检查失败次数
      const failureCount = failureCounts[id] || 0;
      if (failureCount >= 2 && server.status !== 'error') { // 如果不是刚报错的状态，且已经失败两次了
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'error',
          content: `连接失败次数过多 (${failureCount})，已停止自动连接。请检查配置或稍后再试。`,
          serverId: id
        });
         // 直接在终端也输出一下
         sshManager.writeRaw(`\r\n\x1b[31m[System] Connection aborted after ${failureCount} failures. Please check your credentials/network.\x1b[0m\r\n`, id);
         return;
       }
      
      if (server.password) {
         resetFailureCount(id);
         updateConnectionStatus(id, 'connecting');
         sshManager.connect(server.ip, server.username, server.password, id);
      } else {
         setPasswordPrompt({ serverId: id, serverName: server.name });
      }
    }
  };

  const handlePasswordConfirm = (password: string, remember: boolean) => {
    if (!passwordPrompt) return;
    const { serverId } = passwordPrompt;
    const server = servers.find(s => s.id === serverId);
    if (server) {
      if (remember) {
        updateServer(serverId, { password });
      }
      resetFailureCount(serverId);
      updateConnectionStatus(serverId, 'connecting');
      sshManager.connect(server.ip, server.username, password, serverId);
    }
    setPasswordPrompt(null);
  };

  const handleAnalyzeLogFromTerminal = (logLine: string) => {
    if (aiChatPanelRef.current) {
      aiChatPanelRef.current.triggerExternalPrompt(logLine);
    }
  };

  const handleInsertCommand = (command: string) => {
    setCommandToInsert(command);
    setTimeout(() => setCommandToInsert(null), 100);
  };

  return (
    <div className="flex h-screen bg-sci-base text-sci-text font-sci overflow-hidden bg-grid-pattern relative">
      {/* 全局扫描线效果 */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.01),rgba(0,255,0,0.005),rgba(0,0,118,0.01))] bg-[length:100%_4px,3px_100%] z-[100] opacity-30"></div>
      
      {/* HUD 装饰性边框 */}
      <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-sci-cyan/20 pointer-events-none z-50"></div>
      <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-sci-cyan/20 pointer-events-none z-50"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-sci-cyan/20 pointer-events-none z-50"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-sci-cyan/20 pointer-events-none z-50"></div>

      {/* Sidebar Area */}
      <div style={{ width: leftWidth }} className="flex-shrink-0 select-none bg-sci-obsidian/40 backdrop-blur-md border-r border-white/5 relative z-10">
        <ServerTree 
          width={leftWidth}
          servers={servers} 
          folders={folders} 
          activeServerId={activeSessionId} 
          onSelectServer={handleSelectServer} 
          onAddServer={(p) => setIsAddModalOpen({ parentId: p })} 
          onEditServer={(server) => setIsAddModalOpen({ parentId: server.parentId, editData: server })} 
          onDeleteServer={deleteServer} 
          onAddFolder={(p) => addFolder('新建文件夹', p)} 
          onEditFolder={updateFolder} 
          onDeleteFolder={deleteFolder} 
          onMove={(t, id, p) => {
            if(t === 'server') updateServer(id, { parentId: p });
            else updateFolder(id, { parentId: p });
          }}
        />
      </div>

      <div className="w-px bg-sci-cyan/10 hover:bg-sci-cyan cursor-col-resize transition-colors flex items-center justify-center group z-10" onMouseDown={() => { isResizingLeft.current = true; document.body.style.cursor = 'col-resize'; }}>
        <div className="absolute w-4 h-full"></div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative h-screen">
        <SessionTabs />
        <TerminalArea 
          commandToInsert={commandToInsert} 
          onAnalyzeLog={handleAnalyzeLogFromTerminal} 
        />
        <CommandInput onInsertCommand={handleInsertCommand} />
      </div>

      <div className="w-px bg-sci-cyan/10 hover:bg-sci-cyan cursor-col-resize transition-colors flex items-center justify-center group z-10" onMouseDown={() => { isResizingRight.current = true; document.body.style.cursor = 'col-resize'; }}>
        <div className="absolute w-4 h-full"></div>
      </div>

      {/* AI Panel Area */}
      <div style={{ width: rightWidth }} className="flex-shrink-0 bg-sci-obsidian/40 backdrop-blur-md border-l border-white/5">
        <AIChatPanel 
          ref={aiChatPanelRef} 
          logs={logs} 
          activeServerId={activeSessionId} 
          onInsertCommand={handleInsertCommand} 
          onSwitchServer={handleSelectServer}
        />
      </div>

      {isAddModalOpen && (
        <AddServerModal 
          initialData={isAddModalOpen.editData} 
          parentId={isAddModalOpen.parentId} 
          onClose={() => setIsAddModalOpen(null)} 
          onSave={(data) => { 
            if(isAddModalOpen.editData) updateServer(isAddModalOpen.editData.id, data);
            else addServer(data); 
            setIsAddModalOpen(null); 
          }}
        />
      )}

      {passwordPrompt && (
        <PasswordModal 
          serverName={passwordPrompt.serverName}
          onClose={() => setPasswordPrompt(null)}
          onConfirm={handlePasswordConfirm}
        />
      )}
    </div>
  );
};

export default AISSH;
