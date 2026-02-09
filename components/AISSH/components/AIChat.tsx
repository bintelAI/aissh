import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, LogEntry } from '../types/index';
import { Button } from '../common/Button';
import { chatWithAI, analyzeLogs } from '../services/geminiService';
import { IPSelectorInput } from './IPSelectorInput';
import { useSSHStore } from '../store/useSSHStore';
import { multiIPExecutor, SelectedIP, ExecutionMode } from '../services/multiIPExecutor';
import { Send, Server, Users, Loader2, BarChart3, Play, RotateCcw } from 'lucide-react';

interface AIChatProps {
  currentLogs: LogEntry[];
  onAutoCommand: (cmd: string) => void;
}

export const AIChat: React.FC<AIChatProps> = ({ currentLogs, onAutoCommand }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedIPs, setSelectedIPs] = useState<SelectedIP[]>([]);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('parallel');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<{ completed: number; total: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openSessions } = useSSHStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // 当会话变化时，清理已不存在的 IP
  useEffect(() => {
    setSelectedIPs(prev => prev.filter(ip => 
      openSessions.includes(ip.id) || 
      openSessions.some(s => s.startsWith('tmp-') && s.includes(ip.id))
    ));
  }, [openSessions]);

  const handleSend = async () => {
    if (!inputValue.trim() && selectedIPs.length === 0) return;

    const userContent = inputValue.trim();
    
    // 构建显示的消息内容
    let displayContent = userContent;
    if (selectedIPs.length > 0) {
      const ipInfo = selectedIPs.map(ip => `${ip.name}(${ip.ip})`).join(', ');
      displayContent = `[多服务器模式: ${ipInfo}]\n${userContent}`;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: displayContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      // 如果有选中的 IP，使用多 IP 模式处理
      if (selectedIPs.length > 0) {
        await handleMultiIPExecution(userContent, selectedIPs);
      } else {
        // 普通单会话模式
        const response = await chatWithAI(userContent, messages);
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response || '抱歉，我遇到了点问题。',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '执行过程中出现错误，请稍后重试。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setIsExecuting(false);
      setExecutionProgress(null);
    }
  };

  // 处理多 IP 执行
  const handleMultiIPExecution = async (command: string, ips: SelectedIP[]) => {
    setIsExecuting(true);
    
    // 发送开始执行的消息
    const startMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `🚀 开始执行命令...\n\n**目标服务器**: ${ips.length} 台\n**执行模式**: ${getModeLabel(executionMode)}\n**命令**: \`\`\`\n${command}\n\`\`\``,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, startMsg]);

    try {
      // 执行命令
      const results = await multiIPExecutor.execute(command, ips, {
        mode: executionMode,
        timeout: 30000,
        continueOnError: true,
        onProgress: (result, completed, total) => {
          setExecutionProgress({ completed, total });
        }
      });

      // 使用 AI 分析结果
      const analysis = await multiIPExecutor.analyzeResults(results, command);

      // 生成报告
      const report = multiIPExecutor.generateReport(results);

      const resultMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `✅ 执行完成!\n\n${analysis}\n\n<details>\n<summary>📊 查看详细报告</summary>\n\n${report}\n</details>`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, resultMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `❌ 执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  // 获取模式标签
  const getModeLabel = (mode: ExecutionMode): string => {
    switch (mode) {
      case 'parallel': return '并行执行';
      case 'sequential': return '串行执行';
      case 'adaptive': return '自适应执行';
      default: return '并行执行';
    }
  };

  const handleAnalyzeLogs = async () => {
    if (currentLogs.length === 0) return;
    
    setIsTyping(true);
    const logText = currentLogs.map(l => `${l.timestamp}: ${l.content}`).join('\n');
    
    try {
      const analysis = await analyzeLogs(logText);
      const aiMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `**日志分析报告：**\n\n${analysis}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
       console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const extractCommand = (content: string) => {
    const match = content.match(/`([^`]+)`/);
    if (match) {
        onAutoCommand(match[1]);
    }
  }

  // 判断当前模式
  const isMultiIPMode = selectedIPs.length > 0;

  return (
    <div className="flex flex-col h-full bg-base-200 w-96 border-l border-base-100">
      <div className="p-4 border-b border-base-100 flex flex-col gap-2">
        <h2 className="font-bold flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
           AI 运维助手
        </h2>
        
        {/* 模式指示器 */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all ${
          isMultiIPMode 
            ? 'bg-gradient-to-r from-sci-cyan/20 to-sci-violet/20 border border-sci-cyan/40 text-sci-cyan' 
            : 'bg-base-300 text-base-content/60'
        }`}>
          {isMultiIPMode ? (
            <>
              <Users size={14} />
              <span>多服务器模式 ({selectedIPs.length} 台)</span>
            </>
          ) : (
            <>
              <Server size={14} />
              <span>单会话模式</span>
            </>
          )}
        </div>

        {/* 执行模式选择器 - 仅在多 IP 模式下显示 */}
        {isMultiIPMode && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-sci-dim/60 uppercase">执行模式:</span>
            <div className="flex gap-1">
              {(['parallel', 'sequential', 'adaptive'] as ExecutionMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExecutionMode(mode)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-all ${
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
        )}

        <div className="flex gap-2">
            <Button size="xs" variant="accent" onClick={handleAnalyzeLogs} disabled={currentLogs.length === 0}>
                智能分析日志
            </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        {messages.length === 0 && (
          <div className="text-center opacity-40 mt-10 space-y-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18L12 6M12 6L6 12M12 6L18 12" />
            </svg>
            <p>你可以问我关于服务器管理、脚本编写或系统排障的问题。</p>
            <p className="text-xs text-sci-dim/60">
              输入 <kbd className="px-1.5 py-0.5 bg-base-300 rounded">/</kbd> 选择多台服务器进行批量操作
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat ${msg.role === 'user' ? 'chat-end' : 'chat-start'}`}>
            <div className={`chat-bubble whitespace-pre-wrap ${msg.role === 'user' ? 'chat-bubble-primary' : 'chat-bubble-neutral'}`}>
              {msg.content}
              {msg.role === 'assistant' && msg.content.includes('`') && (
                <div className="mt-2 border-t border-base-content/10 pt-2">
                   <Button size="xs" variant="ghost" className="text-accent" onClick={() => extractCommand(msg.content)}>
                     自动填充检测到的命令
                   </Button>
                </div>
              )}
            </div>
            <div className="chat-footer opacity-50 text-[10px]">
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="chat chat-start">
            <div className="chat-bubble chat-bubble-neutral">
              <span className="loading loading-dots loading-xs"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-base-300">
        {/* 执行进度 */}
        {isExecuting && executionProgress && (
          <div className="mb-3 px-3 py-2 bg-sci-cyan/10 border border-sci-cyan/30 rounded">
            <div className="flex items-center justify-between text-xs text-sci-cyan mb-1">
              <span className="flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                执行中...
              </span>
              <span>{executionProgress.completed} / {executionProgress.total}</span>
            </div>
            <div className="w-full h-1 bg-black/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sci-cyan transition-all duration-300"
                style={{ width: `${(executionProgress.completed / executionProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1">
            <IPSelectorInput
              value={inputValue}
              onChange={setInputValue}
              onSend={handleSend}
              placeholder="输入消息..."
              selectedIPs={selectedIPs}
              onSelectedIPsChange={setSelectedIPs}
            />
          </div>
          <Button 
            variant="primary" 
            onClick={handleSend} 
            className="h-auto px-4 self-end"
            disabled={(!inputValue.trim() && selectedIPs.length === 0) || isExecuting}
          >
             {isExecuting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </div>
        
        {/* 快捷提示 */}
        {selectedIPs.length === 0 && !isExecuting && (
          <div className="mt-2 text-[10px] text-sci-dim/40 text-center">
            提示：输入 <span className="text-sci-cyan/60">/</span> 选择服务器，启用多 IP 批量操作
          </div>
        )}
      </div>
    </div>
  );
};
