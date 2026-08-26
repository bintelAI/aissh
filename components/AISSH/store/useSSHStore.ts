import { create } from "zustand";
import {
  Server,
  Folder,
  LogEntry,
  CommandTemplate,
  BatchResult,
  ConnectionDetails,
} from "../types";
import {
  appendOperationLog,
  clearOperationLogs,
} from "../services/operationLogService";

interface SSHState {
  servers: Server[];
  folders: Folder[];
  activeSessionId: string | null;
  openSessions: string[];
  logs: LogEntry[];
  connectionStatus: Record<
    string,
    "connected" | "disconnected" | "connecting" | "error"
  >;
  connectionDetails: Record<string, ConnectionDetails>;
  failureCounts: Record<string, number>;
  commandHistory: string[];
  commandTemplates: CommandTemplate[];
  batchResults: BatchResult[];
  tempSessions: Record<
    string,
    {
      name: string;
      ip: string;
      username: string;
      password?: string;
      baseId: string;
    }
  >;
  isAIPanelOpen: boolean;

  // Actions
  setServers: (
    servers: Server[] | ((prev: Server[] | any) => Server[]),
  ) => void;
  setFolders: (
    folders: Folder[] | ((prev: Folder[] | any) => Folder[]),
  ) => void;
  setActiveSessionId: (id: string | null) => void;
  setOpenSessions: (
    sessions: string[] | ((prev: string[] | any) => string[]),
  ) => void;
  setLogs: (
    logs: LogEntry[] | ((prev: LogEntry[] | any) => LogEntry[]),
  ) => void;
  setConnectionStatus: (
    status:
      | Record<string, "connected" | "disconnected" | "connecting" | "error">
      | ((
          prev: Record<
            string,
            "connected" | "disconnected" | "connecting" | "error"
          >,
        ) => Record<
          string,
          "connected" | "disconnected" | "connecting" | "error"
        >),
  ) => void;
  resetFailureCount: (serverId: string) => void;
  incrementFailureCount: (serverId: string) => void;
  addCommandToHistory: (command: string) => void;
  setCommandHistory: (history: string[]) => void;
  setIsAIPanelOpen: (isOpen: boolean) => void;

  // Command Templates Actions
  addCommandTemplate: (template: Omit<CommandTemplate, "id">) => void;
  setCommandTemplates: (templates: CommandTemplate[]) => void;
  updateCommandTemplate: (
    id: string,
    template: Partial<CommandTemplate>,
  ) => void;
  deleteCommandTemplate: (id: string) => void;

  // Batch Results Actions
  addBatchResult: (result: BatchResult) => void;
  clearBatchResults: () => void;

