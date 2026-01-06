
import React, { useState } from 'react';
import { Server, Folder, ServerTreeProps } from '../types/index';
import { ChevronRight, ChevronDown, Folder as FolderIcon, Server as ServerIcon, Plus, FolderPlus, Edit3, Trash2 } from 'lucide-react';

export const ServerTree: React.FC<ServerTreeProps> = ({ 
  servers, folders, activeServerId, onSelectServer, onAddServer, onEditServer, onDeleteServer, onAddFolder, onEditFolder, onDeleteFolder, onMove 
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  const renderItems = (parentId: string | null) => {
    const currentFolders = folders.filter(f => f.parentId === parentId);
    const currentServers = servers.filter(s => s.parentId === parentId);

    return (
      <div className={`${parentId !== null ? 'pl-4 border-l border-sci-cyan/10 ml-2 mt-1' : ''} space-y-0.5`}>
        {currentFolders.map(folder => (
          <div key={folder.id} 
            draggable
            onDragStart={(e) => {
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
              className={`flex items-center gap-2 p-1 hover:bg-sci-cyan/5 rounded cursor-pointer group transition-all border border-transparent
                ${dragOverId === folder.id ? 'bg-sci-cyan/10 border-sci-cyan/30 shadow-[0_0_10px_rgba(0,243,255,0.1)]' : ''}`}
              onClick={(e) => toggleFolder(e, folder.id)}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0 text-sci-violet/60">
                {expandedFolders.has(folder.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              </div>
              <FolderIcon size={14} className={`shrink-0 ${expandedFolders.has(folder.id) ? 'text-sci-violet fill-sci-violet/10 shadow-[0_0_8px_rgba(139,92,246,0.2)]' : 'text-sci-dim'}`}/>
              
              {editingFolderId === folder.id ? (
                <input 
                  autoFocus
                  defaultValue={folder.name}
                  onBlur={(e) => handleFolderRename(folder.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFolderRename(folder.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setEditingFolderId(null);
                  }}
                  className="text-[11px] bg-sci-obsidian/80 outline-none flex-1 border border-sci-cyan/30 text-sci-text rounded px-1.5 py-0.5 min-w-0 font-sci"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-[11px] flex-1 truncate select-none font-sci font-medium text-sci-text tracking-wide">{folder.name}</span>
              )}

              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 bg-sci-panel/90 backdrop-blur rounded px-1 ml-auto shrink-0 shadow-lg border border-sci-cyan/20">
                <button className="p-1 text-sci-dim hover:text-sci-cyan transition-colors" onClick={(e) => { e.stopPropagation(); onAddServer(folder.id); }} title="在此添加节点">
                  <Plus size={12}/>
                </button>
                <button className="p-1 text-sci-dim hover:text-sci-cyan transition-colors" onClick={(e) => { e.stopPropagation(); onAddFolder(folder.id); }} title="添加子分区">
                  <FolderPlus size={12}/>
                </button>
                <button className="p-1 text-sci-dim hover:text-sci-cyan transition-colors" onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); }} title="重命名">
                  <Edit3 size={12}/>
                </button>
                <button className="p-1 text-sci-dim hover:text-sci-red transition-colors" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} title="清除分区">
                  <Trash2 size={12}/>
                </button>
              </div>
            </div>
            {expandedFolders.has(folder.id) && renderItems(folder.id)}
          </div>
        ))}
        {currentServers.map(server => (
          <div 
            key={server.id}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('move_data', JSON.stringify({ type: 'server', id: server.id }));
            }}
            onClick={() => onSelectServer(server.id)}
            className={`
              flex items-center gap-2 p-1.5 pl-3 rounded cursor-pointer transition-all group border border-transparent
              ${activeServerId === server.id ? 'bg-sci-cyan/10 text-sci-cyan border-l-2 border-l-sci-cyan shadow-[inset_0_0_15px_rgba(0,243,255,0.05)] font-bold' : 'hover:bg-sci-cyan/5 text-sci-text/70 hover:text-sci-text'}
            `}
          >
            <ServerIcon size={13} className={
              server.status === 'connected' ? 'text-sci-green animate-pulse' : 
              server.status === 'connecting' ? 'text-sci-cyan animate-spin' : 
              server.status === 'error' ? 'text-sci-red' :
              'text-sci-dim opacity-40'
            }/>
            <div className="flex-1 min-w-0">
               <div className="text-[11px] font-sci font-bold truncate leading-tight tracking-wider">{server.name}</div>
               <div className="text-[9px] font-sci opacity-40 truncate leading-tight tracking-tighter">{server.ip}</div>
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 ml-auto shrink-0 bg-sci-panel/90 backdrop-blur rounded px-1 shadow-lg border border-sci-cyan/20">
              <button className="p-1 text-sci-dim hover:text-sci-cyan transition-colors" onClick={(e) => { e.stopPropagation(); onEditServer(server); }} title="编辑节点配置">
                <Edit3 size={12}/>
              </button>
              <button className="p-1 text-sci-dim hover:text-sci-red transition-colors" onClick={(e) => { e.stopPropagation(); onDeleteServer(server.id); }} title="终止连接">
                <Trash2 size={12}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-sci-obsidian/50 border-r border-sci-cyan/10">
      {/* Header */}
      <div 
        className="p-4 border-b border-sci-cyan/10 flex items-center justify-between bg-sci-panel/30"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sci-cyan/10 border border-sci-cyan/30 text-sci-cyan rounded-sm">
            <ServerIcon size={16} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-sci font-bold text-sci-text uppercase tracking-widest">方块 AI 助手</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-sci-cyan animate-pulse"></span>
              <span className="text-[9px] text-sci-cyan/40 uppercase tracking-tighter font-bold font-sci">网络上行活跃</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button 
            onClick={() => onAddFolder(null)}
            className="p-1.5 text-sci-dim hover:text-sci-cyan hover:bg-sci-cyan/5 transition-all rounded"
            title="创建目录"
          >
            <FolderPlus size={16} />
          </button>
          <button 
            onClick={() => onAddServer(null)}
            className="p-1.5 text-sci-dim hover:text-sci-cyan hover:bg-sci-cyan/5 transition-all rounded"
            title="关联新节点"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        className={`flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 transition-colors
          ${dragOverId === 'root' ? 'bg-sci-cyan/5' : ''}`}
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
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-sci-cyan/5 border border-sci-cyan/10 flex items-center justify-center text-sci-cyan/20">
              <FolderIcon size={32} />
            </div>
            <p className="text-xs text-sci-cyan/40 font-sci uppercase tracking-widest">未检测到节点</p>
            <button 
              onClick={() => onAddServer(null)}
              className="mt-4 px-4 py-2 bg-sci-cyan/10 border border-sci-cyan/30 text-sci-cyan text-[10px] font-sci uppercase tracking-[0.2em] hover:bg-sci-cyan hover:text-black transition-all clip-corner"
            >
              初始化连接
            </button>
          </div>
        )}
      </div>
      
      {/* 底部装饰性状态栏 */}
      <div className="p-2 border-t border-sci-cyan/10 bg-sci-panel/50 flex items-center justify-between">
         <div className="text-[9px] text-sci-cyan/40 font-sci flex items-center gap-1.5 tracking-widest uppercase font-bold">
           <span className="w-1.5 h-1.5 rounded-full bg-sci-green shadow-[0_0_5px_#22c55e]"></span>
           神经核心就绪
         </div>
         <div className="text-[9px] text-sci-cyan/20 font-sci tracking-tighter uppercase font-bold">
           V2.5.4_上行链路
         </div>
      </div>
    </div>
  );
};
