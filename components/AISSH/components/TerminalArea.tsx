import React, { useState, useRef, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { useSSHStore } from '../store/useSSHStore';
import { Terminal, TerminalHandle } from './Terminal';
import { TerminalSearch } from './TerminalSearch';

interface TerminalAreaProps {
  commandToInsert: string | null;
  onAnalyzeLog: (logLine: string) => void;
}

export const TerminalArea: React.FC<TerminalAreaProps> = ({ commandToInsert, onAnalyzeLog }) => {
  const { activeSessionId, openSessions, logs, setLogs, connectionStatus, setActiveSessionId } = useSSHStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [hasMatches, setHasMatches] = useState(true);
  const terminalRefs = useRef<Record<string, TerminalHandle | null>>({});

  // Global Ctrl+F handler for when terminal is not focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (text: string, direction: 'next' | 'prev', isIncremental: boolean = false) => {
    if (!text || openSessions.length === 0) {
      setHasMatches(true);
      return;
    }

    // 1. Try search in current session
    if (activeSessionId && terminalRefs.current[activeSessionId]) {
      const found = terminalRefs.current[activeSessionId]?.search(text, direction, { incremental: isIncremental });
      // If found in current session OR it's just incremental typing, we stay here
      if (found || isIncremental) {
        setHasMatches(found || false);
        return;
      }
    }

    // 2. If not found or reached end (and not just typing), cycle through other sessions
    const sessionList = openSessions;
    const currentIdx = activeSessionId ? sessionList.indexOf(activeSessionId) : 0;
    
    let nextIdx = currentIdx;
    for (let i = 0; i < sessionList.length - 1; i++) {
      if (direction === 'next') {
        nextIdx = (nextIdx + 1) % sessionList.length;
      } else {
        nextIdx = (nextIdx - 1 + sessionList.length) % sessionList.length;
      }

      const nextSessionId = sessionList[nextIdx];
      const nextTerminal = terminalRefs.current[nextSessionId];
      
      if (nextTerminal) {
        // Try to search in the next terminal (starting from beginning/end as it's a new context)
        const found = nextTerminal.search(text, direction, { incremental: false });
        if (found) {
          setHasMatches(true);
          setActiveSessionId(nextSessionId);
          // Focus the new terminal after a short delay to ensure UI update
          setTimeout(() => {
            nextTerminal.focus();
          }, 50);
          return;
        }
      }
    }
    
    // If we've looped through everything and found nothing
    setHasMatches(false);
  };

  return (
    <div className="flex-1 relative bg-black overflow-hidden flex flex-col">
      <TerminalSearch 
        isOpen={isSearchOpen} 
        hasMatches={hasMatches}
        onClose={() => {
          setIsSearchOpen(false);
          setHasMatches(true);
          if (activeSessionId && terminalRefs.current[activeSessionId]) {
            terminalRefs.current[activeSessionId]?.focus();
          }
        }}
        onSearch={handleSearch}
      />

      {openSessions.map(sessionId => (
        <div 
          key={sessionId} 
          className={`flex-1 flex-col w-full h-full ${activeSessionId === sessionId ? 'flex' : 'hidden'}`}
        >
           <Terminal 
             ref={(el: TerminalHandle | null) => { terminalRefs.current[sessionId] = el; }}
             logs={logs.filter(l => l.serverId === sessionId || l.serverId === 'system')} 
             serverId={sessionId}
             isSearching={isSearchOpen}
             onClear={() => setLogs(logs.filter(x => x.serverId !== sessionId))} 
             onAnalyzeError={onAnalyzeLog}
             onSelectionAI={(text: string) => {
               // 这里确保只传递文本，不触发自动分析
               onAnalyzeLog(text);
             }}
             status={connectionStatus[sessionId] || 'disconnected'} 
             commandToInsert={activeSessionId === sessionId ? commandToInsert : null}
             onSearchOpen={() => setIsSearchOpen(true)}
           />
        </div>
      ))}

      {!activeSessionId && (
        <div className="h-full flex flex-col items-center justify-center select-none bg-sci-obsidian/20 relative overflow-hidden absolute inset-0">
           <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.05)_0%,transparent_70%)] animate-pulse"></div>
           
           <div className="relative z-10 flex flex-col items-center">
             <div className="w-24 h-24 mb-8 flex items-center justify-center relative">
               <div className="absolute inset-0 border-2 border-sci-cyan/20 rounded-full animate-ping"></div>
               <div className="absolute inset-2 border border-sci-cyan/40 rounded-full animate-reverse-spin"></div>
               <Radio size={48} className="text-sci-cyan drop-shadow-[0_0_15px_rgba(0,243,255,0.5)]"/>
             </div>
             
             <div className="text-center space-y-2">
               <h2 className="text-lg font-sci font-bold text-sci-cyan uppercase tracking-[0.5em] animate-pulse">Awaiting Secure Link</h2>
               <p className="text-[10px] text-sci-cyan/40 uppercase tracking-[0.3em] font-bold">Select a neural node to initialize uplink</p>
             </div>
           </div>

           <div className="absolute bottom-10 left-10 right-10 h-[1px] bg-gradient-to-r from-transparent via-sci-cyan/20 to-transparent"></div>
        </div>
      )}
    </div>
  );
};
