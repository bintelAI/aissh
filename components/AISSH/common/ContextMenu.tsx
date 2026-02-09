import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'primary';
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 调整菜单位置，防止超出屏幕
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - (items.length * 40));

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[160px] bg-sci-panel/95 backdrop-blur-xl border border-sci-cyan/30 shadow-[0_0_20px_rgba(0,243,255,0.15)] rounded overflow-hidden animate-in fade-in zoom-in duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="py-1">
        {items.map((item, index) => {
          const getVariantClasses = () => {
            switch (item.variant) {
              case 'danger':
                return 'text-sci-red/80 hover:text-sci-red';
              case 'primary':
                return 'text-sci-cyan hover:text-sci-cyan bg-sci-cyan/5 hover:bg-sci-cyan/20';
              default:
                return 'text-sci-text/80 hover:text-sci-cyan';
            }
          };
          
          const getIconClasses = () => {
            switch (item.variant) {
              case 'danger':
                return 'group-hover:text-sci-red';
              case 'primary':
                return 'text-sci-cyan group-hover:text-sci-cyan';
              default:
                return 'group-hover:text-sci-cyan';
            }
          };
          
          return (
            <button
              key={index}
              className={`w-full flex items-center gap-3 px-3 py-2 text-[11px] font-sci uppercase tracking-wider transition-all hover:bg-sci-cyan/10 group ${getVariantClasses()}`}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
            >
              {item.icon && (
                <span className={`shrink-0 transition-colors ${getIconClasses()}`}>
                  {item.icon}
                </span>
              )}
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* 装饰边角 */}
      <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-sci-cyan/50"></div>
      <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-sci-cyan/50"></div>
      <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-sci-cyan/50"></div>
      <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-sci-cyan/50"></div>
    </div>
  );
};
