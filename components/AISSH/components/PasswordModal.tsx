
import React, { useState } from 'react';
import { CyberPanel } from '../common/CyberPanel';
import { Button } from '../common/Button';
import { X, Key, ShieldCheck, Lock } from 'lucide-react';

interface PasswordModalProps {
  serverName: string;
  onClose: () => void;
  onConfirm: (password: string, remember: boolean) => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ serverName, onClose, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      onConfirm(password, remember);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <CyberPanel 
        variant="obsidian" 
        className="w-full max-w-md border border-sci-cyan/30 shadow-[0_0_50px_rgba(0,243,255,0.2)] clip-corner overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-sci-panel/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sci-cyan/10 border border-sci-cyan/30 text-sci-cyan">
              <Lock size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-sci font-bold text-lg text-sci-text uppercase tracking-widest">
                需要身份验证
              </h3>
              <p className="text-[10px] text-sci-cyan/40 uppercase tracking-[0.2em] font-bold font-sci">
                安全连接到: {serverName}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2 group">
            <label className="flex items-center gap-2 text-[10px] font-sci font-bold text-sci-cyan/60 uppercase tracking-widest">
              <Key size={12} />
              神经密钥 (密码)
            </label>
            <div className="relative">
              <input 
                type="password"
                autoFocus
                className="w-full bg-black/40 border border-white/10 px-4 py-3 font-mono text-sm focus:outline-none focus:border-sci-cyan/50 text-sci-text transition-all group-hover:border-white/20" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
              />
              <div className="absolute bottom-0 left-0 h-[1px] bg-sci-cyan w-0 group-focus-within:w-full transition-all duration-500"></div>
            </div>
          </div>

          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setRemember(!remember)}>
            <div className={`w-4 h-4 border transition-all flex items-center justify-center ${remember ? 'bg-sci-cyan border-sci-cyan' : 'bg-transparent border-white/20 group-hover:border-sci-cyan/50'}`}>
              {remember && <ShieldCheck size={12} className="text-black" />}
            </div>
            <span className="text-[10px] font-sci font-bold text-sci-dim uppercase tracking-widest group-hover:text-sci-text transition-colors">
              在本地保险库保存凭据
            </span>
          </div>

          <div className="flex items-center justify-end gap-4 pt-2">
            <Button 
              variant="ghost"
              onClick={onClose}
              type="button"
              size="sm"
            >
              取消
            </Button>
            <Button 
              variant="primary"
              type="submit"
              size="sm"
              className="px-8"
              disabled={!password}
            >
              连接节点
            </Button>
          </div>
        </form>
      </CyberPanel>
    </div>
  );
};
