import { useMemo, useState } from 'react';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Search,
  ScrollText,
} from 'lucide-react';
import type { ConnectionSession, LogEntry, Server } from '../types';
import {
  filterOperationLogs,
  paginateOperationLogs,
  resolveLogIp,
} from '../services/logHistory';

interface ConnectionSessionDetailProps {
  session: ConnectionSession;
  logs: LogEntry[];
  servers: Server[];
  isLoading: boolean;
  onBack: () => void;
}

const typeStyles: Record<LogEntry['type'], string> = {
  info: 'text-sci-cyan border-sci-cyan/30 bg-sci-cyan/10',
  error: 'text-sci-red border-sci-red/30 bg-sci-red/10',
  warning: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/10',
  command: 'text-sci-violet border-sci-violet/30 bg-sci-violet/10',
  'ai-action': 'text-sci-green border-sci-green/30 bg-sci-green/10',
  'ai-thought': 'text-sci-text border-sci-text/30 bg-sci-text/10',
};

export function ConnectionSessionDetail({
  session,
  logs,
  servers,
  isLoading,
  onBack,
}: ConnectionSessionDetailProps) {
  const [commandQuery, setCommandQuery] = useState('');
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const filteredLogs = useMemo(
    () =>
      filterOperationLogs(logs, servers, { commandQuery, alertsOnly })
        .slice()
        .reverse(),
    [alertsOnly, commandQuery, logs, servers],
  );
  const pagination = useMemo(
    () => paginateOperationLogs(filteredLogs, page),
    [filteredLogs, page],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center border border-white/10 text-sci-dim transition-colors hover:border-sci-cyan/40 hover:text-sci-cyan"
          title="返回连接历史"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold tracking-widest text-sci-text">
            {session.deviceName} 连接详情
          </h2>
          <p className="mt-1 font-mono text-[10px] text-sci-dim">
            {session.serverIp} | {session.username} | {formatDateTime(session.connectedAt ?? session.startedAt)} 至 {session.endedAt ? formatDateTime(session.endedAt) : '当前'}
          </p>
        </div>
      </header>

      <div className="grid gap-3 border-b border-white/10 bg-black/15 px-5 py-3 md:grid-cols-2">
        <label className="min-w-0 text-[10px] text-sci-dim">
          <span className="mb-1 flex items-center gap-1"><Search size={12} />命令筛选</span>
          <input
            value={commandQuery}
            onChange={(event) => {
              setCommandQuery(event.target.value);
              setPage(1);
            }}
            placeholder="筛选命令内容"
            className="w-full border border-white/10 bg-black/50 px-2 py-2 text-xs text-sci-text outline-none placeholder:text-sci-dim/60 focus:border-sci-cyan/40"
          />
        </label>
        <label className="min-w-0 text-[10px] text-sci-dim">
          <span className="mb-1 flex items-center gap-1"><BellRing size={12} />告警筛选</span>
          <select
            value={alertsOnly ? 'alerts' : ''}
            onChange={(event) => {
              setAlertsOnly(event.target.value === 'alerts');
              setPage(1);
            }}
            className="w-full border border-white/10 bg-black/50 px-2 py-2 text-xs text-sci-text outline-none focus:border-sci-red/40"
          >
            <option value="">全部日志</option>
            <option value="alerts">告警（error / warning / info）</option>
          </select>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-sci-dim">
            正在载入该连接的详细日志
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-sci-dim">
            <ScrollText size={36} className="mb-3 opacity-35" />
            <span className="text-xs">该连接时间段内没有匹配日志</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {pagination.items.map((log, index) => (
              <article key={`${log.createdAt ?? log.timestamp}-${index}`} className="grid gap-2 px-5 py-3 md:grid-cols-[170px_110px_88px_minmax(0,1fr)] md:items-start">
                <time className="font-mono text-[10px] text-sci-dim">
                  {formatDateTime(log.createdAt ?? log.timestamp)}
                </time>
                <span className="font-mono text-[11px] text-sci-text">
                  {resolveLogIp(log, servers)}
                </span>
                <span className={`w-fit border px-1.5 py-0.5 font-mono text-[9px] ${typeStyles[log.type]}`}>
                  {log.type}
                </span>
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-sci-text/90">
                  {log.content}
                </pre>
              </article>
            ))}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-white/10 bg-black/15 px-5 py-3">
        <span className="font-mono text-[10px] text-sci-dim">
          {filteredLogs.length} 条会话日志，每页 100 条
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
            className="flex h-8 w-8 items-center justify-center border border-white/10 text-sci-dim disabled:cursor-not-allowed disabled:opacity-35"
            title="上一页"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-20 text-center font-mono text-[10px] text-sci-text">
            {pagination.currentPage} / {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
            className="flex h-8 w-8 items-center justify-center border border-white/10 text-sci-dim disabled:cursor-not-allowed disabled:opacity-35"
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
