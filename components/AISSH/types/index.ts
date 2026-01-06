
export interface Server {
  id: string;
  name: string;
  ip: string;
  username: string;
  password?: string;
  port: number;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  parentId: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'error' | 'warning' | 'command' | 'ai-action' | 'ai-thought';
  content: string;
  serverId: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  isThought?: boolean; 
  isPendingConfirmation?: boolean;
  commandToExecute?: string;
  confirmationStatus?: 'pending' | 'confirmed' | 'cancelled';
  isDone?: boolean;      // 新增：标志任务是否完成
  summary?: string;     // 新增：存储原始总结报告用于复制
}

export interface ChatSession {
  id: string;
  serverId?: string; // 关联的服务器ID (IP上下文)
  title: string;
  messages: ChatMessage[];
  mode: 'chat' | 'action';
  createdAt: Date;
}

export interface AgentConfig {
  maxAttempts: number;
  customPrompt: string;
  safeMode: boolean; 
  model: string;
  temperature: number;
  autoSyncTerminal: boolean;
  // Custom model configuration
  useCustomModel?: boolean;
  customUrl?: string;
  customKey?: string;
  customModelName?: string;
  maxMemoryMessages?: number; // AI 记忆的消息轮数
}

export interface AIChatProps {
  sessionId: string;
  onSendMessage: (message: string) => void;
}

export interface AIChatPanelProps {
  onClose: () => void;
}

export interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddServer: (server: Omit<Server, 'id' | 'status'>) => void;
}

export interface ServerTreeProps {
  servers: Server[];
  folders: Folder[];
  activeServerId: string | null;
  onSelectServer: (id: string) => void;
  onAddServer: (parentId: string | null) => void;
  onEditServer: (server: Server) => void;
  onDeleteServer: (id: string) => void;
  onAddFolder: (parentId: string | null) => void;
  onEditFolder: (id: string, data: Partial<Folder>) => void;
  onDeleteFolder: (id: string) => void;
  onMove: (type: 'server' | 'folder', id: string, newParentId: string | null) => void;
}

export interface CommandTemplate {
  id: string;
  name: string;
  command: string;
  description?: string;
  tags?: string[];
}

export interface BatchResult {
  serverId: string;
  serverName: string;
  command: string;
  output: string;
  exitCode?: number;
  timestamp: string;
}

export interface TerminalProps {
  serverId: string;
  onCommandExecuted?: (command: string, output: string) => void;
}

export type HighlightColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'violet'
  | 'white'
  | string;

export interface HighlightRule {
  id: string;
  pattern: string;
  color: HighlightColor;
  remark?: string;
}

export interface PromptProfile {
  id: string;
  name: string;
  deviceType: string;
  prompt: string;
  rules: HighlightRule[];
}

export interface PromptConfigState {
  profiles: PromptProfile[];
  selectedProfileId: string | null;
}
