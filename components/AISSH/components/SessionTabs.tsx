import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Terminal as TerminalIcon, FileCode } from "lucide-react";
import { useSSHStore } from "../store/useSSHStore";
import { sshManager } from "../services/sshService";

export const SessionTabs: React.FC = () => {
  const {
    servers,
    activeSessionId,
    openSessions,
    tempSessions,
    setActiveSessionId,
    closeSession,
    closeLeft,
    closeRight,
    createTempSessionFrom,
    updateConnectionState,
    addLog,
    setOpenSessions,
  } = useSSHStore();

  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!menu) return;
      if (e.button !== 0) return;
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setMenu(null);
    };
    const handleWheel = (e: WheelEvent) => {
      if (containerRef.current) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          containerRef.current.scrollLeft += e.deltaY;
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }

    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("scroll", () => setMenu(null), true);
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("scroll", () => setMenu(null), true);
    };
  }, [menu]);

  if (openSessions.length === 0) return null;

  const getRealId = (id: string) => id.split("#")[0];
  const isFileSession = (id: string) => id.endsWith("#files");

  return (
    <div
      ref={containerRef}
      className="flex flex-nowrap bg-sci-panel/60 backdrop-blur-md p-1 gap-1 overflow-x-auto no-scrollbar border-b border-white/5 flex-1 select-none relative"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {openSessions.map((id) => {
        const realId = getRealId(id);
        const server = servers.find((s) => s.id === realId);
        const temp = tempSessions[realId];
        const isFile = isFileSession(id);
        const name = server?.name || temp?.name || "Unknown";
        const displayName = isFile ? `${name} (Files)` : name;

        return (
          <div
            key={id}
            onClick={() => setActiveSessionId(id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ id, x: e.clientX, y: e.clientY });
            }}
            style={{ WebkitAppRegion: "no-drag" } as any}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-none cursor-pointer min-w-[120px] max-w-[200px] text-[11px] font-bold uppercase tracking-wider transition-all ${activeSessionId === id ? "bg-sci-cyan/10 text-sci-cyan border-t border-sci-cyan shadow-[0_0_10px_rgba(0,243,255,0.1)]" : "hover:bg-white/5 text-sci-dim"}`}
          >
            {isFile ? (
              <FileCode
                size={12}
                className={
                  activeSessionId === id ? "text-sci-cyan" : "text-sci-dim"
                }
              />
            ) : (
              <TerminalIcon
                size={12}
                className={
                  activeSessionId === id ? "text-sci-cyan" : "text-sci-dim"
                }
              />
            )}
            <span className="truncate flex-1">{displayName}</span>
            <X
              size={12}
              className="hover:text-sci-red transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (!isFile) {
                  sshManager.sendInput("\r\n", realId);
                  sshManager.disconnect?.(realId);
                }
                closeSession(id);
              }}
            />
          </div>
        );
      })}

      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] bg-sci-obsidian border border-white/10 shadow-2xl rounded-none min-w-[160px]"
            style={{
              left: Math.max(menu.x - 4, 4),
              top: Math.max(menu.y + 8, 4),
            }}
          >
            <div className="flex flex-col py-1">
              <button
                className="px-3 py-1.5 text-[11px] text-sci-text hover:bg-white/10 text-left"
                onClick={() => {
                  const id = menu.id;
                  const realId = getRealId(id);
                  if (!isFileSession(id)) {
                    sshManager.sendInput("\r\n", realId);
                    sshManager.disconnect?.(realId);
                  }
                  closeSession(id);
                  setMenu(null);
                }}
              >
                关闭
              </button>
              <button
                className="px-3 py-1.5 text-[11px] text-sci-text hover:bg-white/10 text-left"
                onClick={() => {
                  const id = menu.id;
                  const idx = openSessions.indexOf(id);
                  if (idx > 0) {
                    const toClose = openSessions.slice(0, idx);
                    toClose.forEach((sid) => {
                      if (!isFileSession(sid))
                        sshManager.disconnect?.(getRealId(sid));
                    });
                  }
                  closeLeft(id);
                  setMenu(null);
                }}
              >
                关闭左边
              </button>
              <button
                className="px-3 py-1.5 text-[11px] text-sci-text hover:bg-white/10 text-left"
                onClick={() => {
                  const id = menu.id;
                  const idx = openSessions.indexOf(id);
                  if (idx !== -1) {
                    const toClose = openSessions.slice(idx + 1);
                    toClose.forEach((sid) => {
                      if (!isFileSession(sid))
                        sshManager.disconnect?.(getRealId(sid));
                    });
                  }
                  closeRight(id);
                  setMenu(null);
                }}
              >
                关闭右边
              </button>
              <div className="h-px bg-white/10 my-1"></div>
              {!isFileSession(menu.id) && (
                <>
                  <button
                    className="px-3 py-1.5 text-[11px] text-sci-text hover:bg-white/10 text-left"
                    onClick={() => {
                      const baseId = menu.id;
                      createTempSessionFrom(baseId);
                      const state = useSSHStore.getState();
                      const newId = state.activeSessionId as string;
                      const temp = state.tempSessions[newId];
                      if (temp && temp.password) {
                        updateConnectionState(newId, "connecting");
                        void sshManager
                          .connect(temp.baseId, newId)
                          .catch(() => undefined);
                      } else {
                        addLog({
                          timestamp: new Date().toLocaleTimeString(),
                          type: "info",
                          content: `已创建临时连接，但缺少密码，无法自动连接。`,
                          serverId: newId,
                        });
                      }
                      setMenu(null);
                    }}
                  >
                    复刻一个连接
                  </button>
                  <button
                    className="px-3 py-1.5 text-[11px] text-sci-text hover:bg-white/10 text-left"
                    onClick={() => {
                      const id = menu.id;
                      const realId = getRealId(id);
                      const server = servers.find((s) => s.id === realId);
                      const temp = tempSessions[realId];
                      if (!server && !temp) {
                        setMenu(null);
                        return;
                      }
                      if (!openSessions.includes(id))
                        setOpenSessions((prev) => [...prev, id]);
                      setActiveSessionId(id);
                      if (server?.hasCredential || temp) {
                        updateConnectionState(id, "connecting");
                        void sshManager
                          .connect(server?.id ?? temp?.baseId ?? realId, id)
                          .catch(() => undefined);
                      } else {
                        addLog({
                          timestamp: new Date().toLocaleTimeString(),
                          type: "info",
                          content: `该连接缺少密码，无法直接重新连接，请在左侧服务器树选择后输入密码。`,
                          serverId: id,
                        });
                      }
                      setMenu(null);
                    }}
                  >
                    重新连接
                  </button>
                  <div className="h-px bg-white/10 my-1"></div>
                </>
              )}
              <button
                className="px-3 py-1.5 text-[11px] text-sci-text hover:bg-white/10 text-left"
                onClick={() => {
                  const id = menu.id;
                  const toClose = openSessions.filter((s) => s !== id);
                  toClose.forEach((sid) => {
                    if (!isFileSession(sid))
                      sshManager.disconnect?.(getRealId(sid));
                  });
                  setOpenSessions([id]);
                  setActiveSessionId(id);
                  setMenu(null);
                }}
              >
                关闭其他
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
