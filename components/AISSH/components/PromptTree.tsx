import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { PromptNode } from '../types';
import { getChildNodes } from '../store/usePromptStore';

interface PromptTreeProps {
  tree: PromptNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onAddPrompt: (parentId: string | null) => void;
  onDeleteNode: (id: string) => void;
  onMoveNode: (id: string, newParentId: string | null, newOrder: number) => void;
}

interface TreeNodeProps {
  node: PromptNode;
  tree: PromptNode[];
  level: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onAddPrompt: (parentId: string | null) => void;
  onDeleteNode: (id: string) => void;
  onMoveNode: (id: string, newParentId: string | null, newOrder: number) => void;
  draggedNodeId: string | null;
  setDraggedNodeId: (id: string | null) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  tree,
  level,
  selectedNodeId,
  onSelectNode,
  onToggleFolder,
  onAddFolder,
  onAddPrompt,
  onDeleteNode,
  onMoveNode,
  draggedNodeId,
  setDraggedNodeId
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState<'before' | 'after' | 'inside' | null>(null);
  const children = getChildNodes(tree, node.id);
  const isFolder = node.type === 'folder';
  const isSelected = selectedNodeId === node.id;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedNodeId(node.id);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setIsDragging(false);
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedNodeId === node.id) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (isFolder && y > height * 0.3 && y < height * 0.7) {
      setDragOver('inside');
    } else if (y < height / 2) {
      setDragOver('before');
    } else {
      setDragOver('after');
    }
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeId || draggedNodeId === node.id) {
      setDragOver(null);
      return;
    }

    if (dragOver === 'inside' && isFolder) {
      onMoveNode(draggedNodeId, node.id, 999);
    } else if (dragOver === 'before') {
      onMoveNode(draggedNodeId, node.parentId, node.order);
    } else if (dragOver === 'after') {
      onMoveNode(draggedNodeId, node.parentId, node.order + 1);
    }

    setDragOver(null);
  };

  const handleClick = () => {
    if (isFolder) {
      onToggleFolder(node.id);
    }
    onSelectNode(node.id);
  };

  const indentStyle = { paddingLeft: `${level * 16 + 8}px` };

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={indentStyle}
        className={`
          group flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer border-l-2 transition-all
          ${isSelected 
            ? 'bg-sci-cyan/10 border-sci-cyan text-sci-cyan' 
            : 'border-transparent hover:bg-white/5 text-sci-text'
          }
          ${isDragging ? 'opacity-50' : ''}
          ${dragOver === 'before' ? 'border-t-2 border-t-sci-cyan' : ''}
          ${dragOver === 'after' ? 'border-b-2 border-b-sci-cyan' : ''}
          ${dragOver === 'inside' ? 'bg-sci-cyan/20' : ''}
        `}
      >
        <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-50">
          <GripVertical size={12} />
        </div>

        {isFolder ? (
          <span className="text-sci-cyan/80">
            {node.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-3.5" />
        )}

        {isFolder ? (
          <Folder size={14} className="text-sci-cyan/60" />
        ) : (
          <FileText size={14} className="text-sci-violet/60" />
        )}

        <span className="flex-1 truncate font-sci uppercase tracking-wider">
          {node.name}
        </span>

        {isFolder && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddPrompt(node.id);
              }}
              className="p-1 hover:bg-sci-cyan/20 text-sci-cyan/60 hover:text-sci-cyan rounded"
              title="添加提示语"
            >
              <FileText size={10} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddFolder(node.id);
              }}
              className="p-1 hover:bg-sci-cyan/20 text-sci-cyan/60 hover:text-sci-cyan rounded"
              title="添加子文件夹"
            >
              <Plus size={10} />
            </button>
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteNode(node.id);
          }}
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-sci-red/20 text-sci-red/60 hover:text-sci-red rounded transition-all"
          title="删除"
        >
          <Trash2 size={10} />
        </button>
      </div>

      {isFolder && node.isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              tree={tree}
              level={level + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              onToggleFolder={onToggleFolder}
              onAddFolder={onAddFolder}
              onAddPrompt={onAddPrompt}
              onDeleteNode={onDeleteNode}
              onMoveNode={onMoveNode}
              draggedNodeId={draggedNodeId}
              setDraggedNodeId={setDraggedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const PromptTree: React.FC<PromptTreeProps> = ({
  tree,
  selectedNodeId,
  onSelectNode,
  onToggleFolder,
  onAddFolder,
  onAddPrompt,
  onDeleteNode,
  onMoveNode
}) => {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const rootNodes = getChildNodes(tree, null);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      {rootNodes.length === 0 ? (
        <div className="p-4 text-center text-white/40 text-xs">
          暂无配置，点击上方按钮添加
        </div>
      ) : (
        rootNodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            tree={tree}
            level={0}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onToggleFolder={onToggleFolder}
            onAddFolder={onAddFolder}
            onAddPrompt={onAddPrompt}
            onDeleteNode={onDeleteNode}
            onMoveNode={onMoveNode}
            draggedNodeId={draggedNodeId}
            setDraggedNodeId={setDraggedNodeId}
          />
        ))
      )}
    </div>
  );
};

export default PromptTree;
