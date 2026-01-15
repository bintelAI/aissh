import React, { useState, useCallback } from 'react';
import { Server, Folder, ServerTreeProps } from '../types/index';
import { ChevronRight, ChevronDown, Folder as FolderIcon, Server as ServerIcon, Plus, FolderPlus, Edit3, Trash2, LayoutGrid, Terminal, FileCode, Signal, Activity } from 'lucide-react';
import { ContextMenu, ContextMenuItem } from '../common/ContextMenu';
import { motion, AnimatePresence } from 'framer-motion';

export const ServerTree: React.FC<ServerTreeProps> = ({ 
  servers, folders, activeServerId, onSelectServer, onAddServer, onEditServer, onDeleteServer, onAddFolder, onEditFolder, onDeleteFolder, onMove, width = 260,
  onOpenFileManager
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, items: ContextMenuItem[] } | null>(null);

  const toggleFolder = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedFolders(next);
  };

  const handleFolderRename = (id: string, newName: string) => {
    if (newName.trim()) {
      onEditFolder(id, { name: newName.trim() });
    }
    setEditingFolderId(null);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'folder' | 'server', data: Folder | Server) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [];

    if (type === 'folder') {
      const folder = data as Folder;
      items.push(
        { label: '关联新节点', icon: <Plus size={14}/>, onClick: () => onAddServer(folder.id) },
        { label: '添加子分区', icon: <FolderPlus size={14}/>, onClick: () => onAddFolder(folder.id) },
        { label: '重命名', icon: <Edit3 size={14}/>, onClick: () => setEditingFolderId(folder.id) },
        { label: '清除分区', icon: <Trash2 size={14}/>, onClick: () => onDeleteFolder(folder.id), variant: 'danger' }
      );
    } else {
      const server = data as Server;
      items.push(
        { label: '打开终端', icon: <Terminal size={14}/>, onClick: () => onSelectServer(server.id) },
        { label: '文件管理', icon: <FileCode size={14}/>, onClick: () => onOpenFileManager?.(server.id) },
        { label: '编辑节点配置', icon: <Edit3 size={14}/>, onClick: () => onEditServer(server) },
        { label: '终止连接', icon: <Trash2 size={14}/>, onClick: () => onDeleteServer(server.id), variant: 'danger' }
      );
    }

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [onAddServer, onAddFolder, onDeleteFolder, onSelectServer, onEditServer, onDeleteServer, onOpenFileManager]);

  const handleRootContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.currentTarget !== e.target) return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: '创建根目录', icon: <FolderPlus size={14}/>, onClick: () => onAddFolder(null) },
        { label: '关联根节点', icon: <Plus size={14}/>, onClick: () => onAddServer(null) },
      ]
    });
  }, [onAddFolder, onAddServer]);

  const renderItems = (parentId: string | null) => {
    const currentFolders = folders.filter(f => f.parentId === parentId);
    const currentServers = servers.filter(s => s.parentId === parentId);

    return (
      <div className={`${parentId !== null ? 'pl-3 border-l border-sci-cyan/10 ml-2.5 mt-1' : ''} space-y-1`}>
        <AnimatePresence initial={false}>
          {currentFolders.map(folder => (
            <motion.div 
              key={folder.id} 
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              draggable
              onDragStart={(e: React.DragEvent) => {
                e.stopPropagation();
                e.dataTransfer.setData('move_data', JSON.stringify({ type: 'folder', id: folder.id }));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverId(folder.id);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverId(null);
                const dataStr = e.dataTransfer.getData('move_data');
                if (!dataStr) return;
                const data = JSON.parse(dataStr);
                onMove(data.type, data.id, folder.id);
              }}
            >
              <div 
                className={`flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer group transition-all border border-transparent relative overflow-hidden
                  ${dragOverId === folder.id ? 'bg-sci-cyan/10 border-sci-cyan/30 shadow-[0_0_10px_rgba(0,243,255,0.1)]' : ''}`}
                onClick={(e) => toggleFolder(e, folder.id)}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
              >
                 {/* Hover Scan Effect */}
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sci-cyan/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite] pointer-events-none"></div>

                <div className="w-4 h-4 flex items-center justify-center shrink-0 text-sci-violet/60 group-hover:text-sci-violet transition-colors">
                  {expandedFolders.has(folder.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                </div>
                <FolderIcon size={14} className={`shrink-0 transition-colors ${expandedFolders.has(folder.id) ? 'text-sci-violet fill-sci-violet/10 shadow-[0_0_8px_rgba(139,92,246,0.2)]' : 'text-sci-dim group-hover:text-sci-text'}`}/>
                
                {editingFolderId === folder.id ? (
                  <input 
                    autoFocus
                    defaultValue={folder.name}
                    onBlur={(e) => handleFolderRename(folder.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFolderRename(folder.id, (e.target as HTMLInputElement).value);
                      if (e.key === 'Escape') setEditingFolderId(null);
                    }}
                    className="text-[11px] bg-black/60 outline-none flex-1 border border-sci-cyan/30 text-sci-text rounded px-1.5 py-0.5 min-w-0 font-sci"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`text-[11px] flex-1 truncate select-none font-sci font-medium text-sci-text/80 group-hover:text-sci-text tracking-wide ${width < 180 ? 'hidden' : ''}`}>{folder.name}</span>
                )}
              </div>
              <AnimatePresence>
                {expandedFolders.has(folder.id) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {renderItems(folder.id)}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
          {currentServers.map(server => (
            <motion.div 
              key={server.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              draggable
              onDragStart={(e: React.DragEvent) => {
                e.stopPropagation();
                e.dataTransfer.setData('move_data', JSON.stringify({ type: 'server', id: server.id }));
              }}
              onClick={() => onSelectServer(server.id)}
              onContextMenu={(e) => handleContextMenu(e, 'server', server)}
              className={`
                flex items-center gap-2 p-1.5 pl-3 rounded-r cursor-pointer transition-all group border-l-[3px] relative overflow-hidden mb-0.5
                ${activeServerId === server.id 
                  ? 'bg-gradient-to-r from-sci-cyan/10 to-transparent border-l-sci-cyan text-sci-cyan shadow-[inset_10px_0_20px_-10px_rgba(0,243,255,0.2)]' 
                  : 'border-l-transparent hover:bg-white/5 text-sci-text/60 hover:text-sci-text hover:border-l-sci-text/20'}
              `}
            >
              {/* Active/Hover Glow */}
              {activeServerId === server.id && (
                <div className="absolute inset-0 bg-sci-cyan/5 animate-pulse pointer-events-none"></div>
              )}

              <ServerIcon size={13} className={`transition-all ${
                server.status === 'connected' ? 'text-sci-green drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 
                server.status === 'connecting' ? 'text-sci-cyan animate-spin' : 
                server.status === 'error' ? 'text-sci-red' :
                'text-sci-dim opacity-40 group-hover:opacity-80'
              }`}/>
              
              <div className={`flex-1 min-w-0 ${width < 180 ? 'hidden' : ''} relative z-10 flex flex-col justify-center`}>
                 <div className={`text-[11px] font-sci truncate leading-tight tracking-wider transition-all ${activeServerId === server.id ? 'font-bold text-sci-cyan' : 'font-medium'}`}>
                    {server.name}
                 </div>
                 <div className={`text-[9px] font-mono truncate leading-tight tracking-tighter transition-opacity ${width < 220 ? 'hidden' : ''} ${activeServerId === server.id ? 'text-sci-cyan/60' : 'opacity-30 group-hover:opacity-50'}`}>
                    {server.ip}
                 </div>
              </div>
              
              {/* Connection Status Dot */}
              {server.status === 'connected' && (
                <div className="absolute right-2 w-1 h-1 rounded-full bg-sci-green shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-black/40 via-sci-obsidian/60 to-black/80 backdrop-blur-xl border-r border-sci-cyan/20 relative overflow-hidden group/sidebar">
      {/* 装饰性背景网格 - 增强可见度 */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40"
        style={{
          animation: 'grid-subtle-move 40s linear infinite',
        }}
      ></div>

      {/* 动态背景光晕 - 显著增强颜色和模糊度 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[5%] -left-[10%] w-[60%] h-[40%] bg-sci-cyan/15 blur-[100px] rounded-full animate-pulse-slow"></div>
        <div className="absolute top-[30%] -right-[15%] w-[50%] h-[40%] bg-sci-violet/15 blur-[90px] rounded-full animate-pulse-slow delay-1000"></div>
        <div className="absolute -bottom-[5%] left-[10%] w-[70%] h-[40%] bg-sci-cyan/15 blur-[110px] rounded-full animate-pulse-slow delay-500"></div>
      </div>

      {/* 增强版扫描线效果 - 带有明显的辉光 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.1] group-hover/sidebar:opacity-[0.15] transition-opacity duration-700">
        <div className="w-full h-[2px] bg-sci-cyan shadow-[0_0_15px_#00f3ff,0_0_30px_#00f3ff] animate-scanline-fast"></div>
        <div className="w-full h-[150px] bg-gradient-to-b from-sci-cyan/20 to-transparent animate-scanline-fast -translate-y-[150px]"></div>
      </div>

      {/* 顶部渐变遮罩 */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-sci-cyan/10 via-sci-cyan/5 to-transparent pointer-events-none z-0"></div>

      <style>{`
        @keyframes grid-subtle-move {
          0% { background-position: 0 0; }
          100% { background-position: 32px 32px; }
        }
        @keyframes scanline-fast {
          0% { transform: translateY(-200%); }
          100% { transform: translateY(800%); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        .animate-scanline-fast {
          animation: scanline-fast 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div 
        className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md relative z-10"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-sci-cyan/20 blur-sm rounded animate-pulse group-hover:bg-sci-cyan/40 transition-all"></div>
            <div className="relative p-1.5 bg-black border border-sci-cyan/30 text-sci-cyan rounded-sm shadow-[0_0_10px_rgba(0,243,255,0.1)]">
              <LayoutGrid size={16} />
            </div>
          </div>
          <div className={`flex flex-col ${width < 200 ? 'hidden' : ''}`}>
            <a 
              href="https://www.bintelai.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group/link block"
            >
              <h2 className="text-sm font-black font-sci text-white/90 uppercase tracking-widest group-hover/link:text-sci-cyan transition-colors drop-shadow-[0_0_5px_rgba(255,255,255,0.1)]">
                方块智联
              </h2>
            </a>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-sci-green animate-pulse shadow-[0_0_5px_#22c55e]"></span>
              <span className="text-[9px] text-sci-cyan/50 uppercase tracking-[0.1em] font-bold font-sci hidden sm:block">
                SYSTEM ONLINE
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button 
            onClick={() => onAddFolder(null)}
            className="p-1.5 text-white/40 hover:text-sci-violet hover:bg-sci-violet/10 transition-all rounded clip-corner"
            title="创建目录"
          >
            <FolderPlus size={15} />
          </button>
          <button 
            onClick={() => onAddServer(null)}
            className="p-1.5 text-white/40 hover:text-sci-cyan hover:bg-sci-cyan/10 transition-all rounded clip-corner"
            title="关联新节点"
          >
            <Plus size={17} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        className={`flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 transition-colors relative z-10
          ${dragOverId === 'root' ? 'bg-sci-cyan/5' : ''}`}
        onContextMenu={handleRootContextMenu}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.currentTarget === e.target) setDragOverId('root');
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverId(null);
          const dataStr = e.dataTransfer.getData('move_data');
          if (!dataStr) return;
          const data = JSON.parse(dataStr);
          onMove(data.type, data.id, null);
        }}
      >
        {renderItems(null)}
        {(folders.length === 0 && servers.length === 0) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-full flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-20 h-20 mb-4 rounded-full bg-gradient-to-b from-sci-cyan/5 to-transparent border border-sci-cyan/10 flex items-center justify-center text-sci-cyan/20 relative group">
              <div className="absolute inset-0 rounded-full border border-sci-cyan/20 animate-[spin_10s_linear_infinite] border-dashed"></div>
              <ServerIcon size={32} />
            </div>
            <p className="text-xs text-sci-cyan/40 font-sci uppercase tracking-widest mb-1">未检测到活动节点</p>
            <p className="text-[10px] text-white/20 font-mono mb-6">NO ACTIVE NODES DETECTED</p>
            <button 
              onClick={() => onAddServer(null)}
              className="px-5 py-2 bg-sci-cyan/10 border border-sci-cyan/30 text-sci-cyan text-[10px] font-sci uppercase tracking-[0.2em] hover:bg-sci-cyan hover:text-black transition-all clip-corner shadow-[0_0_15px_rgba(0,243,255,0.1)] hover:shadow-[0_0_20px_rgba(0,243,255,0.4)]"
            >
              初始化连接
            </button>
          </motion.div>
        )}
      </div>
      
      {/* 底部装饰性状态栏 */}
      <div className="p-2.5 border-t border-white/5 bg-black/40 backdrop-blur flex items-center justify-between relative z-10">
         <div className="flex items-center gap-2">
           <Activity size={12} className="text-sci-cyan/40" />
           <div className="flex flex-col">
             <span className="text-[9px] text-white/30 font-sci tracking-widest uppercase font-bold">Network Status</span>
             <span className="text-[8px] text-sci-green/60 font-mono tracking-wider">STABLE</span>
           </div>
         </div>
         <div className={`text-[9px] text-white/20 font-mono tracking-tighter uppercase ${width < 220 ? 'hidden' : ''}`}>
           <span className="opacity-50">LATENCY:</span> 12ms
         </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
