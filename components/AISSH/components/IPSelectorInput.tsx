import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSSHStore } from '../store/useSSHStore';
import { Server } from '../types';
import { ChevronDown, X, Server as ServerIcon } from 'lucide-react';

export interface SelectedIP {
  id: string;
  ip: string;
  name: string;
}

interface IPSelectorInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  selectedIPs: SelectedIP[];
  onSelectedIPsChange: (ips: SelectedIP[]) => void;
}

export const IPSelectorInput: React.FC<IPSelectorInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder = "输入消息...",
  selectedIPs,
  onSelectedIPsChange
}) => {
  const { servers, openSessions, connectionStatus } = useSSHStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取已连接的服务器列表
  const connectedServers = React.useMemo(() => {
    const serverList: Server[] = [];
    
    // 从 openSessions 获取已连接的服务器
    openSessions.forEach(sessionId => {
      // 跳过文件浏览器会话
      if (sessionId.endsWith('#files')) return;
      
      // 处理临时会话 ID (如 tmp-xxx)
      let baseId = sessionId;
      if (sessionId.startsWith('tmp-')) {
        // 尝试从 tmpSessions 获取原始服务器ID
        const tempSession = useSSHStore.getState().tempSessions[sessionId];
        if (tempSession) {
          baseId = tempSession.baseId;
        }
      }
      
      const server = servers.find(s => s.id === baseId);
      if (server) {
        // 检查是否已添加
        if (!serverList.find(s => s.id === server.id)) {
          serverList.push(server);
        }
      }
    });
    
    // 也添加所有已连接状态的服务器
    servers.forEach(server => {
      if (connectionStatus[server.id] === 'connected') {
        if (!serverList.find(s => s.id === server.id)) {
          serverList.push(server);
        }
      }
    });
    
    return serverList;
  }, [servers, openSessions, connectionStatus]);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(newCursorPos);
    
    // 检查是否需要显示下拉框
    const textBeforeCursor = newValue.slice(0, newCursorPos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    
    if (lastSlashIndex !== -1) {
      const charBeforeSlash = textBeforeCursor[lastSlashIndex - 1];
      const textAfterSlash = textBeforeCursor.slice(lastSlashIndex + 1);
      
      // 调试信息
      const debug = `slashIdx: ${lastSlashIndex}, charBefore: "${charBeforeSlash}", textAfter: "${textAfterSlash}", servers: ${connectedServers.length}`;
      setDebugInfo(debug);
      console.log('[IPSelector]', debug, 'openSessions:', openSessions, 'servers:', servers.length);
      
      if ((charBeforeSlash === ' ' || charBeforeSlash === undefined) && 
          !textAfterSlash.includes(' ')) {
        setShowDropdown(true);
        setHighlightedIndex(0);
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }
  };

  // 获取过滤后的服务器列表
  const filteredServers = React.useMemo(() => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    const searchText = textBeforeCursor.slice(lastSlashIndex + 1).toLowerCase();
    
    if (!searchText) return connectedServers;
    
    return connectedServers.filter(server => 
      server.name.toLowerCase().includes(searchText) ||
      server.ip.toLowerCase().includes(searchText)
    );
  }, [connectedServers, value, cursorPosition]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredServers.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < filteredServers.length - 1 ? prev + 1 : prev
          );
          return;
        
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
          return;
        
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredServers.length) {
            selectServer(filteredServers[highlightedIndex]);
            // 选择后不关闭下拉框，继续选择其他服务器
          }
          return;
        
        case 'Escape':
          setShowDropdown(false);
          return;
        
        case 'Tab':
          if (highlightedIndex >= 0 && highlightedIndex < filteredServers.length) {
            e.preventDefault();
            selectServer(filteredServers[highlightedIndex]);
            // 选择后不关闭下拉框，继续选择其他服务器
          }
          return;
      }
    }
    
    // 处理发送 - 使用 Ctrl+Enter 发送，普通 Enter 换行
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Enter 或 Cmd+Enter 发送消息
        e.preventDefault();
        onSend();
      }
      // 普通 Enter 键允许默认行为（换行），不阻止
    }
  };

  // 选择服务器
  const selectServer = (server: Server) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    
    // 添加选中的 IP 到列表
    const newSelectedIP: SelectedIP = {
      id: server.id,
      ip: server.ip,
      name: server.name
    };
    
    // 检查是否已经选中
    if (!selectedIPs.find(ip => ip.id === server.id)) {
      onSelectedIPsChange([...selectedIPs, newSelectedIP]);
    }
    
    // 更新输入框内容，保留 / 以便继续选择其他服务器
    const beforeSlash = value.slice(0, lastSlashIndex + 1); // 保留 /
    const afterCursor = value.slice(cursorPosition);
    const newValue = beforeSlash + afterCursor;
    onChange(newValue);
    
    // 不关闭下拉框，继续选择
    // 重置高亮索引到第一个
    setHighlightedIndex(0);
    
    // 保持焦点并移动光标到 / 后面
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = lastSlashIndex + 1;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      setCursorPosition(newCursorPos);
    }, 0);
  };

  // 移除选中的 IP
  const removeSelectedIP = (ipId: string) => {
    onSelectedIPsChange(selectedIPs.filter(ip => ip.id !== ipId));
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 自动调整文本框高度
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [value]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 选中的 IP 标签 */}
      {selectedIPs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedIPs.map(ip => (
            <span
              key={ip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium 
                         bg-gradient-to-r from-sci-cyan/20 to-sci-violet/20 
                         border border-sci-cyan/40 text-sci-cyan 
                         rounded-sm animate-in fade-in slide-in-from-bottom-1"
            >
              <ServerIcon size={10} />
              <span className="truncate max-w-[120px]">{ip.name}</span>
              <span className="text-sci-dim/60">({ip.ip})</span>
              <button
                onClick={() => removeSelectedIP(ip.id)}
                className="ml-1 p-0.5 hover:bg-sci-cyan/20 rounded transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <button
            onClick={() => onSelectedIPsChange([])}
            className="text-[10px] text-sci-dim/60 hover:text-sci-cyan 
                       underline decoration-dotted transition-colors"
          >
            清除全部
          </button>
        </div>
      )}

      {/* 输入框容器 */}
      <div className="relative">
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
          onKeyUp={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
          placeholder={
            selectedIPs.length > 0 
              ? `向 ${selectedIPs.length} 台服务器发送指令...` 
              : placeholder
          }
          className="w-full bg-black/40 border border-white/10 px-3 py-2 
                     font-mono text-xs focus:outline-none focus:border-sci-cyan/50 
                     text-sci-text transition-all resize-none min-h-[36px] max-h-[120px]
                     placeholder:text-sci-dim/40"
          rows={1}
        />
        
        {/* 提示文字 */}
        {value.length === 0 && selectedIPs.length === 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 
                          text-[10px] text-sci-dim/30 pointer-events-none">
            输入 / 选择服务器
          </div>
        )}
      </div>

      {/* 调试信息 - 开发时显示 */}
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <div className="text-[9px] text-sci-dim/40 mt-1">
          {debugInfo}
        </div>
      )}

      {/* 下拉选择器 */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 right-0 mb-1 
                     bg-sci-obsidian border border-sci-cyan/30 
                     shadow-[0_-5px_20px_rgba(0,243,255,0.15)] 
                     z-[100] animate-in fade-in slide-in-from-bottom-1
                     max-h-[200px] overflow-y-auto"
        >
          {/* 头部 */}
          <div className="px-3 py-1.5 bg-sci-cyan/5 border-b border-sci-cyan/20 
                          text-[10px] text-sci-cyan/60 font-bold uppercase tracking-wider">
            选择目标服务器 ({filteredServers.length})
          </div>
          
          {/* 服务器列表 */}
          {filteredServers.length > 0 ? (
            <div className="py-1">
              {filteredServers.map((server, index) => {
                const isSelected = selectedIPs.find(ip => ip.id === server.id);
                const isHighlighted = index === highlightedIndex;
                
                return (
                  <button
                    key={server.id}
                    onClick={() => selectServer(server)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 
                               transition-all duration-150
                               ${isHighlighted 
                                 ? 'bg-sci-cyan/10 border-l-2 border-sci-cyan' 
                                 : 'border-l-2 border-transparent hover:bg-white/5'
                               }
                               ${isSelected ? 'opacity-50' : ''}`}
                  >
                    <ServerIcon 
                      size={12} 
                      className={isSelected ? 'text-sci-cyan/40' : 'text-sci-cyan'} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium truncate
                                     ${isSelected ? 'text-sci-dim' : 'text-sci-text'}`}>
                        {server.name}
                        {isSelected && (
                          <span className="ml-2 text-[9px] text-sci-cyan/60">
                            (已选择)
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-sci-dim/60 truncate">
                        {server.ip}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-4 text-center">
              <ServerIcon size={20} className="mx-auto mb-2 text-sci-dim/30" />
              <div className="text-xs text-sci-dim/60">
                {connectedServers.length === 0 
                  ? '暂无已连接的服务器' 
                  : '无匹配的服务器'}
              </div>
              <div className="text-[10px] text-sci-dim/40 mt-1">
                {connectedServers.length === 0 
                  ? '请先连接 SSH 会话' 
                  : '请检查输入的搜索关键字'}
              </div>
            </div>
          )}
          
          {/* 底部提示 */}
          <div className="px-3 py-1.5 bg-black/20 border-t border-white/5 
                          text-[9px] text-sci-dim/40 text-center">
            ↑↓ 选择 · Enter 多选 · Esc 关闭 · 已选 {selectedIPs.length} 台
          </div>
        </div>
      )}
    </div>
  );
};

export default IPSelectorInput;
