import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, PlusCircle, Trash2 } from 'lucide-react';
import { usePromptStore } from '../store/usePromptStore';
import { CyberSelect } from '../common/CyberSelect';

interface PromptConfigModalProps {
  onClose: () => void;
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

export const PromptConfigModal: React.FC<PromptConfigModalProps> = ({ onClose }) => {
  const {
    profiles,
    selectedProfileId,
    selectProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    addRule,
    updateRule,
    deleteRule
  } = usePromptStore();

  const selected = profiles.find((p) => p.id === selectedProfileId) || profiles[0];

  const [editName, setEditName] = useState(selected?.name || '');
  const [editType, setEditType] = useState(selected?.deviceType || '');

  // 当选择的配置改变时，同步局部状态
  useEffect(() => {
    if (selected) {
      setEditName(selected.name);
      setEditType(selected.deviceType);
    }
  }, [selected?.id]);

  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileType, setNewProfileType] = useState('custom');

  const handleAddProfile = () => {
    const name = newProfileName.trim() || `自定义类型 ${new Date().toLocaleTimeString()}`;
    const deviceType = newProfileType.trim() || 'custom';
    addProfile({
      name,
      deviceType,
      prompt: '',
      rules: []
    });
    setNewProfileName('');
    setNewProfileType('custom');
  };

  const handleAddRule = () => {
    if (!selected) return;
    addRule(selected.id, { pattern: '', color: 'cyan', remark: '' });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl bg-sci-obsidian border border-sci-cyan/30 clip-corner shadow-[0_0_50px_rgba(0,243,255,0.1)]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-sci-panel/50">
          <div className="text-xs font-sci font-bold text-sci-text uppercase tracking-widest">
            设备类型提示语配置
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 text-sci-text/60 hover:text-sci-red transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-[260px_1fr] gap-4 p-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="bg-black/40 border border-white/10 clip-corner">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-[10px] font-sci uppercase tracking-widest text-sci-cyan/60">
                提示语类型
              </span>
              <button
                onClick={handleAddProfile}
                className="px-2 py-1 text-[10px] bg-sci-cyan/10 text-sci-cyan border border-sci-cyan/30 clip-corner hover:bg-sci-cyan hover:text-black transition-all flex items-center gap-1"
              >
                <PlusCircle size={12} />
                添加
              </button>
            </div>

            <div className="p-3 flex gap-2">
              <input
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="新类型名称"
                className="flex-1 bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
              />
              <input
                value={newProfileType}
                onChange={(e) => setNewProfileType(e.target.value)}
                placeholder="设备标识"
                className="w-24 bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
              />
            </div>

            <div className="p-2 space-y-1">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-2 py-2 text-xs cursor-pointer border clip-corner ${
                    selected?.id === p.id
                      ? 'bg-sci-cyan/10 border-sci-cyan/30 text-sci-cyan'
                      : 'border-transparent hover:bg-white/5 text-sci-text'
                  }`}
                  onClick={() => selectProfile(p.id)}
                >
                  <div className="truncate">
                    <div className="font-sci uppercase tracking-wider">{p.name}</div>
                    <div className="text-[10px] text-white/40">设备: {p.deviceType}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProfile(p.id);
                    }}
                    className="p-1 text-sci-red/80 hover:text-sci-red"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-black/40 border border-white/10 clip-corner">
              <div className="p-3 border-b border-white/10 text-[10px] font-sci uppercase tracking-widest text-sci-cyan/60 flex items-center gap-4">
                <span>提示语配置</span>
              </div>
              <div className="p-3 grid grid-cols-[1fr_120px] gap-2">
                 <input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (selected) updateProfile(selected.id, { name: e.target.value });
                  }}
                  placeholder="类型名称"
                  className="bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
                />
                 <input
                  value={editType}
                  onChange={(e) => {
                    setEditType(e.target.value);
                    if (selected) updateProfile(selected.id, { deviceType: e.target.value });
                  }}
                  placeholder="设备标识"
                  className="bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
                />
              </div>
              <div className="px-3 pb-3">
                <div className="text-[10px] text-white/40 mb-1 font-sci uppercase tracking-widest">操作指令规范 (System Prompt)</div>
                <textarea
                  value={selected?.prompt || ''}
                  onChange={(e) => selected && updateProfile(selected.id, { prompt: e.target.value })}
                  className="w-full min-h-[140px] bg-black/60 border border-white/10 text-sci-text p-3 text-xs font-mono clip-corner resize-none"
                  placeholder="为该设备类型编写清晰的操作指令规范"
                />
              </div>
            </div>

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
                {(selected?.rules || []).map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr_150px_1fr_60px] gap-2 items-center">
                    <input
                      value={r.pattern}
                      onChange={(e) => updateRule(selected!.id, r.id, { pattern: e.target.value })}
                      placeholder="高亮正则或关键词"
                      className="bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
                    />
                    <div className="flex-shrink-0">
                      <CyberSelect
                        value={r.color}
                        onChange={(val) => updateRule(selected!.id, r.id, { color: val })}
                        options={colorOptions}
                        variant="cyan"
                        width="150px"
                      />
                    </div>
                    <input
                      value={r.remark || ''}
                      onChange={(e) => updateRule(selected!.id, r.id, { remark: e.target.value })}
                      placeholder="备注"
                      className="bg-black/60 border border-white/10 text-sci-text px-2 py-1 text-[12px] clip-corner"
                    />
                    <button
                      onClick={() => deleteRule(selected!.id, r.id)}
                      className="px-2 py-1 text-[12px] bg-sci-red/10 text-sci-red border border-sci-red/30 clip-corner hover:bg-sci-red hover:text-black transition-all"
                    >
                      删除
                    </button>
                  </div>
                ))}
                {selected && selected.rules.length === 0 && (
                  <div className="text-[12px] text-white/60">暂无规则，点击上方“添加规则”创建。</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-sci-panel/50 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-2 bg-sci-cyan text-black font-sci font-bold text-xs uppercase tracking-[0.2em] hover:bg-sci-cyan/80 transition-all clip-corner"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
