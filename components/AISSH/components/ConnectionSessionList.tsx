import { ChevronLeft, ChevronRight, Eye, ScrollText } from 'lucide-react';
import type { ConnectionSession } from '../types';

interface ConnectionSessionListProps {
  sessions: ConnectionSession[];
  page: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (session: ConnectionSession) => void;
}

const statusStyles: Record<ConnectionSession['status'], string> = {
  connecting: 'border-yellow-300/30 bg-yellow-300/10 text-yellow-300',
  connected: 'border-sci-green/30 bg-sci-green/10 text-sci-green',
  disconnected: 'border-white/20 bg-white/5 text-sci-dim',
  failed: 'border-sci-red/30 bg-sci-red/10 text-sci-red',
};

const statusLabels: Record<ConnectionSession['status'], string> = {
  connecting: '连接中',
  connected: '进行中',
  disconnected: '已断开',
  failed: '连接失败',
};

export function ConnectionSessionList({
  sessions,
  page,
  total,
  isLoading,
  onPageChange,
  onSelect,
}: ConnectionSessionListProps) {
  const totalPages = Math.max(1, Math.ceil(total / 100));

  return (
    <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
      {sessions.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-sci-dim">
          <ScrollText size={36} className="mb-3 opacity-35" />
          <span className="text-xs">
            {isLoading ? '正在载入连接历史' : '暂无连接历史'}
          </span>
        </div>
      ) : (
        <div className="min-w-[960px] divide-y divide-white/5">
          <div className="grid grid-cols-[minmax(170px,1.2fr)_130px_105px_170px_170px_90px_70px] gap-3 border-b border-white/10 bg-black/20 px-5 py-2 font-mono text-[10px] text-sci-dim">
            <span>设备</span>
            <span>IP 地址</span>
            <span>登录用户</span>
            <span>连接时间</span>
            <span>断开时间</span>
            <span>持续时长</span>
            <span className="text-right">详情</span>
          </div>
          {sessions.map((session) => (
            <article
              key={session.id}
              className="grid grid-cols-[minmax(170px,1.2fr)_130px_105px_170px_170px_90px_70px] items-center gap-3 px-5 py-3 text-[11px] text-sci-text/90 hover:bg-white/3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sci-text">
                  {session.deviceName}
                </p>
                <span className={`mt-1 inline-flex border px-1.5 py-0.5 font-mono text-[9px] ${statusStyles[session.status]}`}>
                  {statusLabels[session.status]}
                </span>
              </div>
              <span className="font-mono text-sci-text">{session.serverIp}</span>
              <span className="font-mono text-sci-text">{session.username}</span>
              <time className="font-mono text-[10px] text-sci-dim">
                {formatDateTime(session.connectedAt ?? session.startedAt)}
              </time>
              <div className="min-w-0">
                <time className="font-mono text-[10px] text-sci-dim">
                  {session.endedAt ? formatDateTime(session.endedAt) : '仍在连接'}
                </time>
                {session.endReason && (
                  <p className="mt-1 truncate text-[10px] text-sci-red/80" title={session.endReason}>
                    {session.endReason}
                  </p>
                )}
              </div>
              <span className="font-mono text-[10px] text-sci-dim">
                {formatDuration(session.connectedAt ?? session.startedAt, session.endedAt)}
              </span>
              <button
                type="button"
                onClick={() => onSelect(session)}
                className="ml-auto flex h-8 w-8 items-center justify-center border border-white/10 text-sci-dim transition-colors hover:border-sci-cyan/40 hover:text-sci-cyan"
                title="查看该连接的详细日志"
              >
                <Eye size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-white/10 bg-sci-obsidian/90 px-5 py-3 backdrop-blur-sm">
        <span className="font-mono text-[10px] text-sci-dim">
          共 {total} 次连接，每页 100 条
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="flex h-8 w-8 items-center justify-center border border-white/10 text-sci-dim transition-colors hover:border-sci-cyan/40 hover:text-sci-cyan disabled:cursor-not-allowed disabled:opacity-35"
            title="上一页"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-20 text-center font-mono text-[10px] text-sci-text">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="flex h-8 w-8 items-center justify-center border border-white/10 text-sci-dim transition-colors hover:border-sci-cyan/40 hover:text-sci-cyan disabled:cursor-not-allowed disabled:opacity-35"
            title="下一页"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </footer>
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDuration(startAt: string, endAt?: string): string {
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return '--';
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}小时${minutes}分`;
  if (minutes) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}
