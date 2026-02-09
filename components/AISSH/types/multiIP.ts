import { SelectedIP } from '../components/IPSelectorInput';

export type ExecutionMode = 'parallel' | 'sequential' | 'adaptive';

export interface ServerExecutionResult {
  serverId: string;
  serverName: string;
  ip: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  output: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  exitCode?: number;
}

export interface ExecutionStep {
  stepNumber: number;
  command: string;
  description: string;
  serverResults: ServerExecutionResult[];
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'error' | 'waiting_decision';
  aiDecision?: AIDecision;
}

export interface AIDecision {
  reasoning: string;
  nextAction: 'continue' | 'retry' | 'skip' | 'abort' | 'ask_user';
  targetServers?: string[];
  modifiedCommand?: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  suggestions?: string[];
}

export interface MultiIPOperation {
  id: string;
  taskName: string;
  taskDescription: string;
  targetServers: SelectedIP[];
  executionMode: ExecutionMode;
  status: 'preparing' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled';
  
  // 执行步骤
  steps: ExecutionStep[];
  currentStepIndex: number;
  
  // 时间记录
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // 统计
  stats: {
    totalServers: number;
    completedServers: number;
    failedServers: number;
    totalDuration: number;
  };
  
  // 总结报告
  summary?: string;
  recommendations?: string[];
}

export interface MultiIPOperationState {
  operations: MultiIPOperation[];
  activeOperationId: string | null;
  
  // 操作方法
  createOperation: (taskName: string, description: string, servers: SelectedIP[], mode: ExecutionMode) => string;
  startOperation: (operationId: string) => void;
  pauseOperation: (operationId: string) => void;
  resumeOperation: (operationId: string) => void;
  cancelOperation: (operationId: string) => void;
  completeOperation: (operationId: string, summary?: string, recommendations?: string[]) => void;
  deleteOperation: (operationId: string) => void;
  clearAllOperations: () => void;
  
  // 步骤更新
  addStep: (operationId: string, command: string, description: string) => void;
  updateStepStatus: (operationId: string, stepNumber: number, status: ExecutionStep['status']) => void;
  updateServerResult: (operationId: string, stepNumber: number, serverId: string, result: Partial<ServerExecutionResult>) => void;
  setAIDecision: (operationId: string, stepNumber: number, decision: AIDecision) => void;
  confirmDecision: (operationId: string, stepNumber: number, confirmed: boolean) => void;
  
  // 查询
  getOperation: (operationId: string) => MultiIPOperation | undefined;
  getActiveOperation: () => MultiIPOperation | undefined;
}
