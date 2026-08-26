import React, { useEffect, useState, useMemo } from 'react';
import { useFileStore } from '../../store/useFileStore';
import { useSSHStore } from '../../store/useSSHStore';
import { FileNode } from '../../types';
import { Folder, FileText, ChevronRight, ChevronDown, RefreshCw, Home, ArrowUp, Plus, Download, Trash2, Edit, Copy, Search, X } from 'lucide-react';
import { Button } from '../../common/Button';

interface FileBrowserProps {
  serverId: string;
  onFileOpen: (filePath: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  file: FileNode | null;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ serverId, onFileOpen }) => {
  const { 
    fileTreeCache, 
    fileBrowserPath, 
    isLoading, 
    refreshFileTree, 
    setFileBrowserPath,
    deleteFile,
    backupFile,
    createFile,
    downloadFile
  } = useFileStore();

  const { connectionStatus } = useSSHStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  const currentPath = fileBrowserPath[serverId] || '/';
  const fileList = fileTreeCache[`${serverId}:${currentPath}`] || [];
  const loading = isLoading[serverId];
  const isConnected = connectionStatus[serverId] === 'connected';

  // Search filter logic
  const filteredFileList = useMemo(() => {
    if (!searchQuery.trim()) return fileList;
    const query = searchQuery.toLowerCase();
    return fileList.filter(file => file.name.toLowerCase().includes(query));
  }, [fileList, searchQuery]);

  useEffect(() => {
    // Trigger refresh when:
    // 1. Connection becomes 'connected'
    // 2. ServerId changes
    // 3. Path changes
    // 4. Cache is missing
    if (isConnected && !fileTreeCache[`${serverId}:${currentPath}`]) {
      refreshFileTree(serverId, currentPath);
    }
  }, [serverId, currentPath, isConnected, fileTreeCache]);

  const handleNavigate = (path: string) => {
    setFileBrowserPath(serverId, path);
    setSearchQuery(''); // Clear search when navigating
  };

  const handleGoUp = () => {
    if (currentPath === '/') return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    handleNavigate(parentPath);
  };

  const handleContextMenu = (e: React.MouseEvent, file: FileNode) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file
    });
  };

  const handleCreateFile = async () => {
    const fileName = window.prompt('请输入文件名:');
    if (fileName) {
      const success = await createFile(serverId, currentPath, fileName);
      if (!success) {
        alert('创建文件失败');
      }
    }
  };

  const handleDeleteFile = async (file: FileNode) => {
    if (window.confirm(`确定要删除 ${file.name} 吗?`)) {
      const success = await deleteFile(serverId, file.path);
      if (!success) {
        alert('删除失败');
      }
    }
  };

  const handleBackupFile = async (file: FileNode) => {
    const success = await backupFile(serverId, file.path);
    if (!success) {
      alert('备份失败');
    }
  };

  const handleDownload = (file: FileNode) => {
    downloadFile(serverId, file.path, file.name);
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-black/20 via-sci-obsidian/40 to-black/60 backdrop-blur-md text-sci-text text-sm overflow-hidden relative">
      {/* 装饰性背景网格 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      {/* Header / Toolbar */}
      <div className="flex items-center p-2 border-b border-white/5 bg-black/20 backdrop-blur-md space-x-2 relative z-10">
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => handleNavigate('/')}
          disabled={loading}
          title="根目录"
          className="hover:bg-sci-cyan/10 hover:text-sci-cyan"
        >
          <Home size={14} />
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleGoUp}
          disabled={currentPath === '/' || loading}
          title="上级目录"
          className="hover:bg-sci-cyan/10 hover:text-sci-cyan"
        >
          <ArrowUp size={14} />
        </Button>
        <div className="flex-1 bg-black/40 px-2 py-1 rounded text-xs truncate border border-white/10 font-mono text-sci-cyan/80">
          {currentPath}
        </div>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => setIsSearchVisible(!isSearchVisible)}
          disabled={loading}
          className={isSearchVisible ? "text-sci-cyan bg-sci-cyan/10" : "hover:bg-sci-cyan/10 hover:text-sci-cyan"}
          title="搜索文件"
        >
          <Search size={14} />
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleCreateFile}
          disabled={loading}
          title="新建文件"
          className="hover:bg-sci-cyan/10 hover:text-sci-cyan"
        >
          <Plus size={14} />
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => refreshFileTree(serverId, currentPath)}
          disabled={loading}
          title="刷新"
          className="hover:bg-sci-cyan/10 hover:text-sci-cyan"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Search Input */}
      {isSearchVisible && (
        <div className="p-2 border-b border-white/5 bg-sci-obsidian/20 relative z-10">
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="搜索当前目录..."
              className="w-full bg-black/40 border border-white/10 rounded px-7 py-1 text-xs focus:border-sci-cyan/50 focus:outline-none text-sci-text font-mono"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sci-dim" />
            {searchQuery && (
              <button 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sci-dim hover:text-white"
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        {loading && fileList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-sci-dim gap-2">
            <RefreshCw size={20} className="animate-spin text-sci-cyan/50"/>
            <span className="text-xs font-sci uppercase tracking-widest">Loading Data...</span>
          </div>
        ) : (
          <div className="flex flex-col p-1">
            {filteredFileList.length === 0 ? (
              <div className="p-8 text-center text-sci-dim text-xs flex flex-col items-center gap-2 opacity-50">
                <Folder size={24} />
                {searchQuery ? "未找到匹配文件" : "空目录"}
              </div>
            ) : (
              filteredFileList.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center px-3 py-1.5 hover:bg-white/5 cursor-pointer group transition-colors select-none rounded border border-transparent hover:border-white/5"
                  onClick={() => {
                    if (file.type === 'folder') {
                      handleNavigate(file.path);
                    } else {
                      onFileOpen(file.path);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                >
                  <div className={`mr-2 transition-colors ${file.type === 'folder' ? 'text-sci-violet group-hover:text-sci-violet/80' : 'text-sci-cyan group-hover:text-sci-cyan/80'}`}>
                    {file.type === 'folder' ? <Folder size={14} /> : <FileText size={14} />}
                  </div>
                  <div className="flex-1 truncate text-xs font-mono group-hover:text-white transition-colors">
                    {file.name}
                  </div>
                  <div className="text-[10px] text-sci-dim/50 w-16 text-right group-hover:text-sci-dim font-mono">
                    {formatSize(file.size)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div 
            className="fixed z-[100] bg-sci-obsidian/90 backdrop-blur-md border border-sci-cyan/20 rounded shadow-[0_0_20px_rgba(0,0,0,0.5)] py-1 min-w-[140px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.file?.type === 'file' && (
              <button 
                className="w-full flex items-center px-3 py-2 text-xs hover:bg-sci-cyan/10 text-sci-text hover:text-sci-cyan transition-colors font-sci uppercase tracking-wide"
                onClick={() => {
                  if (contextMenu.file) onFileOpen(contextMenu.file.path);
                  setContextMenu(null);
                }}
              >
                <Edit size={12} className="mr-2" /> 编辑
              </button>
            )}
            <button 
              className="w-full flex items-center px-3 py-2 text-xs hover:bg-sci-cyan/10 text-sci-text hover:text-sci-cyan transition-colors font-sci uppercase tracking-wide"
              onClick={() => {
                if (contextMenu.file) handleBackupFile(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Copy size={12} className="mr-2" /> 备份
            </button>
            <button 
              className="w-full flex items-center px-3 py-2 text-xs hover:bg-sci-cyan/10 text-sci-text hover:text-sci-cyan transition-colors font-sci uppercase tracking-wide"
              onClick={() => {
                if (contextMenu.file) handleDownload(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Download size={12} className="mr-2" /> 下载
            </button>
            <div className="h-px bg-white/5 my-1" />
            <button 
              className="w-full flex items-center px-3 py-2 text-xs hover:bg-sci-red/10 text-sci-red transition-colors font-sci uppercase tracking-wide"
              onClick={() => {
                if (contextMenu.file) handleDeleteFile(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Trash2 size={12} className="mr-2" /> 删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
