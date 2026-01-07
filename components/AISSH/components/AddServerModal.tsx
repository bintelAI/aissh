
import React, { useState, useEffect } from 'react';
import { Server } from '../types/index';
import { CyberPanel } from '../common/CyberPanel';
import { Button } from '../common/Button';
import { X, Server as ServerIcon, Shield, Globe, Terminal as PortIcon, User, Key, Save } from 'lucide-react';

interface AddServerModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
  parentId: string | null;
  initialData?: Server;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({ onClose, onSave, parentId, initialData }) => {
  const [formData, setFormData] = useState({
    name: '', ip: '', username: '', password: '', port: '22'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        ip: initialData.ip,
        username: initialData.username,
        password: initialData.password || '',
        port: initialData.port.toString()
      });
    }
  }, [initialData]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <CyberPanel 
        variant="obsidian" 
        className="w-full max-w-lg border border-sci-cyan/30 shadow-[0_0_50px_rgba(0,243,255,0.15)] clip-corner overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-sci-panel/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sci-cyan/10 border border-sci-cyan/30 text-sci-cyan">
              <ServerIcon size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-sci font-bold text-lg text-sci-text uppercase tracking-widest">
                {initialData ? '更新节点' : '初始化节点连接'}
              </h3>
              <p className="text-[10px] text-sci-cyan/40 uppercase tracking-[0.2em] font-bold font-sci">
                {initialData ? '修改上行链路配置' : '建立新的网格连接'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 text-sci-dim hover:text-sci-red transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            {/* Name */}
            <div className="col-span-2 space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-sci font-bold text-sci-cyan/60 uppercase tracking-widest">
                <Shield size={12} />
                神经节点别名
              </label>
              <div className="relative">
                <input 
                  autoFocus
                  className="w-full bg-black/40 border border-white/10 px-4 py-2.5 font-sci text-sm focus:outline-none focus:border-sci-cyan/50 text-sci-text transition-all group-hover:border-white/20" 
                  placeholder="例如：生产集群 Alpha" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
                <div className="absolute bottom-0 left-0 h-[1px] bg-sci-cyan w-0 group-focus-within:w-full transition-all duration-500"></div>
              </div>
            </div>

            {/* IP */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-sci font-bold text-sci-cyan/60 uppercase tracking-widest">
                <Globe size={12} />
                目标 IP / 主机
              </label>
              <input 
                className="w-full bg-black/40 border border-white/10 px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-sci-cyan/50 text-sci-text transition-all group-hover:border-white/20" 
                placeholder="10.0.0.1" 
                value={formData.ip} 
                onChange={e => setFormData({...formData, ip: e.target.value})}
              />
            </div>

            {/* Port */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-sci font-bold text-sci-cyan/60 uppercase tracking-widest">
                <PortIcon size={12} />
                上行端口
              </label>
              <input 
                className="w-full bg-black/40 border border-white/10 px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-sci-cyan/50 text-sci-text transition-all group-hover:border-white/20" 
                value={formData.port} 
                onChange={e => setFormData({...formData, port: e.target.value})}
              />
            </div>

            {/* Username */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-sci font-bold text-sci-cyan/60 uppercase tracking-widest">
                <User size={12} />
                访问身份
              </label>
              <input 
                className="w-full bg-black/40 border border-white/10 px-4 py-2.5 font-sci text-sm focus:outline-none focus:border-sci-cyan/50 text-sci-text transition-all group-hover:border-white/20" 
                placeholder="root" 
                value={formData.username} 
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>

            {/* Password */}
            <div className="space-y-2 group">
              <label className="flex items-center gap-2 text-[10px] font-sci font-bold text-sci-cyan/60 uppercase tracking-widest">
                <Key size={12} />
                神经密钥
              </label>
              <input 
                type="password" 
                className="w-full bg-black/40 border border-white/10 px-4 py-2.5 font-mono text-sm focus:outline-none focus:border-sci-cyan/50 text-sci-text transition-all group-hover:border-white/20" 
                placeholder="••••••••" 
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-sci-panel/30 border-t border-white/5 flex items-center justify-end gap-4">
          <Button 
            variant="ghost"
            onClick={onClose}
            size="sm"
          >
            中止
          </Button>
          <Button 
            variant="primary"
            onClick={() => onSave({
              ...formData, 
              port: parseInt(formData.port) || 22,
              parentId: initialData ? initialData.parentId : parentId 
            })}
            size="sm"
            className="px-8"
          >
            <Save size={14} />
            {initialData ? '应用同步' : '初始化连接'}
          </Button>
        </div>
      </CyberPanel>
    </div>
  );
};
