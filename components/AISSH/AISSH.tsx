import React, { useState, useEffect, useRef } from 'react';
import { ServerTree, AddServerModal, PasswordModal, AIChatPanel, sshManager } from './index';
import type { AIChatPanelRef } from './index';
import { MultiIPOperationCenter } from './components/MultiIPOperationCenter';
import { useSSHStore } from './store/useSSHStore';
import { useFileStore } from './store/useFileStore';
import { useMultiIPStore } from './store/useMultiIPStore';
import { SessionTabs } from './components/SessionTabs';
import { TerminalArea } from './components/TerminalArea';
import { CommandInput } from './components/CommandInput';
import { MonacoEditor } from './components/FileEditor/MonacoEditor';
import { FileBrowser } from './components/FileEditor/FileBrowser';
import { FileOperations } from './components/FileEditor/FileOperations';
import { FileTabs } from './components/FileEditor/FileTabs';
import { Terminal, Sparkles, Cpu, Activity } from 'lucide-react';
import { CyberBackground } from './common/CyberBackground';
import { HackerStandby } from './components/HackerStandby';
import { motion, AnimatePresence } from 'framer-motion';

const AISSH: React.FC = () => {
  const { 
    servers, folders, activeSessionId, openSessions, logs, failureCounts,
    setActiveSessionId, setOpenSessions, 
    addLog, updateConnectionStatus, addServer, updateServer, deleteServer,
    addFolder, updateFolder, deleteFolder, resetFailureCount, incrementFailureCount,
    isAIPanelOpen, setIsAIPanelOpen
  } = useSSHStore();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAIPanelOpen, setIsAIPanelOpen]);

  const {
    fileSessions, activeFileSessionId, openFile, closeFile, updateFileContent, saveFile, backupFile
  } = useFileStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState<{ parentId: string | null, editData?: any, isClone?: boolean } | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{ serverId: string, serverName: string } | null>(null);
  const [commandToInsert, setCommandToInsert] = useState<string | null>(null);
  const aiChatPanelRef = useRef<AIChatPanelRef>(null);

  // 多 IP 操作中心状态
  const [isMultiIPCenterOpen, setIsMultiIPCenterOpen] = useState(false);
  const { operations, activeOperationId } = useMultiIPStore();
  const activeOperation = operations.find(op => op.id === activeOperationId);
  const hasRunningOperation = operations.some(op => op.status === 'running');

  const [leftWidth, setLeftWidth] = useState(280);
  const [fileBrowserWidth, setFileBrowserWidth] = useState(310);
  const [rightWidth, setRightWidth] = useState(400);
  const isResizingLeft = useRef(false);
  const isResizingFileBrowser = useRef(false);
  const isResizingRight = useRef(false);

  // Helper to check session type
  const isFileSession = activeSessionId?.endsWith('#files') ?? false;

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
      if (isResizingFileBrowser.current) {
        // Calculate relative to the main area start (leftWidth + resizer)
        const mainAreaStart = leftWidth + 1;
        setFileBrowserWidth(Math.max(310, Math.min(e.clientX - mainAreaStart, 600)));
      }
      if (isResizingRight.current) setRightWidth(Math.max(300, Math.min(window.innerWidth - e.clientX, 800)));
    };

    const handleMouseUp = () => {
      isResizingLeft.current = isResizingFileBrowser.current = isResizingRight.current = false;
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
    // Check if this is a file session request or regular server request
    const realId = id.split('#')[0];
    
    // Ensure the regular session is also tracked if needed, 
    // but for file session we just need to ensure connection exists.
    // However, sshManager manages connections by realId.
    
    if (!openSessions.includes(id)) setOpenSessions(prev => [...prev, id]);
    setActiveSessionId(id);
    
    // 每次从菜单点击（ServerTree）时，通知 AI 面板创建新会话
    if (aiChatPanelRef.current) {
      aiChatPanelRef.current.createNewSession(realId);
    }

    const server = servers.find(s => s.id === realId);
    if (server) {
      if (server.status === 'connected') return; // Already connected
      
      // 检查失败次数
      const failureCount = failureCounts[realId] || 0;
      if (failureCount >= 2 && server.status !== 'error') { // 如果不是刚报错的状态，且已经失败两次了
        addLog({
          timestamp: new Date().toLocaleTimeString(),
          type: 'error',
          content: `连接失败次数过多 (${failureCount})，已停止自动连接。请检查配置或稍后再试。`,
          serverId: realId
        });
         // 直接在终端也输出一下
         sshManager.writeRaw(`\r\n\x1b[31m[System] Connection aborted after ${failureCount} failures. Please check your credentials/network.\x1b[0m\r\n`, realId);
         return;
       }
      
      if (server.password) {
         resetFailureCount(realId);
         updateConnectionStatus(realId, 'connecting');
         sshManager.connect(server.ip, server.username, server.password, realId);
      } else {
         setPasswordPrompt({ serverId: realId, serverName: server.name });
      }
    }
  };

  // 批量连接目录下的服务器
  const handleBatchConnect = (serverIds: string[]) => {
    if (!serverIds || serverIds.length === 0) return;
    
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      content: `开始批量连接 ${serverIds.length} 台服务器...`,
      serverId: 'system'
    });
    
    // 依次连接每个服务器
    serverIds.forEach((serverId, index) => {
      // 延迟连接，避免同时发起过多连接
      setTimeout(() => {
        const server = servers.find(s => s.id === serverId);
        if (!server) return;
        
        // 如果已经连接，跳过
        if (server.status === 'connected') {
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: 'info',
            content: `服务器 ${server.name} (${server.ip}) 已连接，跳过`,
            serverId: serverId
          });
          return;
        }
        
        // 检查失败次数
        const failureCount = failureCounts[serverId] || 0;
        if (failureCount >= 2) {
          addLog({
            timestamp: new Date().toLocaleTimeString(),
            type: 'warning',
            content: `服务器 ${server.name} (${server.ip}) 连接失败次数过多，跳过`,
            serverId: serverId
          });
          return;
        }
        
        // 添加到打开会话列表
        if (!openSessions.includes(serverId)) {
          setOpenSessions(prev => [...prev, serverId]);
        }
        
        if (server.password) {
          resetFailureCount(serverId);
          updateConnectionStatus(serverId, 'connecting');
          sshManager.connect(server.ip, server.username, server.password, serverId);
        } else {
          // 没有密码的服务器，提示输入密码
          setPasswordPrompt({ serverId: serverId, serverName: server.name });
        }
      }, index * 500); // 每个连接间隔 500ms
    });
  };

  const handlePasswordConfirm = (password: string, remember: boolean) => {
    if (!passwordPrompt) return;
    const { serverId } = passwordPrompt;
    
    // Handle file session ID: extract real ID to find server details
    const realId = serverId.split('#')[0];
    const server = servers.find(s => s.id === realId);

    if (server) {
      if (remember && serverId === realId) { // Only update password for the main server record
        updateServer(serverId, { password });
      }
      resetFailureCount(serverId);
      updateConnectionStatus(serverId, 'connecting');
      // Connect using the specific session ID (could be serverId or serverId#files)
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

  const handleFileOpen = (filePath: string) => {
    if (activeSessionId) {
      openFile(activeSessionId, filePath);
    }
  };

  const handleFileSave = async (sessionId: string) => {
    await saveFile(sessionId);
  };

  const handleFileClose = (sessionId: string) => {
    closeFile(sessionId);
  };

  const handleFileDownload = (sessionId: string) => {
    const session = fileSessions[sessionId];
    if (!session) return;
    const blob = new Blob([session.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = session.filePath.split('/').pop() || 'download';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileBackup = async (sessionId: string) => {
    const session = fileSessions[sessionId];
    if (!session) return;
    const success = await backupFile(session.serverId, session.filePath);
    if (success) {
      alert('备份成功');
    } else {
      alert('备份失败');
    }
  };

  const handleFileChange = (sessionId: string, content: string) => {
    updateFileContent(sessionId, content);
  };

  return (
    <div className="flex h-screen bg-sci-base text-sci-text font-sci overflow-hidden relative">
      {/* 动态赛博背景 */}
      <CyberBackground />
      
      {/* HUD 装饰性边框 */}
      <div className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-sci-cyan/20 pointer-events-none z-50"></div>
      <div className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-sci-cyan/20 pointer-events-none z-50"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-sci-cyan/20 pointer-events-none z-50"></div>
      <div className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-sci-cyan/20 pointer-events-none z-50"></div>

      {/* Sidebar Area */}
      <motion.div 
        style={{ width: leftWidth }} 
        className="flex-shrink-0 select-none relative z-10"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <ServerTree 
          width={leftWidth}
          servers={servers} 
          folders={folders} 
          activeServerId={activeSessionId} 
          onSelectServer={handleSelectServer} 
          onAddServer={(p) => setIsAddModalOpen({ parentId: p })} 
          onEditServer={(server) => setIsAddModalOpen({ parentId: server.parentId, editData: server })} 
          onCloneServer={(server) => setIsAddModalOpen({ parentId: server.parentId, editData: server, isClone: true })} 
          onDeleteServer={deleteServer} 
          onAddFolder={(p) => addFolder('新建文件夹', p)} 
          onEditFolder={updateFolder} 
          onDeleteFolder={deleteFolder} 
          onMove={(t, id, p) => {
            if(t === 'server') updateServer(id, { parentId: p });
            else updateFolder(id, { parentId: p });
          }}
          onOpenFileManager={(serverId) => {
             const fileSessionId = `${serverId}#files`;
             const server = servers.find(s => s.id === serverId);

             if (!openSessions.includes(fileSessionId)) {
                setOpenSessions(prev => [...prev, fileSessionId]);
             }
             setActiveSessionId(fileSessionId);

             const status = useSSHStore.getState().connectionStatus[fileSessionId];
             
             if (!useFileStore.getState().fileBrowserPath[fileSessionId]) {
                useFileStore.getState().setFileBrowserPath(fileSessionId, '/');
             }

             if (status !== 'connected' && status !== 'connecting' && server) {
                if (server.password) {
                   resetFailureCount(fileSessionId);
                   updateConnectionStatus(fileSessionId, 'connecting');
                   sshManager.connect(server.ip, server.username, server.password, fileSessionId);
                } else {
                   setPasswordPrompt({ serverId: fileSessionId, serverName: `${server.name} (Files)` });
                }
             }
          }}
          onBatchConnect={handleBatchConnect}
        />
      </motion.div>

      <div className="w-px bg-sci-cyan/10 hover:bg-sci-cyan cursor-col-resize transition-colors flex items-center justify-center group z-10" onMouseDown={() => { isResizingLeft.current = true; document.body.style.cursor = 'col-resize'; }}>
        <div className="absolute w-4 h-full"></div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent relative h-screen">
        <div className="flex items-center justify-between pr-4 bg-sci-obsidian/20 backdrop-blur-sm border-b border-white/5">
          <SessionTabs />
          <div className="flex items-center gap-2 ml-auto">
            {/* 多 IP 操作中心按钮 */}
            {operations.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMultiIPCenterOpen(true)}
                className={`mt-1 px-2 py-1 rounded-lg transition-all duration-300 group relative flex items-center gap-1.5 text-[10px] font-medium border ${
                  hasRunningOperation
                    ? 'text-sci-cyan bg-sci-cyan/10 border-sci-cyan/30 shadow-[0_0_10px_rgba(0,243,255,0.2)]'
                    : 'text-sci-dim hover:text-sci-cyan hover:bg-sci-cyan/5 border-transparent'
                }`}
                title="打开多 IP 操作中心"
              >
                {hasRunningOperation ? (
                  <Activity size={12} className="animate-pulse text-sci-cyan" />
                ) : (
                  <Cpu size={12} />
                )}
                <span className="hidden sm:inline">
                  {hasRunningOperation 
                    ? `执行中 (${operations.filter(op => op.status === 'running').length})` 
                    : `多 IP (${operations.length})`}
                </span>
                {hasRunningOperation && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-sci-cyan rounded-full animate-pulse shadow-[0_0_8px_rgba(0,243,255,0.8)]"></span>
                )}
              </motion.button>
            )}
            
            {/* AI 助手按钮 */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
              className={`mt-1 p-1 rounded-lg transition-all duration-300 group relative ${
                isAIPanelOpen 
                  ? 'text-sci-cyan bg-sci-cyan/10 border-sci-cyan/30' 
                  : 'text-sci-dim hover:text-sci-cyan hover:bg-sci-cyan/5 border-transparent'
              } border`}
              title={isAIPanelOpen ? "隐藏 AI 助手" : "显示 AI 助手"}
            >
              <Sparkles size={14} className="group-hover:scale-110 transition-transform" />
              {!isAIPanelOpen && (
                <span className="absolute -top-0 -right-0 w-1 h-1 bg-sci-cyan rounded-full animate-pulse shadow-[0_0_8px_rgba(0,243,255,0.8)]"></span>
              )}
            </motion.button>
          </div>
        </div>
        
        {/* Terminal Area */}
        <div className={`flex-1 flex flex-col min-w-0 ${(!activeSessionId || isFileSession) ? 'hidden' : 'flex'}`}>
            <TerminalArea 
              commandToInsert={commandToInsert} 
              onAnalyzeLog={handleAnalyzeLogFromTerminal} 
            />
            <CommandInput onInsertCommand={handleInsertCommand} />
        </div>

        {/* File Editor Area */}
        {activeSessionId && isFileSession && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="flex-1 flex overflow-hidden"
             >
                 {/* File Browser Sidebar */}
                 <div style={{ width: fileBrowserWidth }} className="flex-shrink-0 flex overflow-hidden border-r border-white/5 bg-[#0d1117]">
                     <FileBrowser serverId={activeSessionId || ''} onFileOpen={handleFileOpen} />
                 </div>
                 
                 <div 
                    className="w-px bg-sci-cyan/10 hover:bg-sci-cyan cursor-col-resize transition-colors flex items-center justify-center group z-20 relative -ml-px" 
                    onMouseDown={(e) => { 
                        e.preventDefault();
                        isResizingFileBrowser.current = true; 
                        document.body.style.cursor = 'col-resize'; 
                    }}
                 >
                    <div className="absolute w-4 h-full cursor-col-resize"></div>
                 </div>
                 {/* Main Editor Area */}
                 <div className="flex-1 flex flex-col min-w-0">
                     <FileTabs />
                     
                     <div className="flex-1 flex overflow-hidden">
                         <div className="flex-1 flex flex-col min-w-0">
                             {activeFileSessionId && fileSessions[activeFileSessionId] ? (
                                 <MonacoEditor 
                                     key={activeFileSessionId}
                                     session={fileSessions[activeFileSessionId]}
                                     onSave={handleFileSave}
                                     onClose={handleFileClose}
                                     onDownload={handleFileDownload}
                                     onBackup={handleFileBackup}
                                     onChange={handleFileChange}
                                 />
                             ) : (
                                 <div className="flex-1 flex items-center justify-center text-sci-dim">
                                     Select a file to edit
                                 </div>
                             )}
                         </div>
                         
                         <div className="w-72 border-l border-white/5 flex-shrink-0">
                             <FileOperations serverId={activeSessionId || ''} activeSessionId={activeFileSessionId} />
                         </div>
                     </div>
                 </div>
             </motion.div>
        )}
 
        {!activeSessionId && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1 flex flex-col relative overflow-hidden"
              >
                  <HackerStandby />
              </motion.div>
        )}
      </div>

      {isAIPanelOpen && (
        <div className="w-px bg-sci-cyan/10 hover:bg-sci-cyan cursor-col-resize transition-colors flex items-center justify-center group z-10" onMouseDown={() => { isResizingRight.current = true; document.body.style.cursor = 'col-resize'; }}>
          <div className="absolute w-4 h-full"></div>
        </div>
      )}

      {/* AI Panel Area */}
      <motion.div 
        style={{ width: isAIPanelOpen ? (isMobile ? '350px' : rightWidth) : 0 }} 
        className={`
          flex-shrink-0 bg-sci-obsidian/40 backdrop-blur-md border-l border-white/5 
          transition-all duration-300 ease-in-out overflow-hidden relative
          ${isFileSession ? 'hidden' : ''}
        `}
      >
        <AnimatePresence>
          {isAIPanelOpen && (
            <motion.div 
              className="h-full w-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <AIChatPanel 
                ref={aiChatPanelRef} 
                logs={logs} 
                activeServerId={activeSessionId} 
                onInsertCommand={handleInsertCommand} 
                onSwitchServer={handleSelectServer}
                onOpenMultiIPCenter={() => setIsMultiIPCenterOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {isAddModalOpen && (
        <AddServerModal 
          initialData={isAddModalOpen.editData} 
          parentId={isAddModalOpen.parentId} 
          isClone={isAddModalOpen.isClone}
          onClose={() => setIsAddModalOpen(null)} 
          onSave={(data) => { 
            if(isAddModalOpen.editData && !isAddModalOpen.isClone) updateServer(isAddModalOpen.editData.id, data);
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

      {/* 多 IP 操作中心弹窗 */}
      <MultiIPOperationCenter 
        isOpen={isMultiIPCenterOpen} 
        onClose={() => setIsMultiIPCenterOpen(false)} 
      />
    </div>
  );
};

export default AISSH;
