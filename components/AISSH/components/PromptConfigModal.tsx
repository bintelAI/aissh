import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, PlusCircle, Trash2, Folder, FileText, Check } from 'lucide-react';
import { usePromptStore } from '../store/usePromptStore';
import { PromptTree } from './PromptTree';
import { PromptNode } from '../types';
import { CyberSelect } from '../common/CyberSelect';

interface PromptConfigModalProps {
  onClose?: () => void;
  embedded?: boolean;
}

const colorOptions = [
  { value: 'red', label: '红色' },
  { value: 'orange', label: '橙色' },
  { value: 'yellow', label: '黄色' },
  { value: 'green', label: '绿色' },
  { value: 'cyan', label: '青色' },
  { value: 'blue', label: '蓝色' },
  { value: 'violet', label: '紫色' },
  { value: 'white', label: '白色' }
];

export const PromptConfigModal: React.FC<PromptConfigModalProps> = ({ onClose, embedded = false }) => {
  const {
    promptTree,
    selectedPromptIds,
    addNode,
    updateNode,
    deleteNode,
    moveNode,
    toggleFolder,
    addRule,
    updateRule,
    deleteRule
  } = usePromptStore();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDeviceType, setEditDeviceType] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  const selectedNode = selectedNodeId 
    ? promptTree.find(n => n.id === selectedNodeId) 
    : null;

  // 同步编辑状态
  useEffect(() => {
    if (selectedNode) {
      setEditName(selectedNode.name);
      setEditDeviceType(selectedNode.deviceType || '');
      setEditPrompt(selectedNode.prompt || '');
    } else {
      setEditName('');
      setEditDeviceType('');
      setEditPrompt('');
    }
  }, [selectedNode?.id]);

  const handleAddFolder = (parentId: string | null = null) => {
    addNode({
      name: '新建文件夹',
      type: 'folder',
      isExpanded: true
    }, parentId);
  };

  const handleAddPrompt = (parentId: string | null = null) => {
    addNode({
      name: '新建提示语',
      type: 'prompt',
      deviceType: 'custom',
      prompt: '',
      rules: []
    }, parentId);
  };

  const handleUpdateNode = () => {
    if (!selectedNodeId) return;
    const updates: Partial<PromptNode> = { name: editName };
    if (selectedNode?.type === 'prompt') {
      updates.deviceType = editDeviceType;
      updates.prompt = editPrompt;
    }
    updateNode(selectedNodeId, updates);
  };

  const handleAddRule = () => {
    if (!selectedNodeId || selectedNode?.type !== 'prompt') return;
    addRule(selectedNodeId, { pattern: '', color: 'cyan', remark: '' });
  };

  const content = (
      <div className={`bg-sci-obsidian border border-sci-cyan/30 clip-corner drop-shadow-[0_0_40px_rgba(0,243,255,0.18)] flex flex-col ${embedded ? 'h-full min-h-0' : 'w-full max-w-5xl max-h-[90vh]'}`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-sci-panel/50">
          <div className="text-xs font-sci font-bold text-sci-text uppercase tracking-widest">
            设备类型提示语配置 (树形结构)
          </div>
          {!embedded && <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 text-sci-text/60 hover:text-sci-red transition-colors"
          >
            <X size={18} />
          </button>}
        </div>

        <div className={`flex-1 grid gap-0 min-h-0 ${embedded ? 'grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]' : 'grid-cols-[320px_1fr]'}`}>
          {/* 左侧树形结构 */}
          <div className="border-r border-white/10 flex flex-col">
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/20">
              <span className="text-[10px] font-sci uppercase tracking-widest text-sci-cyan/60">
                提示语树
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => handleAddFolder(null)}
                  className="px-2 py-1 text-[10px] bg-sci-cyan/10 text-sci-cyan border border-sci-cyan/30 clip-corner hover:bg-sci-cyan hover:text-black transition-all flex items-center gap-1"
                >
                  <Folder size={10} />
                  文件夹
                </button>
                <button
                  onClick={() => handleAddPrompt(null)}
                  className="px-2 py-1 text-[10px] bg-sci-violet/10 text-sci-violet border border-sci-violet/30 clip-corner hover:bg-sci-violet hover:text-black transition-all flex items-center gap-1"
                >
                  <FileText size={10} />
                  提示语
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <PromptTree
                tree={promptTree}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onToggleFolder={toggleFolder}
                onAddFolder={handleAddFolder}
                onAddPrompt={handleAddPrompt}
                onDeleteNode={deleteNode}
                onMoveNode={moveNode}
              />
            </div>
          </div>

          {/* 右侧编辑区 */}
          <div className="p-4 overflow-y-auto custom-scrollbar">
            {selectedNode ? (
              <div className="space-y-4">
                {/* 基础信息 */}
                <div className="bg-black/40 border border-white/10 clip-corner">
                  <div className="p-3 border-b border-white/10 text-[10px] font-sci uppercase tracking-widest text-sci-cyan/60">
                    基础信息
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <label className="text-[10px] text-white/40 mb-1 block font-sci uppercase tracking-widest">
                        名称
                      </label>
                      <input
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          handleUpdateNode();
                        }}
                        placeholder="输入名称"
                        className="w-full bg-black/60 border border-white/10 text-sci-text px-2 py-1.5 text-xs clip-corner"
                      />
                    </div>

                    {selectedNode.type === 'prompt' && (
                      <div>
                        <label className="text-[10px] text-white/40 mb-1 block font-sci uppercase tracking-widest">
                          设备标识
                        </label>
                        <input
                          value={editDeviceType}
                          onChange={(e) => {
                            setEditDeviceType(e.target.value);
                            handleUpdateNode();
                          }}
                          placeholder="如: linux, cisco, san"
                          className="w-full bg-black/60 border border-white/10 text-sci-text px-2 py-1.5 text-xs clip-corner"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 提示语内容 */}
                {selectedNode.type === 'prompt' && (
                  <>
                    <div className="bg-black/40 border border-white/10 clip-corner">
                      <div className="p-3 border-b border-white/10 text-[10px] font-sci uppercase tracking-widest text-sci-cyan/60">
                        提示语内容 (System Prompt)
                      </div>
                      <div className="p-3">
                        <textarea
                          value={editPrompt}
                          onChange={(e) => {
                            setEditPrompt(e.target.value);
                            handleUpdateNode();
                          }}
                          className="w-full min-h-[200px] bg-black/60 border border-white/10 text-sci-text p-3 text-xs font-mono clip-corner resize-none"
                          placeholder="为该设备类型编写清晰的操作指令规范..."
                        />
                      </div>
                    </div>

                    {/* 高亮规则 */}
                    <div className="bg-black/40 border border-white/10 clip-corner">
                      <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-sci uppercase tracking-widest text-sci-cyan/60">
                            命令区域高亮配置
                          </span>
                          <span className="text-[9px] text-white/30 font-mono mt-0.5">
                            支持正则，如: (error|failed|fatal|critical)
                          </span>
                        </div>
                        <button
                          onClick={handleAddRule}
                          className="px-2 py-1 text-[10px] bg-sci-violet/10 text-sci-violet border border-sci-violet/30 clip-corner hover:bg-sci-violet hover:text-black transition-all"
                        >
                          添加规则
                        </button>
                      </div>

                      <div className="p-3 space-y-2">
                        {(selectedNode.rules || []).map((r) => (
                          <div key={r.id} className="grid grid-cols-[1fr_120px_1fr_60px] gap-2 items-center">
                            <input
                              value={r.pattern}
                              onChange={(e) => updateRule(selectedNodeId!, r.id, { pattern: e.target.value })}
                              placeholder="高亮正则或关键词"
                              className="bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
                            />
                            <div className="flex-shrink-0">
                              <CyberSelect
                                value={r.color}
                                onChange={(val) => updateRule(selectedNodeId!, r.id, { color: val })}
                                options={colorOptions}
                                variant="cyan"
                                width="120px"
                              />
                            </div>
                            <input
                              value={r.remark || ''}
                              onChange={(e) => updateRule(selectedNodeId!, r.id, { remark: e.target.value })}
                              placeholder="备注"
                              className="bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
                            />
                            <button
                              onClick={() => deleteRule(selectedNodeId!, r.id)}
                              className="px-2 py-1 text-[12px] bg-sci-red/10 text-sci-red border border-sci-red/30 clip-corner hover:bg-sci-red hover:text-black transition-all"
                            >
                              删除
                            </button>
                          </div>
                        ))}
                        {(selectedNode.rules || []).length === 0 && (
                          <div className="text-[12px] text-white/40 text-center py-4">
                            暂无规则，点击上方"添加规则"创建
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {selectedNode.type === 'folder' && (
                  <div className="bg-black/40 border border-white/10 clip-corner p-4 text-center">
                    <Folder size={48} className="mx-auto text-sci-cyan/30 mb-2" />
                    <div className="text-xs text-white/60">文件夹: {selectedNode.name}</div>
                    <div className="text-[10px] text-white/40 mt-1">
                      用于组织提示语配置，可展开/折叠
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/40">
                <FileText size={48} className="mb-4 opacity-30" />
                <div className="text-sm">选择左侧节点进行编辑</div>
                <div className="text-[10px] mt-2">或点击上方按钮创建新配置</div>
              </div>
            )}
          </div>
        </div>

        {!embedded && <div className="p-4 bg-sci-panel/50 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2 bg-sci-cyan text-black font-sci font-bold text-xs uppercase tracking-[0.2em] hover:bg-sci-cyan/80 transition-all clip-corner"
          >
            完成
          </button>
        </div>}
      </div>
  );

  if (embedded) return content;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      {content}
    </div>,
    document.body,
  );
};

export const PromptConfigEditor: React.FC = () => <PromptConfigModal embedded />;

export default PromptConfigModal;
