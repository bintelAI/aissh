import React from 'react';
import { Activity, BrainCircuit, Cpu, ShieldCheck, Zap } from 'lucide-react';

export const AIEmptyState: React.FC<{ onAction?: (text: string) => void }> = ({ onAction }) => {
  const suggestions = [
    { icon: <Cpu size={15} />, text: '检查服务器 CPU 负载', cmd: 'top -b -n 1 | head -n 10' },
    { icon: <Activity size={15} />, text: '查看网络连接状态', cmd: 'netstat -tuln' },
    { icon: <Zap size={15} />, text: '分析最近的系统日志', cmd: 'tail -n 50 /var/log/syslog' },
    { icon: <ShieldCheck size={15} />, text: '检测潜在的安全风险', cmd: 'last -n 10' },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-hidden p-6">
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-lg border border-sci-cyan/25 bg-sci-cyan/10 text-sci-cyan">
        <BrainCircuit size={24} />
      </div>
      <div className="mb-7 text-center">
        <h3 className="text-sm font-semibold text-sci-text">开始新的运维会话</h3>
        <p className="mt-1.5 text-xs text-sci-dim">选择下方任务，或直接输入需要处理的问题。</p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-1 gap-2.5">
        {suggestions.map((item) => (
          <button
            key={item.text}
            onClick={() => onAction?.(item.text)}
            className="group flex items-center gap-3 rounded-md border border-white/10 bg-sci-panel/70 p-3 text-left transition-colors duration-150 hover:border-sci-cyan/40 hover:bg-sci-cyan/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sci-cyan/70"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-sci-cyan/10 text-sci-cyan group-hover:bg-sci-cyan/15">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-sci-text">{item.text}</span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-sci-dim">{item.cmd}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
