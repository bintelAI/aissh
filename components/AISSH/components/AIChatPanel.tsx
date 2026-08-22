import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Send, Sparkles, Zap, BrainCircuit,
  PanelLeftClose, PlusCircle, Terminal as TerminalIcon, Copy, Check, Square,
  PanelLeft, Activity, Settings2, ShieldAlert, Thermometer, Cpu, X, ZapOff,
  Wand2, ShieldCheck, FileDown, FileUp, Eraser, ChevronDown, History, Trash2
} from 'lucide-react';
import { AgentConfig, ChatMessage, LogEntry, ChatSession, ExportConfigData, PromptProfile, Server } from '../types/index';
import { PromptConfigModal } from './PromptConfigModal';
import { usePromptStore } from '../store/usePromptStore';
import { useAIStore } from '../store/useAIStore';
import { useSSHStore } from '../store/useSSHStore';
import { chatWithAIStream, runAutonomousTask } from '../services/geminiService';
import { saveApiKey } from '../services/aiClient';
import {
  clearAiMessages,
  createAiMessage,
  createAiSession,
  deleteAiSession,
  listAiMessages,
  listAiSessions,
  updateAiMessage,
  updateAiSession,
} from '../services/aiSessionService';
import { sshManager } from '../services/sshService';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedText, GlitchText } from '../common/AnimatedText';
import { AIEmptyState } from './AIEmptyState';
import { IPSelectorInput, SelectedIP } from './IPSelectorInput';
import { useMultiIPStore } from '../store/useMultiIPStore';
import { ExecutionMode } from '../types/multiIP';
import { multiIPAgentService } from '../services/multiIPAgentService';
import {
  exportConfiguration,
  importConfiguration,
  saveConfigurationExport,
  toPersistedAgentConfig,
  toPersistedOperations,
  toPersistedServer,
} from '../services/configurationPersistence';

interface AIChatPanelProps {
  logs: LogEntry[];
  activeServerId: string | null;
  onInsertCommand: (command: string) => void;
  onSwitchServer?: (serverId: string) => void;
  onAICommand?: (command: string | null) => void;
  onOpenMultiIPCenter?: () => void;
}

export interface AIChatPanelRef {
  triggerExternalPrompt: (text: string) => void;
  createNewSession: (serverId: string) => Promise<void>;
}

