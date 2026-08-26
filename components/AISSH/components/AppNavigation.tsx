import { Monitor, ScrollText, Settings } from 'lucide-react';
import type { AppView } from './appLayout';

export type { AppView } from './appLayout';

interface AppNavigationProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

const navigationItems = [
  { id: 'workspace' as const, label: '工作区', Icon: Monitor },
  { id: 'logs' as const, label: '历史日志', Icon: ScrollText },
  { id: 'settings' as const, label: '设置', Icon: Settings },
];

export function AppNavigation({ activeView, onChange }: AppNavigationProps) {
  return (
    <nav className="z-20 flex h-screen w-14 flex-shrink-0 flex-col items-center border-r border-sci-cyan/15 bg-sci-obsidian/80 py-3 backdrop-blur-md">
      <div className="mb-5 h-1 w-5 bg-sci-cyan shadow-[0_0_10px_rgba(0,243,255,0.8)]" />
      <div className="flex flex-col gap-2">
        {navigationItems.map(({ id, label, Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => onChange(id)}
              className={`relative flex h-10 w-10 items-center justify-center border transition-colors ${
                isActive
                  ? 'border-sci-cyan/70 bg-sci-cyan/15 text-sci-cyan shadow-[0_0_18px_rgba(0,243,255,0.16)]'
                  : 'border-transparent text-sci-dim hover:border-white/15 hover:bg-white/5 hover:text-sci-text'
              }`}
            >
              {isActive && <span className="absolute -left-[7px] h-5 w-0.5 bg-sci-cyan" />}
              <Icon size={18} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
