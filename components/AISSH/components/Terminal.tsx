
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';
import { LogEntry } from '../types/index';
import { sshManager } from '../services/sshService';
import { Terminal as TerminalIcon, Trash2, Sparkles, Loader2, Download, AlertTriangle } from 'lucide-react';
import { predictCommandRisk } from '../services/geminiService';

import { WebglAddon } from 'xterm-addon-webgl';
import { CanvasAddon } from 'xterm-addon-canvas';

interface TerminalProps {
  logs: LogEntry[];
  serverId: string;
  onClear: () => void;
  onAnalyzeError?: (log: string) => void;
  onSelectionAI?: (text: string) => void;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  commandToInsert?: string | null;
  onSearchOpen?: () => void;
  isSearching?: boolean;
}

export interface TerminalHandle {
  search: (text: string, direction: 'next' | 'prev', options?: { incremental?: boolean }) => boolean;
  focus: () => void;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ 
  logs, 
  serverId, 
  onClear, 
  onAnalyzeError, 
  onSelectionAI, 
  status, 
  commandToInsert,
  onSearchOpen,
  isSearching = false
}, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  // Update theme when isSearching changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = {
        ...xtermRef.current.options.theme,
        selectionBackground: isSearching ? '#ff2a00' : 'rgba(0, 243, 255, 0.3)',
        selectionForeground: isSearching ? '#ffffff' : undefined,
        selectionInactiveBackground: isSearching ? 'rgba(255, 42, 0, 0.3)' : 'rgba(0, 243, 255, 0.1)',
      };
    }
  }, [isSearching]);
  const [selectionInfo, setSelectionInfo] = useState<{ text: string; x: number; y: number } | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  
  const isConnected = status === 'connected';

  useImperativeHandle(ref, () => ({
    search: (text: string, direction: 'next' | 'prev', options?: { incremental?: boolean }) => {
      if (!searchAddonRef.current || !text) return false;
      if (direction === 'next') {
        return searchAddonRef.current.findNext(text, options);
      } else {
        return searchAddonRef.current.findPrevious(text, options);
      }
    },
    focus: () => {
      xtermRef.current?.focus();
    }
  }));

  const isConnectedRef = useRef(isConnected);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    // Prevent double init
    if (xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"Menlo", "Monaco", "Courier New", "PingFang SC", "Microsoft YaHei", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 10000,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#00f3ff',
        selectionBackground: 'rgba(0, 243, 255, 0.3)',
        selectionInactiveBackground: 'rgba(0, 243, 255, 0.1)',
        black: '#0d1117',
        red: '#ff2a00',
        green: '#0aff00',
        yellow: '#ffcc00',
        blue: '#00f3ff',
        magenta: '#d300ff',
        cyan: '#00f3ff',
        white: '#ffffff',
        brightBlack: '#4d5566',
        brightRed: '#ff6e40',
        brightGreen: '#5aff50',
        brightYellow: '#ffdd40',
        brightBlue: '#50f8ff',
        brightMagenta: '#e050ff',
        brightCyan: '#50f8ff',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    
    term.open(terminalRef.current);

    searchAddonRef.current = searchAddon;

    let addonToDispose: { dispose(): void }[] = [];

    // Try to load high-performance renderers
    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
      addonToDispose.push(webglAddon);
      console.log('Using WebGL renderer');
    } catch (e) {
      console.warn('WebGL renderer failed, falling back to Canvas', e);
      try {
        const canvasAddon = new CanvasAddon();
        term.loadAddon(canvasAddon);
        addonToDispose.push(canvasAddon);
        console.log('Using Canvas renderer');
      } catch (e2) {
        console.warn('Canvas renderer failed, using DOM renderer', e2);
      }
    }
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    let isDisposed = false;

    // Use ResizeObserver for robust layout handling
    const resizeObserver = new ResizeObserver(() => {
      if (isDisposed) return;
      
      // Use requestAnimationFrame to ensure the browser has finished layout
      requestAnimationFrame(() => {
        if (isDisposed) return;
        if (fitAddonRef.current && xtermRef.current && terminalRef.current?.offsetParent) {
          try {
            fitAddonRef.current.fit();
            sshManager.resize(xtermRef.current.cols, xtermRef.current.rows, serverId);
          } catch (e) {
            // Ignore fit errors if element is not ready
          }
        }
      });
    });

    if (terminalRef.current.parentElement) {
      resizeObserver.observe(terminalRef.current.parentElement);
    }

    // Window resize fallback
    const handleWindowResize = () => {
      if (isDisposed) return;
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          sshManager.resize(xtermRef.current.cols, xtermRef.current.rows, serverId);
        } catch (e) {}
      }
    };
    window.addEventListener('resize', handleWindowResize);

    term.focus();

    // Bind Input
    term.onData((data) => {
        if (!isDisposed && isConnectedRef.current && xtermRef.current) {
            sshManager.sendInput(data, serverId);
        }
    });

    // Handle Ctrl+F for search
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        if (onSearchOpen) {
          onSearchOpen();
        }
        return false;
      }
      return true;
    });

    // Handle Selection for AI
    term.onSelectionChange(() => {
        if (isDisposed || !xtermRef.current) return;
        const selection = term.getSelection();
        // 如果选择为空，清除按钮
        if (!selection || selection.trim().length === 0) {
          setSelectionInfo(null);
        }
    });

    // Initial fit with multiple attempts
    const triggerInitialFit = () => {
      if (!isDisposed && fitAddonRef.current && xtermRef.current && terminalRef.current?.offsetParent) {
        fitAddonRef.current.fit();
        sshManager.resize(xtermRef.current.cols, xtermRef.current.rows, serverId);
      }
    };

    setTimeout(triggerInitialFit, 100);
    setTimeout(triggerInitialFit, 500);
    setTimeout(triggerInitialFit, 1000);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
      
      // Manually dispose addons that might cause issues during term.dispose()
      addonToDispose.forEach(addon => {
        try {
          addon.dispose();
        } catch (e) {
          console.warn('Error disposing addon:', e);
        }
      });

      xtermRef.current = null;
      fitAddonRef.current = null;
      
      try {
        term.dispose();
      } catch (e) {
        console.error('Error disposing terminal:', e);
      }
    };
  }, []);

  // Keyword Highlighting Utility
  const highlightData = (data: string) => {
    const getSelectedRules = () => {
      try {
        const profiles = JSON.parse(localStorage.getItem('ssh_prompt_profiles') || '[]');
        const selectedId = localStorage.getItem('ssh_selected_prompt_profile');
        const found = profiles.find((p: any) => p.id === selectedId) || profiles[0];
        return found?.rules || [];
      } catch {
        return [];
      }
    };
    const codeFor = (color: string) => {
      switch (color) {
        case 'red':
          return '\x1b[1;31m';
        case 'orange':
        case 'yellow':
          return '\x1b[1;33m';
        case 'green':
          return '\x1b[1;32m';
        case 'cyan':
          return '\x1b[1;36m';
        case 'blue':
          return '\x1b[1;34m';
        case 'violet':
          return '\x1b[1;35m';
        case 'white':
          return '\x1b[1;37m';
        default:
          return '\x1b[1;36m';
      }
    };
    let out = data
      .replace(/\b(error|failed|fail|severe|critical)\b/gi, '\x1b[1;31m$1\x1b[0m')
      .replace(/\b(warn|warning)\b/gi, '\x1b[1;33m$1\x1b[0m')
      .replace(/\b(success|connected|ok|ready|passed)\b/gi, '\x1b[1;32m$1\x1b[0m')
      .replace(/\b(info|note|notice)\b/gi, '\x1b[1;36m$1\x1b[0m');
    const rules = getSelectedRules();
    for (const r of rules) {
      if (!r.pattern) continue;
      try {
        const regex = new RegExp(r.pattern, 'gi');
        out = out.replace(regex, (m) => `${codeFor(r.color)}${m}\x1b[0m`);
      } catch {}
    }
    return out;
  };

  // Handle incoming data
  useEffect(() => {
      const handleData = (data: string, id: string) => {
          if (id === serverId && xtermRef.current) {
               try {
                 // Apply highlighting before writing
                 const highlighted = highlightData(data);
                 xtermRef.current.write(highlighted);
               } catch (e) {
                 console.error('Xterm write error:', e);
               }
          }
      };

      const unsubscribe = sshManager.onData(handleData);
      
      return () => {
          unsubscribe();
      };
  }, [serverId]);

  // Handle command insertion (e.g. from AI)
  useEffect(() => {
    if (commandToInsert && xtermRef.current && isConnected) {
       sshManager.sendInput(commandToInsert, serverId);
    }
  }, [commandToInsert, serverId, isConnected]);



  const handleExportLogs = () => {
     // Xterm has selectAll() and getSelection(), but getting full buffer is harder without addon-serialize
     // For now, use the logs prop which still accumulates from backend "ssh-data" event (we kept it in sshService)
     if (logs.length === 0) return;
     const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
     const content = logs.map(l => `[${l.timestamp}] ${l.content}`).join('\n');
     const blob = new Blob([content], { type: 'text/plain' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `ssh-session-${timestamp}.log`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-sci-obsidian text-sci-text font-mono shadow-2xl overflow-hidden group/terminal relative">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-sci-panel/80 backdrop-blur-md border-b border-white/5 shrink-0 select-none z-20">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-none bg-sci-red/50 border border-sci-red/80 shadow-[0_0_5px_rgba(255,42,0,0.3)]"></div>
            <div className="w-2.5 h-2.5 rounded-none bg-sci-cyan/50 border border-sci-cyan/80 shadow-[0_0_5px_rgba(0,243,255,0.3)]"></div>
            <div className="w-2.5 h-2.5 rounded-none bg-sci-green/50 border border-sci-green/80 shadow-[0_0_5px_rgba(10,255,0,0.3)]"></div>
          </div>
          <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-sci-cyan/60">
            <TerminalIcon size={12}/>
            <span className="text-glow font-sci">Quantum Shell v4.0 (xterm)</span>
            {status === 'connected' && (
              <span className="text-sci-green lowercase italic flex items-center gap-1 ml-2 font-sci">
                <span className="w-1 h-1 rounded-full bg-sci-green animate-ping"></span>
                链路活跃
              </span>
            )}
            {status === 'connecting' && (
              <span className="text-sci-cyan lowercase italic flex items-center gap-1 ml-2 font-sci">
                <Loader2 size={10} className="animate-spin" />
                正在连接...
              </span>
            )}
            {status === 'disconnected' && (
              <span className="text-sci-red/60 lowercase italic flex items-center gap-1 ml-2 font-sci">
                <span className="w-1 h-1 rounded-full bg-sci-red/40"></span>
                已断开
              </span>
            )}
            {status === 'error' && (
              <span className="text-sci-red lowercase italic flex items-center gap-1 ml-2 font-sci">
                <AlertTriangle size={10} className="animate-pulse" />
                连接失败
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleExportLogs} 
            className="px-2 py-1 hover:bg-sci-cyan/10 rounded-none text-sci-dim hover:text-sci-cyan transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-sci"
            title="导出日志"
          >
            <Download size={12}/> <span>导出</span>
          </button>
          <div className="h-3 w-[1px] bg-white/5 mx-1"></div>
          <button onClick={() => xtermRef.current?.clear()} className="px-2 py-1 hover:bg-sci-red/10 rounded-none text-sci-dim hover:text-sci-red transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-sci">
            <Trash2 size={12}/> <span>清除</span>
          </button>
        </div>
      </div>

      {/* Xterm Container */}
      <div 
        ref={terminalContainerRef}
        className="flex-1 bg-[#0d1117] p-2 overflow-hidden relative" 
        onClick={() => {
          if (xtermRef.current) {
            xtermRef.current.focus();
          }
        }}
        onMouseUp={(e) => {
          if (!xtermRef.current || !terminalContainerRef.current) return;
          const selection = xtermRef.current.getSelection();
          if (selection && selection.trim().length > 0) {
            const rect = terminalContainerRef.current.getBoundingClientRect();
            setSelectionInfo({
              text: selection,
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            });
          } else {
            // 这里不需要设置 null，因为 onSelectionChange 已经处理了
          }
        }}
      >
          <div ref={terminalRef} className="h-full w-full" />
          
          {/* AI Analysis Floating Button */}
          {selectionInfo && (
            <button
              className="absolute z-50 flex items-center gap-1.5 px-3 py-1.5 bg-sci-cyan text-sci-obsidian text-[11px] font-bold rounded-none shadow-[0_0_15px_rgba(0,243,255,0.4)] hover:bg-white hover:text-black transition-all border border-sci-cyan/50 group/aibtn"
              style={{ 
                left: `${Math.min(Math.max(selectionInfo.x, 60), (terminalContainerRef.current?.clientWidth || 0) - 60)}px`, 
                top: `${Math.max(selectionInfo.y - 45, 10)}px`,
                transform: 'translateX(-50%)'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectionAI) {
                  onSelectionAI(selectionInfo.text);
                }
                setSelectionInfo(null);
                // 不一定要清除选择，让用户能看到自己选了啥
              }}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-sci-cyan/20 animate-pulse group-hover/aibtn:hidden"></div>
              <Sparkles size={14} className="relative z-10" />
              <span className="relative z-10">AI 分析</span>
            </button>
          )}
          
          {/* Disconnected Overlay */}
          {(status === 'disconnected' || status === 'error') && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
                 <div className="bg-black/80 border border-sci-red/50 p-4 clip-corner flex items-center gap-3">
                     <div className="w-2 h-2 bg-sci-red animate-pulse rounded-full"></div>
                     <span className="text-sci-red font-bold tracking-widest uppercase text-xs">
                        {status === 'error' ? 'Connection Failed' : 'Signal Lost'}
                     </span>
                 </div>
             </div>
          )}
      </div>


      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 243, 255, 0.2); border-radius: 0; }
      `}</style>
    </div>
  );
});

Terminal.displayName = 'Terminal';
