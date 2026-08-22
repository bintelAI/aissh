import React, { useEffect, useRef, useState } from "react";
import { Activity, ChevronRight, Radio, ShieldAlert, Terminal, WifiOff } from "lucide-react";

type LogTone = "cyan" | "dim" | "red" | "green";

interface BootLog {
  text: string;
  tone: LogTone;
}

const BOOT_LOGS: BootLog[] = [
  { text: "kernel bridge ................. READY", tone: "green" },
  { text: "local credential vault ........ ARMED", tone: "green" },
  { text: "ssh transport ................. STANDBY", tone: "cyan" },
  { text: "target handshake .............. NO HOST", tone: "red" },
  { text: "awaiting operator target ...... 127.0.0.1", tone: "dim" },
];

const toneClass: Record<LogTone, string> = {
  cyan: "text-sci-cyan",
  dim: "text-sci-dim",
  red: "text-sci-red",
  green: "text-sci-green",
};

const MatrixRain: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let columns: number[] = [];
    const glyphs = "01アイウエオカキクケコSSH$#<>";

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      columns = Array.from({ length: Math.ceil(width / 24) }, () =>
        Math.random() * (height / 18),
      );
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      context.fillStyle = "rgba(3, 6, 9, 0.13)";
      context.fillRect(0, 0, width, height);
      context.font = "12px monospace";

      columns.forEach((y, index) => {
        const x = index * 24;
        context.fillStyle = index % 7 === 0 ? "rgba(0, 243, 255, 0.28)" : "rgba(10, 255, 0, 0.14)";
        context.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], x, y * 18);
        columns[index] = y * 18 > height && Math.random() > 0.975 ? 0 : y + 0.45;
      });
    };

    const interval = window.setInterval(draw, 55);
    return () => {
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-60" aria-hidden="true" />;
};

const BootLogFeed: React.FC = () => {
  const [visibleLogs, setVisibleLogs] = useState<BootLog[]>(BOOT_LOGS.slice(0, 2));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisibleLogs((current) => {
        if (current.length >= BOOT_LOGS.length) return current;
        const next = BOOT_LOGS[current.length];
        return next ? [...current, next] : current;
      });
    }, 420);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-1 font-mono text-[10px] leading-4 sm:text-xs">
      {visibleLogs.map((log) => (
        <div key={log.text} className={toneClass[log.tone]}>
          <span className="mr-2 text-sci-dim/60">[{"00:00:00"}]</span>
          {log.text}
        </div>
      ))}
    </div>
  );
};

export const HackerStandby: React.FC = () => {
  return (
    <section className="relative flex min-h-0 flex-1 overflow-hidden bg-[#030507] text-sci-text" aria-label="SSH 黑客待机模式">
      <MatrixRain />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(3,5,7,0)_50%,rgba(0,0,0,0.18)_50%)] bg-[length:100%_4px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.78)_100%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-8 sm:px-10">
        <div className="mb-4 flex items-center justify-between border-b border-sci-cyan/20 pb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-sci-dim sm:text-xs">
          <span className="flex items-center gap-2 text-sci-cyan">
            <Terminal size={14} />
            AISSH // operator console
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sci-red" />
            link offline
          </span>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_230px] xl:items-center">
          <div>
            <div className="mb-5 flex items-center gap-3 font-mono text-xs text-sci-red animate-flicker sm:text-sm">
              <WifiOff size={16} />
              <span className="neon-text-red">NO ACTIVE TARGET DETECTED</span>
              <span className="h-4 w-px bg-sci-red/50" />
              <span className="text-sci-dim">SESSION 00</span>
            </div>

            <h1 className="max-w-2xl font-mono text-3xl font-semibold uppercase leading-tight tracking-[0.08em] text-sci-text text-glow sm:text-5xl">
              <span className="neon-text-cyan">&gt;_</span> system standby
            </h1>
            <p className="mt-3 max-w-xl font-mono text-xs leading-6 text-sci-dim sm:text-sm">
              Secure shell is ready. Select a node from the server tree to begin the handshake.
            </p>

            <div className="mt-7 border-l-2 border-sci-cyan/40 bg-black/35 px-4 py-3 sm:max-w-xl">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-sci-cyan">
                <Radio size={13} />
                boot sequence / local channel
              </div>
              <BootLogFeed />
              <div className="mt-3 flex items-center gap-2 font-mono text-xs text-sci-cyan">
                <ChevronRight size={14} />
                <span>select target</span>
                <span className="h-3.5 w-1.5 animate-pulse bg-sci-cyan" />
              </div>
            </div>
          </div>

          <aside className="border border-sci-red/25 bg-black/45 p-4 font-mono text-[10px] uppercase tracking-[0.14em] text-sci-dim">
            <div className="mb-4 flex items-center gap-2 border-b border-sci-red/20 pb-3 text-sci-red">
              <ShieldAlert size={14} />
              target monitor
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span>transport</span>
                <span className="text-sci-dim">SSH / 22</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>encryption</span>
                <span className="text-sci-green">AES-256</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>operator</span>
                <span className="text-sci-cyan">LOCAL</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>status</span>
                <span className="text-sci-red">WAITING</span>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 border-t border-sci-red/20 pt-3 text-sci-dim">
              <Activity size={13} className="text-sci-cyan" />
              telemetry nominal
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