  // Helper Actions
  addServer: (server: Omit<Server, "id" | "status">) => void;
  updateServer: (id: string, data: Partial<Server>) => void;
  deleteServer: (id: string) => void;
  addFolder: (name: string, parentId: string | null) => void;
  updateFolder: (id: string, data: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  closeSession: (id: string) => void;
  closeLeft: (id: string) => void;
  closeRight: (id: string) => void;
  createTempSessionFrom: (id: string) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: (serverId?: string) => void;
  updateConnectionStatus: (
    serverId: string,
    status: "connected" | "disconnected" | "connecting" | "error",
  ) => void;
  updateConnectionState: (
    serverId: string,
    status: "connected" | "disconnected" | "connecting" | "error",
    details?: ConnectionDetails,
  ) => void;
  hydrateConfiguration: (
    data: Pick<
      SSHState,
      "servers" | "folders" | "commandHistory" | "commandTemplates"
    >,
  ) => void;
}

const initialTemplates: CommandTemplate[] = [
  {
    id: "t1",
    name: "System Info",
    command: "uname -a && uptime",
    description: "Get system kernel and uptime",
  },
  {
    id: "t2",
    name: "Disk Usage",
    command: "df -h",
    description: "Check disk space usage",
  },
  {
    id: "t3",
    name: "Memory Usage",
    command: "free -m",
    description: "Check memory usage",
  },
];

export const useSSHStore = create<SSHState>((set) => ({
  servers: [],
  folders: [],
  activeSessionId: null,
  openSessions: [],
  logs: [],
  connectionStatus: {},
  connectionDetails: {},
  failureCounts: {},
  commandHistory: [],
  commandTemplates: initialTemplates,
  batchResults: [],
  tempSessions: {},
  isAIPanelOpen: true,

  setServers: (servers) =>
    set((state) => {
      const newServers =
        typeof servers === "function" ? servers(state.servers) : servers;
      return { servers: newServers };
    }),

  setFolders: (folders) =>
    set((state) => {
      const newFolders =
        typeof folders === "function" ? folders(state.folders) : folders;
      return { folders: newFolders };
    }),

  setActiveSessionId: (id) => set({ activeSessionId: id }),

  setOpenSessions: (sessions) =>
    set((state) => ({
      openSessions:
        typeof sessions === "function"
          ? sessions(state.openSessions)
          : sessions,
    })),

  setLogs: (logs) =>
    set((state) => ({
      logs: typeof logs === "function" ? logs(state.logs) : logs,
    })),

  setConnectionStatus: (status) =>
    set((state) => ({
      connectionStatus:
        typeof status === "function" ? status(state.connectionStatus) : status,
    })),

  resetFailureCount: (serverId) =>
    set((state) => ({
      failureCounts: { ...state.failureCounts, [serverId]: 0 },
    })),

  incrementFailureCount: (serverId) =>
    set((state) => ({
      failureCounts: {
        ...state.failureCounts,
        [serverId]: (state.failureCounts[serverId] || 0) + 1,
      },
    })),

  addCommandToHistory: (command) =>
    set((state) => {
      const newHistory = [
        command,
        ...state.commandHistory.filter((c) => c !== command),
      ].slice(0, 100);
      return { commandHistory: newHistory };
    }),

  setCommandHistory: (history) =>
    set(() => {
      return { commandHistory: history };
    }),

  setIsAIPanelOpen: (isOpen) => set({ isAIPanelOpen: isOpen }),

  addCommandTemplate: (template) =>
    set((state) => {
      const newTemplate = { ...template, id: Date.now().toString() };
      const newTemplates = [...state.commandTemplates, newTemplate];
      return { commandTemplates: newTemplates };
    }),

  setCommandTemplates: (templates) =>
    set(() => {
      return { commandTemplates: templates };
    }),

  updateCommandTemplate: (id, data) =>
    set((state) => {
      const newTemplates = state.commandTemplates.map((t) =>
        t.id === id ? { ...t, ...data } : t,
      );
      return { commandTemplates: newTemplates };
    }),

  deleteCommandTemplate: (id) =>
    set((state) => {
      const newTemplates = state.commandTemplates.filter((t) => t.id !== id);
      return { commandTemplates: newTemplates };
    }),

  addBatchResult: (result) =>
    set((state) => ({
      batchResults: [...state.batchResults, result],
    })),

  clearBatchResults: () => set({ batchResults: [] }),

  addServer: (serverData) =>
    set((state) => {
      const newServer: Server = {
        ...serverData,
        id: Date.now().toString(),
        status: "disconnected",
      };
      const newServers = [...state.servers, newServer];
      return { servers: newServers };
    }),

  updateServer: (id, data) =>
    set((state) => {
      const newServers = state.servers.map((s) =>
        s.id === id ? { ...s, ...data } : s,
      );
      return { servers: newServers };
    }),

  deleteServer: (id) =>
    set((state) => {
      const newServers = state.servers.filter((s) => s.id !== id);
      return { servers: newServers };
    }),

  addFolder: (name, parentId) =>
    set((state) => {
      const newFolder: Folder = {
        id: Date.now().toString(),
        name,
        parentId,
      };
      const newFolders = [...state.folders, newFolder];
      return { folders: newFolders };
    }),

  updateFolder: (id, data) =>
    set((state) => {
      const newFolders = state.folders.map((f) =>
        f.id === id ? { ...f, ...data } : f,
      );
      return { folders: newFolders };
    }),

  deleteFolder: (id) =>
    set((state) => {
      const newFolders = state.folders.filter((f) => f.id !== id);
      return { folders: newFolders };
    }),

  closeSession: (id) =>
    set((state) => {
      const newOpenSessions = state.openSessions.filter((s) => s !== id);
      let newActiveSessionId = state.activeSessionId;
      if (state.activeSessionId === id) {
        newActiveSessionId =
          newOpenSessions.length > 0
            ? newOpenSessions[newOpenSessions.length - 1]
            : null;
      }
      const { [id]: _, ...restTemp } = state.tempSessions;
      return {
        openSessions: newOpenSessions,
        activeSessionId: newActiveSessionId,
        tempSessions: restTemp,
      };
    }),

  closeLeft: (id) =>
    set((state) => {
      const idx = state.openSessions.indexOf(id);
      if (idx <= 0) return {};
      const keep = state.openSessions.slice(idx);
      const toClose = state.openSessions.slice(0, idx);
      const restTemp = Object.fromEntries(
        Object.entries(state.tempSessions).filter(
          ([k]) => !toClose.includes(k),
        ),
      );
      return {
        openSessions: keep,
        activeSessionId: id,
        tempSessions: restTemp,
      };
    }),

  closeRight: (id) =>
    set((state) => {
      const idx = state.openSessions.indexOf(id);
      if (idx === -1) return {};
      const keep = state.openSessions.slice(0, idx + 1);
      const toClose = state.openSessions.slice(idx + 1);
      const restTemp = Object.fromEntries(
        Object.entries(state.tempSessions).filter(
          ([k]) => !toClose.includes(k),
        ),
      );
      return {
        openSessions: keep,
        activeSessionId: id,
        tempSessions: restTemp,
      };
    }),

  createTempSessionFrom: (id) =>
    set((state) => {
      const baseId = state.tempSessions[id]?.baseId || id;
      const src = state.servers.find((s) => s.id === baseId);
      if (!src) return {};
      const newId = `tmp-${Date.now()}`;
      const temp = {
        name: `${src.name} 副本`,
        ip: src.ip,
        username: src.username,
        password: src.password,
        baseId,
      };
      const openSessions = [...state.openSessions, newId];
      return {
        tempSessions: { ...state.tempSessions, [newId]: temp },
        openSessions,
        activeSessionId: newId,
        connectionStatus: {
          ...state.connectionStatus,
          [newId]: "disconnected",
        },
        failureCounts: { ...state.failureCounts, [newId]: 0 },
      };
    }),

  addLog: (log) => {
    set((state) => ({ logs: [...state.logs, log] }));
    void appendOperationLog(log).catch((error) => {
      console.error("Failed to persist operation log:", error);
    });
  },

  clearLogs: (serverId) => {
    set((state) => ({
      logs: serverId
        ? state.logs.filter((log) => log.serverId !== serverId)
        : [],
    }));
    void clearOperationLogs(serverId).catch((error) => {
      console.error("Failed to clear persisted operation logs:", error);
    });
  },

  updateConnectionStatus: (serverId, status) =>
    set((state) => ({
      connectionStatus: {
        ...state.connectionStatus,
        [serverId]: status,
      },
      // Also update the server status in the servers array for persistence/ServerTree
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, status } : s,
      ),
    })),

  updateConnectionState: (serverId, status, details = {}) =>
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [serverId]: status },
      connectionDetails: {
        ...state.connectionDetails,
        [serverId]: status === "connected" ? {} : details,
      },
      servers: state.servers.map((server) =>
        server.id === serverId ? { ...server, status } : server,
      ),
    })),

  hydrateConfiguration: ({
    servers,
    folders,
    commandHistory,
    commandTemplates,
  }) =>
    set({
      servers: servers.map((server) => ({
        ...server,
        password: undefined,
        status: "disconnected",
      })),
      folders,
      commandHistory,
      commandTemplates,
    }),
}));
