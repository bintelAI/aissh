import React, { useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

interface TerminalSearchProps {
  onSearch: (text: string, direction: 'next' | 'prev', isIncremental?: boolean) => void;
  onClose: () => void;
  isOpen: boolean;
  hasMatches?: boolean;
}

export const TerminalSearch: React.FC<TerminalSearchProps> = ({ onSearch, onClose, isOpen, hasMatches = true }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onSearch(inputRef.current?.value || '', 'prev', false);
      } else {
        onSearch(inputRef.current?.value || '', 'next', false);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="absolute top-4 right-12 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className={`bg-sci-obsidian/90 backdrop-blur-md border ${!hasMatches && inputRef.current?.value ? 'border-sci-red/50' : 'border-sci-cyan/30'} shadow-[0_0_20px_rgba(0,243,255,0.2)] p-1.5 flex items-center gap-1 min-w-[320px]`}>
        <div className="relative flex-1">
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${!hasMatches && inputRef.current?.value ? 'text-sci-red/50' : 'text-sci-cyan/50'}`} />
          <input
            ref={inputRef}
            type="text"
            placeholder="在所有终端中搜索..."
            className={`w-full bg-black/50 border border-white/5 focus:border-sci-cyan/50 ${!hasMatches && inputRef.current?.value ? 'text-sci-red' : 'text-sci-cyan'} text-xs py-1.5 pl-8 pr-2 outline-none transition-all placeholder:text-sci-dim/30`}
            onKeyDown={handleKeyDown}
            onChange={(e) => onSearch(e.target.value, 'next', true)}
          />
          {!hasMatches && inputRef.current?.value && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-sci-red uppercase font-bold tracking-tighter">
              未找到匹配项
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => onSearch(inputRef.current?.value || '', 'prev', false)}
            className="p-1.5 hover:bg-sci-cyan/10 text-sci-dim hover:text-sci-cyan transition-colors"
            title="上一个 (Shift+Enter)"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => onSearch(inputRef.current?.value || '', 'next', false)}
            className="p-1.5 hover:bg-sci-cyan/10 text-sci-dim hover:text-sci-cyan transition-colors"
            title="下一个 (Enter)"
          >
            <ChevronDown size={16} />
          </button>
          <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-sci-red/10 text-sci-dim hover:text-sci-red transition-colors"
            title="关闭 (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
