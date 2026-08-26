import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import type { ConnectionSession, LogEntry, Server } from '../types';
import { loadConnectionSessions } from '../services/connectionSessionService';
import { loadOperationLogs } from '../services/operationLogService';
import { ConnectionSessionDetail } from './ConnectionSessionDetail';
import { ConnectionSessionList } from './ConnectionSessionList';

interface OperationLogViewProps {
  logs: LogEntry[];
  servers: Server[];
  isLoading: boolean;
  sessionVersion: number;
}

export function OperationLogView({
  logs,
  servers,
  isLoading,
  sessionVersion,
}: OperationLogViewProps) {
  const [sessions, setSessions] = useState<ConnectionSession[]>([]);
  const [sessionPage, setSessionPage] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ConnectionSession | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<LogEntry[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    let disposed = false;
    setIsSessionLoading(true);
    void loadConnectionSessions(sessionPage)
      .then((history) => {
        if (disposed) return;
        setSessions(history.items);
        setTotalSessions(history.total);
      })
      .catch((error) => {
        console.error('Failed to load connection sessions:', error);
      })
      .finally(() => {
        if (!disposed) setIsSessionLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [sessionPage, sessionVersion]);

  const openDetail = (session: ConnectionSession) => {
    setSelectedSession(session);
    setSelectedLogs([]);
    setIsDetailLoading(true);
    void loadOperationLogs(5_000, session.id)
      .then(setSelectedLogs)
      .catch((error) => {
        console.error('Failed to load connection session logs:', error);
      })
      .finally(() => setIsDetailLoading(false));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-sci-obsidian/20">
      {selectedSession ? (
        <ConnectionSessionDetail
          session={selectedSession}
          logs={selectedLogs}
          servers={servers}
          isLoading={isDetailLoading}
          onBack={() => setSelectedSession(null)}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-sci-cyan/35 bg-sci-cyan/10 text-sci-cyan">
                <ScrollText size={18} />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-widest text-sci-text">连接历史日志</h1>
                <p className="mt-1 text-[10px] text-sci-dim">每次连接从建立到中断为一条独立记录</p>
              </div>
            </div>
            <span className="border border-white/10 px-2 py-1 font-mono text-[10px] text-sci-dim">
              {isLoading || isSessionLoading ? '载入中' : `${totalSessions} 次连接`}
            </span>
          </header>
          <ConnectionSessionList
            sessions={sessions}
            page={sessionPage}
            total={totalSessions}
            isLoading={isSessionLoading}
            onPageChange={setSessionPage}
            onSelect={openDetail}
          />
        </>
      )}
    </section>
  );
}