export const AIChatPanel = forwardRef<AIChatPanelRef, AIChatPanelProps>(({ logs, activeServerId, onInsertCommand, onSwitchServer, onAICommand, onOpenMultiIPCenter }, ref) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const { agentConfig, setAgentConfig } = useAIStore();
  const {
    servers,
    setServers,
    folders,
    setFolders,
    commandTemplates,
    setCommandTemplates,
    commandHistory,
    setCommandHistory,
  } = useSSHStore();
  const { 
    promptTree, 
    setPromptTree,
    selectedPromptIds, 
    setSelectedPromptIds,
    togglePromptSelection,
    selectPrompt,
    deselectPrompt
  } = usePromptStore();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyingCodeId, setCopyingCodeId] = useState<number | null>(null);
  const [isPromptConfigOpen, setIsPromptConfigOpen] = useState(false);
  const [selectedIPs, setSelectedIPs] = useState<SelectedIP[]>([]);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('parallel');
  
  const { createOperation, startOperation, operations, hydrateOperations } = useMultiIPStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const stopSignalRef = useRef<boolean>(false);
  const lastProcessedLogRef = useRef<number>(-1);

  const confirmationResolverRef = useRef<((val: boolean) => void) | null>(null);
  const loadRequestRef = useRef(0);

  // The database is the source of truth for every persisted AI session.
  useEffect(() => {
    if (!activeServerId) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }
    const requestId = ++loadRequestRef.current;
    const loadSessions = async () => {
      try {
        let loadedSessions = await listAiSessions(activeServerId);
        if (loadedSessions.length === 0) {
          const server = servers.find((item) => item.id === activeServerId);
          loadedSessions = [await createAiSession({
            serverId: activeServerId,
            title: `运维会话: ${server?.name || activeServerId}`,
            mode: 'chat',
          })];
        }
        const sessionsWithMessages = await Promise.all(loadedSessions.map(async (session) => ({
          ...session,
          messages: await listAiMessages(session.id),
        })));
        if (requestId !== loadRequestRef.current) return;
        setSessions(sessionsWithMessages);
        setActiveSessionId(sessionsWithMessages[0].id);
        lastProcessedLogRef.current = logs.length;
      } catch (error) {
        console.error('Failed to load AI sessions:', error);
        if (requestId !== loadRequestRef.current) return;
        setSessions([]);
        setActiveSessionId(null);
        alert(`AI 会话加载失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
      }
    };
    void loadSessions();
  }, [activeServerId]);

  const handleExportConfig = async () => {
    try {
      const snapshot = await exportConfiguration();
      const data: ExportConfigData = {
        version: '2.0.0',
        exportDate: new Date().toISOString(),
        agentConfig: snapshot.agentConfig as AgentConfig,
        servers: snapshot.servers.map(server => ({ ...server, status: 'disconnected' })) as Server[],
        folders: snapshot.folders,
        commandTemplates: snapshot.commandTemplates,
        promptTree: snapshot.promptTree,
        selectedPromptIds: snapshot.selectedPromptIds,
        commandHistory: snapshot.commandHistory,
        operations: snapshot.operations,
      };
      const fileName = `gemini-ssh-config-${new Date().toISOString().slice(0, 10)}.json`;
      const result = await saveConfigurationExport(fileName, JSON.stringify(data, null, 2));
      if (!result.canceled) alert('配置备份已导出（不包含密码、私钥和 AI Key）。');
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败：本地数据服务不可用');
    }
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data: ExportConfigData = JSON.parse(event.target?.result as string);

        if (!window.confirm('导入会先自动备份当前配置，再覆盖本机 SQLite 数据，是否继续？')) return;
        const importedPromptTree = data.promptTree ?? (data.promptProfiles ? migrateProfilesToTree(data.promptProfiles) : promptTree);
        const importedSelectedPromptIds = data.selectedPromptIds ?? (
          data.promptProfiles ? importedPromptTree.filter(node => node.type === 'prompt').slice(0, 1).map(node => node.id) : selectedPromptIds
        );
        const saved = await importConfiguration({
          folders: data.folders ?? folders,
          servers: (data.servers ?? servers).map(toPersistedServer),
          commandTemplates: data.commandTemplates ?? commandTemplates,
          promptTree: importedPromptTree,
          selectedPromptIds: importedSelectedPromptIds,
          agentConfig: toPersistedAgentConfig(data.agentConfig ?? agentConfig),
          commandHistory: data.commandHistory ?? commandHistory,
          operations: toPersistedOperations(data.operations ?? operations),
        });

        setServers(saved.servers.map((server) => ({ ...server, status: 'disconnected' })));
        setFolders(saved.folders);
        setCommandTemplates(saved.commandTemplates);
        setCommandHistory(saved.commandHistory);
        setPromptTree(saved.promptTree);
        setSelectedPromptIds(saved.selectedPromptIds);
        setAgentConfig(saved.agentConfig as AgentConfig);
        hydrateOperations(saved.operations);
        alert('配置导入成功，当前连接凭据需要重新输入。');
      } catch (err) {
        console.error('Import failed:', err);
        alert(`导入失败：${err instanceof Error ? err.message : '无效的配置文件'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 辅助函数：将旧版扁平结构迁移为树形结构
  const migrateProfilesToTree = (profiles: PromptProfile[]) => {
    const migratedFolder = {
      id: 'folder-imported',
      name: '导入的配置',
      type: 'folder' as const,
      parentId: null,
      order: 0,
      isExpanded: true
    };
    
    const migratedNodes = profiles.map((profile, index) => ({
      id: profile.id,
      name: profile.name,
      type: 'prompt' as const,
      parentId: 'folder-imported',
      order: index,
      deviceType: profile.deviceType,
      prompt: profile.prompt,
      rules: profile.rules
    }));
    
    return [migratedFolder, ...migratedNodes];
  };

  const activeSession: ChatSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || {
    id: '',
    serverId: activeServerId || undefined,
    title: '正在加载会话',
    messages: [],
    mode: 'chat',
    createdAt: new Date(),
  };
  
  const createNewSession = async (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    const newSession = await createAiSession({
      serverId,
      title: `运维会话: ${server?.name || serverId}`,
      mode: 'chat',
    });
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    lastProcessedLogRef.current = logs.length;
  };

  useImperativeHandle(ref, () => ({
    triggerExternalPrompt: (text: string) => {
      const prompt = `我对这段终端输出很感兴趣，请帮我分析并排查可能的问题：\n\n\`\`\`\n${text}\n\`\`\``;
      sendAIMessage(prompt, false);
    },
    createNewSession
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [sessions, isLoading, activeSessionId]);

  useEffect(() => {
    if (activeSession.mode !== 'chat' || !agentConfig.autoSyncTerminal || isLoading) return;

    const relevantLogs = logs.filter(l => l.serverId === activeServerId);
    if (relevantLogs.length === 0) return;

    for (let i = relevantLogs.length - 1; i >= 0; i--) {
      const log = relevantLogs[i];
      if (i <= lastProcessedLogRef.current) break;

      if (log.type === 'command') {
        const cmdContent = log.content;
        let outputContent = "";
        
        for (let j = i + 1; j < relevantLogs.length; j++) {
          const nextLog = relevantLogs[j];
          if (nextLog.type === 'command') break;
          outputContent += (nextLog.content + "\n");
        }

        if (outputContent.trim()) {
          lastProcessedLogRef.current = relevantLogs.length - 1;
          const prompt = `我刚刚在终端执行了命令：\n\`\`\`bash\n${cmdContent}\n\`\`\`\n\n执行结果如下：\n\`\`\`\n${outputContent}\n\`\`\`\n\n请分析这个结果，如果有错误请给出修复建议，如果是正常输出请简要说明其含义。`;
          sendAIMessage(prompt, false);
          break;
        }
      }
    }
  }, [logs, activeSession.mode, agentConfig.autoSyncTerminal, activeServerId, isLoading]);

  const sendAIMessage = async (text: string, isAction: boolean = false) => {
    if (!activeSessionId) return;
    stopSignalRef.current = false;
    const currentSessionId = activeSessionId; // Capture current session ID

    let userMsg: ChatMessage;
    try {
      userMsg = await createAiMessage(currentSessionId, { role: 'user', content: text });
    } catch (error) {
      console.error('Failed to persist user message:', error);
      alert(`消息保存失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
      return;
    }

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const nextTitle = currentSession?.messages.length === 0
      ? (text.length > 20 ? text.slice(0, 20) + '...' : text)
      : currentSession?.title;
    if (nextTitle && currentSession && nextTitle !== currentSession.title) {
      try {
        const updated = await updateAiSession(currentSessionId, { title: nextTitle });
        setSessions(prev => prev.map(s => s.id === currentSessionId ? {
          ...s,
          title: updated.title,
          mode: updated.mode,
          updatedAt: updated.updatedAt,
        } : s));
      } catch (error) {
        console.error('Failed to update AI session title:', error);
      }
    }

    setSessions(prev => prev.map(s => s.id === currentSessionId ? {
      ...s,
      messages: [...s.messages, userMsg],
      title: nextTitle || s.title,
    } : s));
    setIsLoading(true);

    if (isAction) {
      await handleAgentWorkflow(text, currentSessionId);
    } else {
      let assistantMsg: ChatMessage;
      try {
        assistantMsg = await createAiMessage(currentSessionId, { role: 'assistant', content: '' });
      } catch (error) {
        console.error('Failed to create assistant placeholder:', error);
        setIsLoading(false);
        setSessions(prev => prev.map(s => s.id === currentSessionId ? {
          ...s,
          messages: [...s.messages, { id: `error-${Date.now()}`, role: 'assistant', content: `⚠️ 消息占位保存失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`, timestamp: new Date() }],
        } : s));
        return;
      }
      const aiMsgId = assistantMsg.id;
      setSessions(prev => prev.map(s => s.id === currentSessionId ? {
        ...s,
        messages: [...s.messages, assistantMsg]
      } : s));

      let fullContent = "";
      const historyForAI = [...(currentSession?.messages || []), userMsg];

      try {
        await chatWithAIStream(text, historyForAI, (chunk) => {
          fullContent += chunk;
          setSessions(prev => prev.map(s => s.id === currentSessionId ? {
            ...s,
            messages: s.messages.map(m => m.id === aiMsgId ? { ...m, content: fullContent } : m)
          } : s));
        }, () => stopSignalRef.current);
        await updateAiMessage(currentSessionId, aiMsgId, fullContent);
      } catch (error) {
        console.error('AI Stream Error:', error);
        const errorContent = fullContent + `\n\n⚠️ **通信中断或模型响应错误**: ${error instanceof Error ? error.message : '未知错误'}`;
        setSessions(prev => prev.map(s => s.id === currentSessionId ? {
          ...s,
          messages: s.messages.map(m => m.id === aiMsgId ? { ...m, content: errorContent } : m)
        } : s));
        try {
          await updateAiMessage(currentSessionId, aiMsgId, errorContent);
        } catch (persistError) {
          console.error('Failed to persist AI error message:', persistError);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAgentWorkflow = async (goal: string, targetSessionId: string) => {
    if (!activeServerId) {
      alert("请先连接服务器");
      setIsLoading(false);
      return;
    }
    
    // Capture server ID too, to ensure we execute commands on the correct server
    const targetServerId = activeServerId;

    const requestConfirmation = (command: string): Promise<boolean> => {
      return new Promise((resolve) => {
        confirmationResolverRef.current = resolve;
      });
    };

    let workflowMessages = sessions.find(s => s.id === targetSessionId)?.messages || [];
    const stepHandler = async (step: any) => {
      const lastMsg = workflowMessages[workflowMessages.length - 1];
      const content = step.isDone
        ? `### 🏁 任务完成\n${step.summary || ''}`
        : `**💡 思考**: ${step.thought}\n\n${step.command ? `**🚀 执行命令**: \`${step.command}\`` : ''}`;

      if (step.isDone && lastMsg?.isDone) {
        const updatedMessage = await updateAiMessage(targetSessionId, lastMsg.id, content);
        setSessions(prev => prev.map(s => s.id === targetSessionId ? {
          ...s,
          messages: s.messages.map(message => message.id === lastMsg.id ? {
            ...message,
            ...updatedMessage,
            isDone: true,
            summary: step.summary,
          } : message),
        } : s));
        workflowMessages = workflowMessages.map(message => message.id === lastMsg.id ? {
          ...message,
          ...updatedMessage,
          isDone: true,
          summary: step.summary,
        } : message);
        return;
      }

      const stepMsg = await createAiMessage(targetSessionId, {
        role: 'assistant',
        content,
      });
      const renderedStep = {
        ...stepMsg,
        isThought: !step.isDone,
        isPendingConfirmation: step.requiresConfirmation,
        commandToExecute: step.command,
        confirmationStatus: step.requiresConfirmation ? 'pending' as const : undefined,
        isDone: step.isDone,
        summary: step.summary,
      };
      workflowMessages = [...workflowMessages, renderedStep];
      setSessions(prev => prev.map(s => s.id === targetSessionId ? {
        ...s,
        messages: [...s.messages, renderedStep],
      } : s));
    };

    (stepHandler as any).execute = async (cmd: string) => {
      if (onAICommand) onAICommand(cmd);
      try {
        return await sshManager.executeCommand(cmd, targetServerId);
      } finally {
        if (onAICommand) onAICommand(null);
      }
    };

    try {
      await runAutonomousTask(goal, agentConfig, stepHandler, requestConfirmation, () => stopSignalRef.current);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = (msgId: string, confirmed: boolean) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: s.messages.map(m => m.id === msgId ? { 
        ...m, 
        isPendingConfirmation: false, 
        confirmationStatus: confirmed ? 'confirmed' : 'cancelled' 
      } : m)
    } : s));

    if (confirmationResolverRef.current) {
      confirmationResolverRef.current(confirmed);
      confirmationResolverRef.current = null;
    }
  };

  const handleCopySummary = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyingId(msgId);
      setTimeout(() => setCopyingId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleNewSession = async () => {
    if (!activeServerId) {
      alert("请先选择一个服务器");
      return;
    }
    try {
      const newSession = await createAiSession({
        serverId: activeServerId,
        title: `新会话 ${new Date().toLocaleTimeString()}`,
        mode: 'chat',
      });
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      lastProcessedLogRef.current = logs.length;
    } catch (error) {
      alert(`创建会话失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
    }
  };

  const handleClearSession = async () => {
    if (!confirm('确定要清空当前会话记录吗？')) return;
    if (!activeSessionId) return;
    try {
      await clearAiMessages(activeSessionId);
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [] } : s));
    } catch (error) {
      alert(`清空会话失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除此会话吗？此操作不可恢复。')) return;
    try {
      await deleteAiSession(sessionId);
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      if (sessionId === activeSessionId) {
        if (remainingSessions.length > 0) {
          setActiveSessionId(remainingSessions[0].id);
        } else if (activeServerId) {
          const replacement = await createAiSession({ serverId: activeServerId, title: '新的运维会话', mode: 'chat' });
          setSessions([replacement]);
          setActiveSessionId(replacement.id);
          return;
        } else {
          setActiveSessionId(null);
        }
      }
      setSessions(remainingSessions);
    } catch (error) {
      alert(`删除会话失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
    }
  };

  const handleExportMarkdown = () => {
    const content = activeSession.messages.map(m => {
      const role = m.role === 'user' ? 'User' : 'Assistant';
      const time = m.timestamp.toLocaleString();
      return `### ${role} (${time})\n\n${m.content}\n`;
    }).join('\n---\n\n');
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${activeSessionId}-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    if ((!input.trim() && selectedIPs.length === 0) || isLoading) return;
    
    // 如果选择了多个 IP，创建多 IP 操作
    if (selectedIPs.length > 0) {
      const operationId = createOperation(
        input.trim() || '批量执行',
        `向 ${selectedIPs.length} 台服务器执行指令`,
        selectedIPs,
        executionMode
      );
      
      if (!activeSessionId) return;
      const multiIPContent = `[多 IP 操作] 目标: ${selectedIPs.length} 台服务器\n指令: ${input || '(AI 自主决策)'}`;
      try {
        const multiIPMsg = await createAiMessage(activeSessionId, { role: 'user', content: multiIPContent });
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, multiIPMsg] } : s));
      } catch (error) {
        alert(`多 IP 操作消息保存失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
        return;
      }
      
      // 打开多 IP 操作中心
      onOpenMultiIPCenter?.();
      
      // 清空输入和选中的 IP
      setInput('');
      setSelectedIPs([]);
      
      // 启动多 IP 智能执行流程
      setTimeout(() => {
        multiIPAgentService.executeTask(operationId, input, (step, operation) => {
          // 进度回调 - 可以在这里添加实时通知
          console.log(`[MultiIP] Step ${step.stepNumber} ${step.status}`);
        }).catch(error => {
          console.error('[MultiIP] Execution error:', error);
        });
      }, 100);
      
      return;
    }
    
    const text = input;
    setInput('');
    sendAIMessage(text, activeSession.mode === 'action');
  };

  const handleStop = () => {
    stopSignalRef.current = true;
    setIsLoading(false);
  };

  const LogHighlighter = ({ text }: { text: string }) => {
    const lines = text.split('\n');
    return (
      <div className="font-mono text-xs space-y-0.5">
        {lines.map((line, i) => {
          const isError = /error|fail|critical|fatal/i.test(line);
          const isWarn = /warn|warning/i.test(line);
          const isInfo = /info|notice/i.test(line);
          
          let colorClass = 'text-sci-text/80';
          if (isError) colorClass = 'text-red-400 bg-red-400/10 px-1 rounded';
          else if (isWarn) colorClass = 'text-orange-300 bg-orange-300/10 px-1 rounded';
          else if (isInfo) colorClass = 'text-sci-cyan/80 bg-sci-cyan/5 px-1 rounded';

          return (
            <div key={i} className={`${colorClass} whitespace-pre-wrap break-all`}>
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  const LogAnalysisView = ({ data }: { data: any }) => {
    if (!data || typeof data !== 'object') return null;
    
    const { summary, details, recommendations } = data;
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="my-4 space-y-4"
      >
        {/* 概览卡片 */}
        <div className="grid grid-cols-3 gap-3">
          {summary && Object.entries(summary).map(([key, value]: [string, any]) => (
            <div key={key} className="bg-black/40 border border-white/5 p-3 clip-corner text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-sci-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1 font-sci relative z-10">{key}</div>
              <div className={`text-xl font-black font-sci relative z-10 ${
                key.toLowerCase().includes('error') ? 'text-red-400' : 
                key.toLowerCase().includes('warn') ? 'text-orange-300' : 'text-sci-cyan'
              }`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* 详细分析 */}
        {details && (
          <div className="bg-sci-panel/40 border border-white/10 p-4 clip-corner relative">
             <div className="absolute top-0 left-0 w-1 h-full bg-sci-cyan/30"></div>
            <div className="flex items-center gap-2 mb-3 text-sci-cyan/60">
              <Activity size={14}/>
              <span className="text-[10px] font-sci font-black uppercase tracking-widest">异常检测详情</span>
            </div>
            <div className="space-y-2">
              {Array.isArray(details) ? details.map((item, i) => (
                <div key={i} className="flex gap-3 text-xs border-l-2 border-sci-cyan/20 pl-3 py-1 hover:bg-white/5 transition-colors">
                  <span className="text-white/40 font-mono shrink-0">#{i+1}</span>
                  <span className="text-sci-text/90">{item}</span>
                </div>
              )) : <div className="text-xs text-sci-text/90">{details}</div>}
            </div>
          </div>
        )}

        {/* 修复建议 */}
        {recommendations && (
          <div className="bg-sci-green/5 border border-sci-green/20 p-4 clip-corner">
            <div className="flex items-center gap-2 mb-3 text-sci-green/60">
              <Wand2 size={14}/>
              <span className="text-[10px] font-sci font-black uppercase tracking-widest">修复与优化建议</span>
            </div>
            <div className="space-y-2">
              {Array.isArray(recommendations) ? recommendations.map((item, i) => (
                <div key={i} className="flex gap-2 text-xs items-start">
                  <Check size={12} className="text-sci-green mt-0.5 shrink-0"/>
                  <span className="text-sci-text/90">{item}</span>
                </div>
              )) : <div className="text-xs text-sci-text/90">{recommendations}</div>}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const MarkdownRenderer = ({ content }: { content: string }) => (
    <ReactMarkdown
      components={{
        pre: ({node, children, ...props}) => {
          return (
            <pre className="!bg-black/60 !p-0 !m-0 !border-none overflow-hidden clip-corner border border-white/5" {...props}>
              {children}
            </pre>
          );
        },
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');
          const codeId = Math.random();

          // 特殊处理日志分析 JSON
          if (lang === 'json' && codeString.includes('"log_analysis"')) {
            try {
              const data = JSON.parse(codeString);
              if (data.log_analysis) {
                return <LogAnalysisView data={data.log_analysis} />;
              }
            } catch (e) {
              console.error('Failed to parse log analysis JSON', e);
            }
          }

          // 特殊处理日志内容
          if (lang === 'log') {
            return <LogHighlighter text={codeString} />;
          }
          
          const handleCopyCode = async () => {
            try {
              await navigator.clipboard.writeText(codeString);
              setCopyingCodeId(codeId);
              setTimeout(() => setCopyingCodeId(null), 2000);
            } catch (err) {
              console.error('Failed to copy code: ', err);
            }
          };
          
          const handleInsertCode = () => {
            onInsertCommand(codeString);
          };
          
          return !inline && match ? (
            <div className="relative group/code">
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                <button 
                  onClick={handleCopyCode}
                  className={`p-1.5 border clip-corner transition-all ${copyingCodeId === codeId ? 'bg-sci-green text-black border-sci-green' : 'bg-black/80 text-sci-cyan border-sci-cyan/30 hover:bg-sci-cyan hover:text-black'}`}
                  title={copyingCodeId === codeId ? '已复制' : '复制命令'}
                >
                  {copyingCodeId === codeId ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button 
                  onClick={handleInsertCode}
                  className="p-1.5 bg-black/80 text-sci-cyan border border-sci-cyan/30 clip-corner hover:bg-sci-cyan hover:text-black transition-all"
                  title="注入到终端"
                >
                  <TerminalIcon size={12} />
                </button>
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus as any}
                customStyle={{ 
                  backgroundColor: 'transparent', 
                  padding: '1.5rem', 
                  borderRadius: '0', 
                  margin: '0',
                  fontSize: '12px',
                  fontFamily: '"Fira Code", monospace'
                }}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          ) : ( <code className="!bg-sci-cyan/10 px-1.5 py-0.5 !text-sci-cyan font-mono text-[0.9em] border border-sci-cyan/20" {...props}>{children}</code> );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div ref={containerRef} className="flex h-full bg-sci-base border-l border-white/5 shadow-2xl relative">
      <div className={`bg-sci-obsidian border-r border-white/5 flex flex-col transition-all duration-300 ${showHistory ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="text-[10px] font-black uppercase tracking-widest text-sci-cyan/40 font-sci">任务会话</div>
          <button className="p-1 hover:bg-white/5 text-sci-text/60 hover:text-sci-cyan transition-colors" onClick={() => setShowHistory(false)}><PanelLeftClose size={14}/></button>
        </div>
        <div className="p-3">
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-sci-cyan/10 border border-sci-cyan/30 text-sci-cyan text-xs font-sci font-bold uppercase tracking-widest hover:bg-sci-cyan hover:text-black transition-all clip-corner" onClick={handleNewSession}>
            <PlusCircle size={14}/> 开启新会话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-1 mt-2 custom-scrollbar">
          {sessions.filter(s => s.serverId === activeServerId).map(s => (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              key={s.id} 
              onClick={() => { 
                if (s.serverId && onSwitchServer && s.serverId !== activeServerId) {
                  onSwitchServer(s.serverId);
                }
                setActiveSessionId(s.id); 
                lastProcessedLogRef.current = logs.length; 
              }} 
              className={`p-3 cursor-pointer text-xs flex flex-col gap-1 border transition-all clip-corner group ${activeSessionId === s.id ? 'bg-sci-cyan/10 border-sci-cyan/30 text-sci-cyan font-bold' : 'border-transparent hover:bg-white/5 text-sci-text'}`}
            >
              <div className="flex items-center gap-2">
                 <Activity size={14} className="shrink-0"/> 
                 <span className="truncate flex-1 font-sci uppercase tracking-tight">{s.title}</span>
                 <button
                   onClick={(e) => handleDeleteSession(s.id, e)}
                   className="opacity-0 group-hover:opacity-100 p-1 hover:bg-sci-red/20 text-sci-text/60 hover:text-sci-red rounded transition-all"
                   title="删除会话"
                 >
                   <Trash2 size={12} />
                 </button>
              </div>
              <div className="flex items-center gap-2 pl-6 text-[9px] text-white/40 font-mono">
                 <span>节点: {s.serverId || 'N/A'}</span>
                 <span>•</span>
                 <span>{s.createdAt.toLocaleDateString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-sci-base">
        <div 
          className="h-14 px-4 bg-sci-panel/80 backdrop-blur-md flex items-center justify-between border-b border-white/5 shrink-0 relative z-20"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          <div className="flex items-center gap-3 min-w-0">
            {!showHistory && <button style={{ WebkitAppRegion: 'no-drag' } as any} className="p-1.5 hover:bg-white/5 text-sci-text/60 hover:text-sci-cyan transition-colors shrink-0" onClick={() => setShowHistory(true)}><PanelLeft size={18}/></button>}
            <div className="truncate min-w-0">
              <h2 className="font-sci font-bold text-sm truncate text-sci-text uppercase tracking-widest">
                <GlitchText text={activeSession.title} />
              </h2>
              <div className="text-[9px] text-sci-cyan/70 uppercase tracking-[0.2em] font-black font-sci truncate">神经链路 AI 助手</div>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button onClick={() => setIsPromptConfigOpen(true)} className="h-8 px-2 flex items-center justify-center text-sci-text/80 hover:text-sci-violet transition-all hover:opacity-100" title="设备类型提示语配置">
              <Sparkles size={14}/>
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="h-8 px-2 flex items-center justify-center text-sci-text/80 hover:text-sci-cyan transition-all hover:opacity-100" title="神经核心配置">
              <Settings2 size={14}/>
            </button>
            {window.innerWidth < 1024 && (
              <button 
                onClick={() => useSSHStore.getState().setIsAIPanelOpen(false)} 
                className="h-8 px-2 flex items-center justify-center text-sci-red/80 hover:text-sci-red transition-all hover:bg-sci-red/10 rounded-lg ml-1"
                title="关闭 AI 面板"
              >
                <X size={18}/>
              </button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth custom-scrollbar bg-sci-base/20 relative">
          {/* 背景装饰 */}
          <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden">
             <div className="absolute top-10 left-10 w-64 h-64 border border-sci-cyan rounded-full animate-pulse"></div>
             <div className="absolute bottom-10 right-10 w-96 h-96 border border-sci-violet rounded-full animate-pulse delay-700"></div>
          </div>
          <AnimatePresence initial={false}>
            {activeSession.messages.length === 0 ? (
              <AIEmptyState onAction={(text) => {
                setInput(text);
                // Optional: auto-send
                // sendAIMessage(text, activeSession.mode === 'action');
              }} />
            ) : (
              activeSession.messages.map(msg => (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[95%] p-4 text-[13px] border shadow-lg transition-all clip-corner relative group/msg
                  ${msg.isDone ? 'bg-sci-green/10 border-sci-green/30 text-sci-green' : 
                    msg.isThought ? 'bg-sci-violet/10 border-sci-violet/30 border-l-4 border-l-sci-violet' : 
                    msg.role === 'user' ? 'bg-sci-cyan/10 text-sci-text border-sci-cyan/30' : 
                    'bg-sci-panel/80 backdrop-blur-md border-white/10 text-sci-text'}`}>
                  
                  {/* 装饰性角落 */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20"></div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20"></div>

                  {/* 任务完成特殊头部 */}
                  {msg.isDone && (
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-sci-green/20">
                      <div className="flex items-center gap-2 text-sci-green">
                        <Sparkles size={18} className="animate-pulse"/>
                        <span className="font-sci font-black uppercase tracking-wider text-[11px]">任务已完成</span>
                      </div>
                      {msg.summary && (
                        <button 
                          onClick={() => handleCopySummary(msg.id, msg.summary || '')} 
                          className="p-1 hover:bg-sci-green/20 transition-colors"
                          title="复制总结报告"
                        >
                          {copyingId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 思考状态头部 */}
                  {msg.isThought && !msg.isDone && (
                    <div className="flex items-center gap-2 mb-3 text-sci-violet/60">
                      <BrainCircuit size={14} className="animate-pulse"/>
                      <span className="text-[10px] font-sci font-black uppercase tracking-widest">正在处理序列...</span>
                    </div>
                  )}

                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0 prose-code:text-sci-cyan">
                    <MarkdownRenderer content={msg.content} />
                  </div>

                  {/* 确认操作按钮 */}
                  {msg.isPendingConfirmation && msg.commandToExecute && (
                    <div className="mt-4 p-4 bg-black/40 border border-sci-violet/30 clip-corner">
                      <div className="flex items-center gap-2 mb-3 text-sci-violet">
                        <ShieldAlert size={16}/>
                        <span className="text-xs font-sci font-bold uppercase tracking-widest">需要授权</span>
                      </div>
                      <code className="block p-3 bg-black/60 text-sci-violet font-mono text-xs mb-4 border-l-2 border-sci-violet">
                        {msg.commandToExecute}
                      </code>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleConfirmation(msg.id, true)}
                          className="flex-1 py-2 bg-sci-violet text-black font-sci font-bold text-xs uppercase tracking-widest hover:bg-sci-violet/80 transition-all clip-corner shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                        >
                          执行
                        </button>
                        <button 
                          onClick={() => handleConfirmation(msg.id, false)}
                          className="flex-1 py-2 bg-white/5 text-sci-text/60 font-sci font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all clip-corner"
                        >
                          中止
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 已执行/已取消状态 */}
                  {msg.confirmationStatus && (
                    <div className={`mt-3 flex items-center gap-2 text-[10px] font-sci font-bold uppercase tracking-widest ${msg.confirmationStatus === 'confirmed' ? 'text-sci-green' : 'text-sci-red'}`}>
                      {msg.confirmationStatus === 'confirmed' ? (
                        <><ShieldCheck size={12}/> 序列已授权</>
                      ) : (
                        <><ZapOff size={12}/> 序列已中止</>
                      )}
                    </div>
                  )}

                  <div className={`mt-2 text-[9px] font-mono opacity-30 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </motion.div>
            )))}
          </AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-start"
            >
              <div className="bg-sci-panel/40 border border-white/5 p-4 clip-corner">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-4 h-4 border-2 border-sci-cyan/20 border-t-sci-cyan rounded-full animate-spin"></div>
                    <div className="absolute inset-0 bg-sci-cyan/10 blur-sm rounded-full animate-pulse"></div>
                  </div>
                  <span className="text-xs font-sci font-bold text-sci-cyan/60 uppercase tracking-[0.2em]">正在同步...</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 输入区 */}
        <div className="p-4 bg-sci-panel/80 border-t border-white/5 backdrop-blur-md relative z-20">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex bg-black/40 p-1 border border-white/5 gap-1 clip-corner shrink-0">
              <div className="group relative">
                <button 
                  onClick={async () => {
                    if (!activeSessionId || activeSession.mode === 'chat') return;
                    try {
                      const updated = await updateAiSession(activeSessionId, { mode: 'chat' });
                      setSessions(prev => prev.map(s => s.id === activeSessionId ? {
                        ...s,
                        title: updated.title,
                        mode: updated.mode,
                        updatedAt: updated.updatedAt,
                      } : s));
                      lastProcessedLogRef.current = logs.length - 1;
                    } catch (error) {
                      alert(`切换聊天模式失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
                    }
                  }}
                  className={`h-7 px-3 flex items-center justify-center transition-all ${activeSession.mode === 'chat' ? 'bg-sci-cyan text-black font-bold' : 'bg-transparent text-sci-text hover:text-sci-cyan'}`}
                >
                  <Zap size={12}/>
                  {containerWidth > 380 && <span className="ml-2 text-[10px] font-sci uppercase tracking-wider">聊天</span>}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 font-sci">聊天模式</div>
              </div>
              <div className="group relative">
                <button 
                  onClick={async () => {
                    if (!activeSessionId || activeSession.mode === 'action') return;
                    try {
                      const updated = await updateAiSession(activeSessionId, { mode: 'action' });
                      setSessions(prev => prev.map(s => s.id === activeSessionId ? {
                        ...s,
                        title: updated.title,
                        mode: updated.mode,
                        updatedAt: updated.updatedAt,
                      } : s));
                    } catch (error) {
                      alert(`切换 Agent 模式失败：${error instanceof Error ? error.message : '本地数据服务不可用'}`);
                    }
                  }}
                  className={`h-7 px-3 flex items-center justify-center transition-all ${activeSession.mode === 'action' ? 'bg-sci-violet text-black font-bold' : 'bg-transparent text-sci-text hover:text-sci-violet'}`}
                >
                  <BrainCircuit size={12}/>
                  {containerWidth > 380 && <span className="ml-2 text-[10px] font-sci uppercase tracking-wider">Agent</span>}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 font-sci">Agent 模式</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* 多选提示语下拉框 */}
              <div className="group relative">
                <MultiSelectPrompt
                  selectedIds={selectedPromptIds}
                  promptTree={promptTree}
                  onToggle={togglePromptSelection}
                  containerWidth={containerWidth}
                />
              </div>
              <div className="group relative">
                <button 
                  onClick={handleClearSession} 
                  className="h-8 px-2 flex items-center justify-center text-sci-text/80 hover:text-sci-red transition-all hover:opacity-100"
                >
                  <Eraser size={14}/>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 font-sci">清空会话</div>
              </div>
              <div className="group relative">
                <button 
                  onClick={handleExportMarkdown} 
                  className="h-8 px-2 flex items-center justify-center text-sci-text/80 hover:text-sci-cyan transition-all hover:opacity-100"
                >
                  <FileDown size={14}/>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 font-sci">导出 Markdown</div>
              </div>
              <div className="w-px h-4 bg-white/10 mx-1"></div>
            </div>
          </div>
          {/* 多 IP 模式指示器和控制 */}
          {selectedIPs.length > 0 && (
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-sci-cyan font-medium">
                  多 IP 模式 ({selectedIPs.length} 台)
                </span>
                <div className="flex gap-1">
                  {(['parallel', 'sequential', 'adaptive'] as ExecutionMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setExecutionMode(mode)}
                      className={`px-2 py-0.5 text-[9px] rounded transition-all ${
                        executionMode === mode
                          ? 'bg-sci-cyan/30 text-sci-cyan border border-sci-cyan/50'
                          : 'bg-black/20 text-sci-dim/60 border border-transparent hover:border-sci-cyan/30'
                      }`}
                      title={
                        mode === 'parallel' ? '所有服务器同时执行' :
                        mode === 'sequential' ? '逐个服务器执行' :
                        '根据结果动态调整'
                      }
                    >
                      {mode === 'parallel' && '并行'}
                      {mode === 'sequential' && '串行'}
                      {mode === 'adaptive' && '自适应'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 items-start">
            <div className="flex-1 relative">
              <IPSelectorInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                placeholder={activeSession.mode === 'action' ? "定义任务目标..." : "输入/选择多个 IP 或者 与 AI 进行通信..."}
                selectedIPs={selectedIPs}
                onSelectedIPsChange={setSelectedIPs}
              />
            </div>
            <button 
              onClick={isLoading ? handleStop : handleSend}
              disabled={!input.trim() && !isLoading && selectedIPs.length === 0}
              className={`h-[42px] px-6 flex items-center gap-2 font-sci font-bold text-xs uppercase tracking-[0.2em] transition-all clip-corner mt-0
                ${isLoading 
                  ? 'bg-sci-red/10 border border-sci-red/50 text-sci-red hover:bg-sci-red hover:text-black shadow-[0_0_15px_rgba(255,42,0,0.2)]'
                  : selectedIPs.length > 0
                    ? 'bg-sci-cyan/10 border border-sci-cyan/50 text-sci-cyan hover:bg-sci-cyan hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                    : activeSession.mode === 'action' 
                      ? 'bg-sci-violet/10 border border-sci-violet/50 text-sci-violet hover:bg-sci-violet hover:text-black shadow-[0_0_15px_rgba(139,92,246,0.2)]' 
                      : 'bg-sci-cyan/10 border border-sci-cyan/50 text-sci-cyan hover:bg-sci-cyan hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.2)]'}
                disabled:opacity-20 disabled:pointer-events-none`}
            >
              {isLoading ? (
                <>
                  <Square size={16} fill="currentColor" className="animate-pulse" />
                  {containerWidth > 400 && <span>中止</span>}
                </>
              ) : (
                <>
                  <Send size={16}/>
                  {containerWidth > 400 && <span>传输</span>}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isSettingsOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-sci-obsidian border border-sci-cyan/30 drop-shadow-[0_0_40px_rgba(0,243,255,0.18)] clip-corner overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-sci-panel/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sci-cyan/10 border border-sci-cyan/30 text-sci-cyan"><BrainCircuit size={20}/></div>
                <div>
                  <h3 className="font-sci font-bold text-lg text-sci-text uppercase tracking-widest">神经核心配置</h3>
                  <p className="text-[10px] text-sci-cyan/40 uppercase tracking-[0.2em] font-bold font-sci">编排引擎设置</p>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 hover:bg-white/5 text-sci-text/60 hover:text-sci-red transition-colors"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* 数据备份与还原 */}
              <div className="space-y-3">
                <label className="text-[11px] font-sci font-bold text-sci-text uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck size={14} className="text-sci-cyan"/> 数据管理 (备份与还原)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleExportConfig}
                    className="flex items-center justify-center gap-2 py-2 bg-sci-cyan/10 border border-sci-cyan/30 text-[11px] text-sci-cyan hover:bg-sci-cyan hover:text-black transition-all clip-corner font-sci font-bold uppercase tracking-widest"
                  >
                    <FileDown size={14} /> 导出配置
                  </button>
                  <label className="flex items-center justify-center gap-2 py-2 bg-sci-violet/10 border border-sci-violet/30 text-[11px] text-sci-violet hover:bg-sci-violet hover:text-black transition-all clip-corner font-sci font-bold uppercase tracking-widest cursor-pointer">
                    <FileUp size={14} /> 导入配置
                    <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-sci-cyan/5 border border-sci-cyan/20 clip-corner">
                <div className="flex items-center gap-3">
                  <div className={`p-2 transition-colors ${agentConfig.autoSyncTerminal ? 'text-sci-cyan' : 'text-white/30'}`}><Wand2 size={18}/></div>
                  <div>
                    <h4 className="text-xs font-sci font-bold text-sci-text uppercase tracking-wider">自动同步分析</h4>
                    <p className="text-[9px] text-white/60 font-sci">在聊天模式下自动分析终端输出</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAgentConfig({...agentConfig, autoSyncTerminal: !agentConfig.autoSyncTerminal})}
                  className={`w-10 h-5 rounded-full relative transition-colors ${agentConfig.autoSyncTerminal ? 'bg-sci-cyan' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${agentConfig.autoSyncTerminal ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-sci font-bold text-sci-text uppercase tracking-widest flex items-center gap-2">
                    <Activity size={14} className="text-sci-cyan"/> 最大迭代次数
                  </label>
                  <span className="text-xs font-mono text-sci-cyan bg-sci-cyan/10 px-2 py-0.5 border border-sci-cyan/20">{agentConfig.maxAttempts}</span>
                </div>
                <input 
                  type="range" min="1" max="50" 
                  value={agentConfig.maxAttempts} 
                  onChange={e => setAgentConfig({...agentConfig, maxAttempts: parseInt(e.target.value)})} 
                  className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-sci-cyan" 
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-sci font-bold text-sci-text uppercase tracking-widest flex items-center gap-2">
                    <History size={14} className="text-sci-violet"/> 上下文记忆轮数
                  </label>
                  <span className="text-xs font-mono text-sci-violet bg-sci-violet/10 px-2 py-0.5 border border-sci-violet/20">{agentConfig.maxMemoryMessages || 10}</span>
                </div>
                <input 
                  type="range" min="1" max="50" 
                  value={agentConfig.maxMemoryMessages || 10} 
                  onChange={e => setAgentConfig({...agentConfig, maxMemoryMessages: parseInt(e.target.value)})} 
                  className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-sci-violet" 
                />
                <p className="text-[9px] text-white/40 font-sci italic">控制 AI 记忆的对话轮数，数值越大消耗 Token 越多。</p>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-sci font-bold text-sci-text uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={14} className="text-sci-violet"/> 操作指令规范
                </label>
                <div className="w-full bg-black/40 border border-white/10 text-sci-text p-3 text-xs clip-corner">
                  <div className="flex items-center justify-between">
                    <p className="text-white/70">已迁移至“设备类型提示语配置”。请前往进行编辑与管理。</p>
                    <button 
                      onClick={() => setIsPromptConfigOpen(true)} 
                      className="px-2 py-1 text-[10px] bg-sci-violet/10 text-sci-violet border border-sci-violet/30 clip-corner hover:bg-sci-violet hover:text-black transition-all"
                    >
                      打开配置
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-sci font-bold text-sci-text uppercase tracking-widest flex items-center gap-2">
                    <Cpu size={14} className="text-sci-cyan"/> OpenAI 兼容模型
                  </label>
                </div>

                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-[9px] text-white/40 font-sci">支持所有 OpenAI API 兼容服务</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="OpenAI 兼容 API 地址"
                      value={agentConfig.customUrl || ''}
                      onChange={e => setAgentConfig({...agentConfig, customUrl: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 text-sci-text px-3 py-2 text-[11px] font-mono focus:border-sci-cyan/30 outline-none transition-all clip-corner"
                    />
                    <input
                      type="password"
                      placeholder="API Key"
                      value={agentConfig.customKey || ''}
                      onChange={e => setAgentConfig({...agentConfig, customKey: e.target.value})}
                      onBlur={async () => {
                        const apiKey = agentConfig.customKey?.trim();
                        if (!apiKey) return;
                        try {
                          await saveApiKey(apiKey);
                          setAgentConfig((current) => ({ ...current, customKey: '' }));
                        } catch (error) {
                          console.error('Failed to save AI API key:', error);
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 text-sci-text px-3 py-2 text-[11px] font-mono focus:border-sci-cyan/30 outline-none transition-all clip-corner"
                    />
                    <input
                      type="text"
                      placeholder="模型名（如 gpt-4o）"
                      value={agentConfig.customModelName || ''}
                      onChange={e => setAgentConfig({...agentConfig, customModelName: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 text-sci-text px-3 py-2 text-[11px] font-mono focus:border-sci-cyan/30 outline-none transition-all clip-corner"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-sci font-bold text-sci-text uppercase tracking-widest flex items-center gap-2">
                    <Thermometer size={14} className="text-sci-violet"/> 发散等级 (Temperature)
                  </label>
                  <span className="text-xs font-mono text-sci-violet bg-sci-violet/10 px-2 py-0.5 border border-sci-violet/20">{agentConfig.temperature}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={agentConfig.temperature} 
                  onChange={e => setAgentConfig({...agentConfig, temperature: parseFloat(e.target.value)})} 
                  className="w-full h-1 bg-white/10 appearance-none cursor-pointer accent-sci-violet" 
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-sci-green/5 border border-sci-green/20 clip-corner">
                <div className="flex items-center gap-3">
                  <div className={`p-2 transition-colors ${agentConfig.safeMode ? 'text-sci-green' : 'text-white/30'}`}><ShieldAlert size={18}/></div>
                  <div>
                    <h4 className="text-xs font-sci font-bold text-sci-text uppercase tracking-wider">安全协议</h4>
                    <p className="text-[9px] text-white/60 font-sci">对敏感序列执行强制授权</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAgentConfig({...agentConfig, safeMode: !agentConfig.safeMode})}
                  className={`w-10 h-5 rounded-full relative transition-colors ${agentConfig.safeMode ? 'bg-sci-green' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${agentConfig.safeMode ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>

            <div className="p-6 bg-sci-panel/50 border-t border-white/10">
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="w-full py-2 bg-sci-cyan text-black font-sci font-bold text-xs uppercase tracking-[0.2em] hover:bg-sci-cyan/80 transition-all clip-corner shadow-[0_0_20px_rgba(0,243,255,0.2)]"
              >
                应用配置
              </button>
            </div>
          </div>
        </div>
      , document.body)}
      {isPromptConfigOpen && <PromptConfigModal onClose={() => setIsPromptConfigOpen(false)} />}
    </div>
  );
});

// 多选提示语组件 (树形结构)
interface MultiSelectPromptProps {
  selectedIds: string[];
  promptTree: import('../types').PromptNode[];
  onToggle: (id: string) => void;
  containerWidth: number;
}

// 获取子节点
const getChildNodes = (tree: import('../types').PromptNode[], parentId: string | null): import('../types').PromptNode[] => {
  return tree
    .filter(node => node.parentId === parentId)
    .sort((a, b) => a.order - b.order);
};

const MultiSelectPrompt: React.FC<MultiSelectPromptProps> = ({
  selectedIds,
  promptTree,
  onToggle,
  containerWidth
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 初始化展开所有文件夹
  useEffect(() => {
    const folderIds = promptTree
      .filter(n => n.type === 'folder')
      .map(n => n.id);
    setExpandedFolders(new Set(folderIds));
  }, [promptTree]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const selectedLabels = selectedIds
    .map(id => promptTree.find(n => n.id === id)?.name)
    .filter(Boolean);

  const displayText = selectedLabels.length === 0
    ? '选择提示语'
    : selectedLabels.length === 1
      ? selectedLabels[0]
      : `已选 ${selectedLabels.length} 个`;

  // 递归渲染树节点
  const renderTreeNode = (node: import('../types').PromptNode, level: number = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedIds.includes(node.id);
    const children = getChildNodes(promptTree, node.id);

    if (isFolder) {
      return (
        <div key={node.id}>
          <button
            onClick={() => toggleFolder(node.id)}
            className="
              w-full px-2 py-1.5 text-xs text-left flex items-center gap-1
              text-sci-cyan/80 hover:bg-white/5 transition-all
            "
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${isExpanded ? '' : '-rotate-90'}`}
            />
            <span className="truncate">📁 {node.name}</span>
          </button>
          {isExpanded && children.length > 0 && (
            <div>
              {children.map(child => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // 提示语节点
    return (
      <button
        key={node.id}
        onClick={() => onToggle(node.id)}
        className={`
          w-full px-2 py-1.5 text-xs text-left flex items-center gap-2
          transition-all clip-corner
          ${isSelected
            ? 'bg-sci-violet/20 text-sci-violet border border-sci-violet/30'
            : 'text-sci-text hover:bg-white/5 border border-transparent'
          }
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <div className={`
          w-4 h-4 border rounded flex items-center justify-center shrink-0
          ${isSelected ? 'bg-sci-violet border-sci-violet' : 'border-white/30'}
        `}>
          {isSelected && <Check size={10} className="text-black" />}
        </div>
        <span className="truncate flex-1">📝 {node.name}</span>
      </button>
    );
  };

  const rootNodes = getChildNodes(promptTree, null);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          h-8 px-3 flex items-center gap-2 bg-black/40 border border-sci-violet/30
          text-sci-text text-xs font-sci uppercase tracking-wider
          hover:border-sci-violet/60 transition-all clip-corner
          ${isOpen ? 'border-sci-violet bg-sci-violet/10' : ''}
        `}
        style={{ minWidth: containerWidth <= 520 ? '120px' : '150px' }}
      >
        <span className="truncate flex-1 text-left">{displayText}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="
          absolute bottom-full left-0 mb-1 z-50
          min-w-[220px] max-w-[300px] max-h-[300px]
          bg-sci-obsidian border border-sci-violet/30
          shadow-[0_0_20px_rgba(139,92,246,0.2)]
          overflow-y-auto custom-scrollbar
        ">
          <div className="p-1">
            {rootNodes.length === 0 ? (
              <div className="px-3 py-2 text-xs text-white/40 text-center">
                暂无提示语配置
              </div>
            ) : (
              rootNodes.map(node => renderTreeNode(node, 0))
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="p-2 border-t border-white/10 bg-black/20">
              <button
                onClick={() => {
                  selectedIds.forEach(id => onToggle(id));
                }}
                className="w-full px-3 py-1.5 text-[10px] text-sci-red/80 hover:text-sci-red
                  hover:bg-sci-red/10 transition-all text-center"
              >
                清除全部选择
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
