import React, { useState, useEffect } from 'react';
import { X, FileText, ArrowLeft, ArrowRight, XCircle, MinusCircle } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';

interface TabContextMenuState {
  x: number;
  y: number;
  sessionId: string;
}

export const FileTabs: React.FC = () => {
  const { 
    fileSessions, 
    activeFileSessionId, 
    setActiveFileSessionId, 
    closeFile,
    closeOthers,
    closeLeft,
    closeRight
  } = useFileStore();

  const [contextMenu, setContextMenu] = useState<TabContextMenuState | null>(null);

  const sessions = Object.values(fileSessions);

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      sessionId
    });
  };

  if (sessions.length === 0) return null;

  return (
    <div className="flex items-center bg-sci-dark-lighter/50 border-b border-white/5 overflow-x-auto no-scrollbar h-9 relative">
      {sessions.map((session) => {
        const isActive = activeFileSessionId === session.id;
        const fileName = session.filePath.split('/').pop() || 'Untitled';
        
        return (
          <div
            key={session.id}
            className={`
              flex items-center min-w-[120px] max-w-[200px] h-full px-3 border-r border-white/5 cursor-pointer transition-all relative group
              ${isActive ? 'bg-sci-cyan/10 text-sci-cyan' : 'text-white/40 hover:bg-white/5 hover:text-white/60'}
            `}
            onClick={() => setActiveFileSessionId(session.id)}
            onContextMenu={(e) => handleContextMenu(e, session.id)}
            title={session.filePath}
          >
            {/* Active indicator bar */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-sci-cyan shadow-[0_0_8px_rgba(0,243,255,0.5)]" />
            )}
            
            <FileText size={14} className={`mr-2 flex-shrink-0 ${isActive ? 'text-sci-cyan' : 'text-white/40'}`} />
            
            <span className="text-xs truncate flex-1 font-medium">
              {fileName}
              {session.isModified && <span className="ml-1 text-sci-cyan">*</span>}
            </span>

            <button
              className={`
                ml-2 p-0.5 rounded-sm transition-colors opacity-0 group-hover:opacity-100
                ${isActive ? 'hover:bg-sci-cyan/20 text-sci-cyan' : 'hover:bg-white/10 text-white/40'}
              `}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                closeFile(session.id);
              }}
            >
              <X size={12} />
            </button>
            
            {/* If modified and not active, show a small dot */}
            {!isActive && session.isModified && (
              <div className="absolute bottom-1 right-1 w-1 h-1 rounded-full bg-sci-cyan/60" />
            )}
          </div>
        );
      })}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-sci-obsidian border border-sci-cyan/30 rounded shadow-2xl py-1 min-w-[160px] backdrop-blur-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <button 
            className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-sci-cyan/20 hover:text-sci-cyan flex items-center transition-colors"
            onClick={() => {
              closeFile(contextMenu.sessionId);
              setContextMenu(null);
            }}
          >
            <XCircle size={14} className="mr-2" />
            关闭
          </button>
          <button 
            className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-sci-cyan/20 hover:text-sci-cyan flex items-center transition-colors"
            onClick={() => {
              closeOthers(contextMenu.sessionId);
              setContextMenu(null);
            }}
          >
            <MinusCircle size={14} className="mr-2" />
            关闭其他
          </button>
          <div className="h-px bg-white/5 my-1" />
          <button 
            className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-sci-cyan/20 hover:text-sci-cyan flex items-center transition-colors"
            onClick={() => {
              closeLeft(contextMenu.sessionId);
              setContextMenu(null);
            }}
          >
            <ArrowLeft size={14} className="mr-2" />
            关闭左侧
          </button>
          <button 
            className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-sci-cyan/20 hover:text-sci-cyan flex items-center transition-colors"
            onClick={() => {
              closeRight(contextMenu.sessionId);
              setContextMenu(null);
            }}
          >
            <ArrowRight size={14} className="mr-2" />
            关闭右侧
          </button>
        </div>
      )}
    </div>
  );
};
