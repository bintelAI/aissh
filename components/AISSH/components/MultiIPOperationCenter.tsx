import React, { useState, useEffect } from 'react';
import { useMultiIPStore } from '../store/useMultiIPStore';
import { MultiIPOperation, ExecutionStep, ServerExecutionResult, ExecutionMode } from '../types/multiIP';
import { 
  Play, Pause, Square, Trash2, ChevronDown, ChevronRight, 
  Server, Clock, CheckCircle, XCircle, AlertCircle, 
  Cpu, Activity, Terminal, Sparkles, ArrowRight, FileDown, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MultiIPOperationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultiIPOperationCenter: React.FC<MultiIPOperationCenterProps> = ({
  isOpen,
  onClose
}) => {
  const {
    operations,
    activeOperationId,
    startOperation,
    pauseOperation,
    cancelOperation,
    deleteOperation,
    clearAllOperations
  } = useMultiIPStore();

  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // 导出操作为 Markdown
  const handleExportMarkdown = (operation: MultiIPOperation) => {
    const content = generateMarkdownReport(operation);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-ip-operation-${operation.id}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 生成 Markdown 报告
  const generateMarkdownReport = (operation: MultiIPOperation): string => {
    const lines: string[] = [];

    lines.push(`# 多 IP 操作执行报告`);
    lines.push('');
    lines.push(`## 任务信息`);
    lines.push('');
    lines.push(`- **任务名称**: ${operation.taskName}`);
    lines.push(`- **任务描述**: ${operation.taskDescription}`);
    lines.push(`- **执行模式**: ${getModeLabel(operation.executionMode)}`);
    lines.push(`- **目标服务器**: ${operation.targetServers.length} 台`);
    lines.push(`- **执行状态**: ${getStatusLabel(operation.status)}`);
    lines.push(`- **创建时间**: ${operation.createdAt.toLocaleString()}`);
    if (operation.startedAt) {
      lines.push(`- **开始时间**: ${operation.startedAt.toLocaleString()}`);
    }
    if (operation.completedAt) {
      lines.push(`- **完成时间**: ${operation.completedAt.toLocaleString()}`);
    }
    lines.push('');

    lines.push(`## 执行统计`);
    lines.push('');
    lines.push(`- **总服务器数**: ${operation.stats.totalServers}`);
    lines.push(`- **已完成**: ${operation.stats.completedServers}`);
    lines.push(`- **失败**: ${operation.stats.failedServers}`);
    lines.push('');

    lines.push(`## 目标服务器列表`);
    lines.push('');
    operation.targetServers.forEach((server, idx) => {
      lines.push(`${idx + 1}. ${server.name} (${server.ip})`);
    });
    lines.push('');

    lines.push(`## 执行步骤详情`);
    lines.push('');
    operation.steps.forEach((step, idx) => {
      lines.push(`### 步骤 ${step.stepNumber}: ${step.description}`);
      lines.push('');
      lines.push(`**命令**: \`\`\`bash`);
      lines.push(`${step.command}`);
      lines.push(`\`\`\``);
      lines.push('');
      lines.push(`**状态**: ${getStepStatusLabel(step.status)}`);
      lines.push(`**开始时间**: ${step.startTime.toLocaleString()}`);
      if (step.endTime) {
        lines.push(`**结束时间**: ${step.endTime.toLocaleString()}`);
      }
      lines.push('');

      lines.push(`**服务器执行结果**:`);
      lines.push('');
      step.serverResults.forEach(sr => {
        lines.push(`#### ${sr.serverName} (${sr.ip})`);
        lines.push(`- **状态**: ${getServerStatusLabel(sr.status)}`);
        if (sr.duration) {
          lines.push(`- **执行时长**: ${sr.duration}ms`);
        }
        if (sr.output) {
          lines.push(`- **输出**:`);
          lines.push('  ```');
          sr.output.split('\n').forEach(line => {
            lines.push(`  ${line}`);
          });
          lines.push('  ```');
        }
        if (sr.error) {
          lines.push(`- **错误**: ${sr.error}`);
        }
        lines.push('');
      });

      if (step.aiDecision) {
        lines.push(`**AI 决策**:`);
        lines.push(`- **决策理由**: ${step.aiDecision.reasoning}`);
        lines.push(`- **下一步行动**: ${step.aiDecision.nextAction}`);
        lines.push(`- **风险等级**: ${step.aiDecision.riskLevel}`);
        lines.push(`- **需要确认**: ${step.aiDecision.requiresConfirmation ? '是' : '否'}`);
        if (step.aiDecision.suggestions && step.aiDecision.suggestions.length > 0) {
          lines.push(`- **建议**:`);
          step.aiDecision.suggestions.forEach(suggestion => {
            lines.push(`  - ${suggestion}`);
          });
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    });

    if (operation.summary) {
      lines.push(`## 执行总结`);
      lines.push('');
      lines.push(operation.summary);
      lines.push('');
    }

    if (operation.recommendations && operation.recommendations.length > 0) {
      lines.push(`## 优化建议`);
      lines.push('');
      operation.recommendations.forEach((rec, idx) => {
        lines.push(`${idx + 1}. ${rec}`);
      });
      lines.push('');
    }

    lines.push(`---`);
    lines.push('');
    lines.push(`*报告生成时间: ${new Date().toLocaleString()}*`);

    return lines.join('\n');
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed': return '✅ 已完成';
      case 'error': return '❌ 执行出错';
      case 'cancelled': return '⚠️ 已取消';
      case 'running': return '🔄 执行中';
      case 'paused': return '⏸️ 已暂停';
      default: return '⏳ 准备中';
    }
  };

  const getStepStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed': return '✅ 已完成';
      case 'error': return '❌ 错误';
      case 'running': return '🔄 执行中';
      case 'waiting_decision': return '⏸️ 等待决策';
      default: return '⏳ 等待中';
    }
  };

  const getServerStatusLabel = (status: string): string => {
    switch (status) {
      case 'success': return '✅ 成功';
      case 'error': return '❌ 失败';
      case 'running': return '🔄 执行中';
      case 'skipped': return '⏭️ 跳过';
      default: return '⏳ 等待中';
    }
  };

  const activeOperation = operations.find(op => op.id === activeOperationId);
  const selectedOperation = operations.find(op => op.id === selectedOperationId) || activeOperation;

  useEffect(() => {
    if (activeOperationId && !selectedOperationId) {
      setSelectedOperationId(activeOperationId);
    }
  }, [activeOperationId]);

  const toggleStepExpansion = (stepNumber: number) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity size={16} className="text-sci-cyan animate-pulse" />;
      case 'completed': return <CheckCircle size={16} className="text-green-500" />;
      case 'error': return <XCircle size={16} className="text-red-500" />;
      case 'paused': return <Pause size={16} className="text-yellow-500" />;
      case 'waiting_decision': return <AlertCircle size={16} className="text-orange-500 animate-bounce" />;
      default: return <Clock size={16} className="text-sci-dim" />;
    }
  };

  const getServerStatusIcon = (status: ServerExecutionResult['status']) => {
    switch (status) {
      case 'running': return <div className="w-2 h-2 rounded-full bg-sci-cyan animate-pulse" />;
      case 'success': return <CheckCircle size={14} className="text-green-500" />;
      case 'error': return <XCircle size={14} className="text-red-500" />;
      case 'skipped': return <div className="w-2 h-2 rounded-full bg-sci-dim" />;
      default: return <div className="w-2 h-2 rounded-full bg-sci-dim/50" />;
    }
  };

  const getModeLabel = (mode: ExecutionMode) => {
    switch (mode) {
      case 'parallel': return '并行执行';
      case 'sequential': return '串行执行';
      case 'adaptive': return '自适应执行';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-[90vw] h-[85vh] bg-sci-obsidian border border-sci-cyan/30 
                   shadow-[0_0_50px_rgba(0,243,255,0.15)] flex flex-col clip-corner"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 
                        bg-gradient-to-r from-sci-cyan/10 to-sci-violet/10 
                        border-b border-sci-cyan/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sci-cyan/20 flex items-center justify-center
                            border border-sci-cyan/50 shadow-[0_0_15px_rgba(0,243,255,0.3)]">
              <Cpu size={20} className="text-sci-cyan" />
            </div>
            <div>
              <h2 className="text-lg font-sci font-bold text-sci-text">
                多 IP 智能操作中心
              </h2>
              <p className="text-xs text-sci-dim">
                跨服务器批量任务执行与智能决策
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded
                       hover:bg-sci-cyan/20 text-sci-dim hover:text-sci-cyan transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧操作列表 */}
          <div className="w-80 border-r border-sci-cyan/20 flex flex-col bg-black/20">
            <div className="p-4 border-b border-sci-cyan/20 flex items-center justify-between">
              <h3 className="text-sm font-sci font-bold text-sci-cyan uppercase tracking-wider">
                操作任务 ({operations.length})
              </h3>
              {operations.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('确定要清除所有本地缓存的操作记录吗？此操作不可恢复。')) {
                      clearAllOperations();
                      setSelectedOperationId(null);
                    }
                  }}
                  className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1
                             px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  title="清除所有本地缓存"
                >
                  <Trash2 size={10} />
                  清除全部
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {operations.length === 0 ? (
                <div className="text-center py-8 text-sci-dim/50">
                  <Terminal size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">暂无操作任务</p>
                  <p className="text-[10px] mt-1">在 AI 面板选择多个服务器开始</p>
                </div>
              ) : (
                operations.map(op => (
                  <button
                    key={op.id}
                    onClick={() => setSelectedOperationId(op.id)}
                    className={`w-full p-3 rounded border text-left transition-all
                               ${selectedOperationId === op.id
                                 ? 'bg-sci-cyan/10 border-sci-cyan/50 shadow-[0_0_10px_rgba(0,243,255,0.1)]'
                                 : 'bg-black/30 border-white/5 hover:border-sci-cyan/30'
                               }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-sci-text truncate">
                        {op.taskName}
                      </span>
                      {getStatusIcon(op.status)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-sci-dim">
                      <span className="flex items-center gap-1">
                        <Server size={10} />
                        {op.targetServers.length} 台
                      </span>
                      <span>•</span>
                      <span>{getModeLabel(op.executionMode)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="flex-1 h-1 bg-black/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-sci-cyan to-sci-violet transition-all"
                          style={{ 
                            width: `${op.stats.totalServers > 0 
                              ? (op.stats.completedServers / op.stats.totalServers) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-sci-dim">
                        {op.stats.completedServers}/{op.stats.totalServers}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 右侧详情面板 */}
          <div className="flex-1 flex flex-col bg-black/10">
            {selectedOperation ? (
              <>
                {/* 操作概览 */}
                <div className="p-6 border-b border-sci-cyan/20">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-sci font-bold text-sci-text mb-1">
                        {selectedOperation.taskName}
                      </h3>
                      <p className="text-sm text-sci-dim">
                        {selectedOperation.taskDescription}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedOperation.status === 'running' ? (
                        <button
                          onClick={() => pauseOperation(selectedOperation.id)}
                          className="px-3 py-1.5 rounded bg-yellow-500/20 border border-yellow-500/50
                                     text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 transition-colors
                                     flex items-center gap-1"
                        >
                          <Pause size={12} />
                          暂停
                        </button>
                      ) : selectedOperation.status === 'paused' ? (
                        <button
                          onClick={() => startOperation(selectedOperation.id)}
                          className="px-3 py-1.5 rounded bg-green-500/20 border border-green-500/50
                                     text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors
                                     flex items-center gap-1"
                        >
                          <Play size={12} />
                          继续
                        </button>
                      ) : null}
                      
                      {selectedOperation.status === 'running' && (
                        <button
                          onClick={() => cancelOperation(selectedOperation.id)}
                          className="px-3 py-1.5 rounded bg-red-500/20 border border-red-500/50
                                     text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors
                                     flex items-center gap-1"
                        >
                          <Square size={12} />
                          中止
                        </button>
                      )}
                      
                      {(selectedOperation.status === 'completed' || 
                        selectedOperation.status === 'error' ||
                        selectedOperation.status === 'cancelled') && (
                        <button
                          onClick={() => deleteOperation(selectedOperation.id)}
                          className="px-3 py-1.5 rounded bg-sci-dim/20 border border-sci-dim/50
                                     text-sci-dim text-xs font-medium hover:bg-sci-dim/30 transition-colors
                                     flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 统计信息 */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 rounded bg-black/30 border border-white/5">
                      <div className="text-[10px] text-sci-dim uppercase mb-1">目标服务器</div>
                      <div className="text-lg font-sci font-bold text-sci-cyan">
                        {selectedOperation.stats.totalServers}
                      </div>
                    </div>
                    <div className="p-3 rounded bg-black/30 border border-white/5">
                      <div className="text-[10px] text-sci-dim uppercase mb-1">已完成</div>
                      <div className="text-lg font-sci font-bold text-green-400">
                        {selectedOperation.stats.completedServers}
                      </div>
                    </div>
                    <div className="p-3 rounded bg-black/30 border border-white/5">
                      <div className="text-[10px] text-sci-dim uppercase mb-1">失败</div>
                      <div className="text-lg font-sci font-bold text-red-400">
                        {selectedOperation.stats.failedServers}
                      </div>
                    </div>
                    <div className="p-3 rounded bg-black/30 border border-white/5">
                      <div className="text-[10px] text-sci-dim uppercase mb-1">执行模式</div>
                      <div className="text-sm font-medium text-sci-violet">
                        {getModeLabel(selectedOperation.executionMode)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 任务完成报告 - 可滚动查看全貌 */}
                {(selectedOperation.status === 'completed' ||
                  selectedOperation.status === 'error' ||
                  selectedOperation.status === 'cancelled') && (
                  <div className="px-6 py-4 border-b border-sci-cyan/20 bg-gradient-to-r from-green-500/5 to-sci-cyan/5">
                    {/* 标题栏：状态 + 导出按钮 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {selectedOperation.status === 'completed' ? (
                          <>
                            <CheckCircle size={20} className="text-green-500" />
                            <span className="text-lg font-sci font-bold text-green-400">任务已完成</span>
                          </>
                        ) : selectedOperation.status === 'error' ? (
                          <>
                            <XCircle size={20} className="text-red-500" />
                            <span className="text-lg font-sci font-bold text-red-400">任务执行出错</span>
                          </>
                        ) : (
                          <>
                            <Square size={20} className="text-yellow-500" />
                            <span className="text-lg font-sci font-bold text-yellow-400">任务已取消</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => handleExportMarkdown(selectedOperation)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sci-cyan/10 border border-sci-cyan/30
                                   text-sci-cyan text-xs font-medium hover:bg-sci-cyan/20 transition-colors"
                        title="导出为 Markdown"
                      >
                        <FileDown size={14} />
                        导出报告
                      </button>
                    </div>

                    {/* 执行报告内容 - 可滚动 */}
                    {selectedOperation.summary && (
                      <div className="mt-3">
                        <h5 className="text-xs font-sci font-bold text-sci-cyan uppercase tracking-wider mb-2">
                          执行报告
                        </h5>
                        <div className="max-h-48 overflow-y-auto p-4 rounded bg-black/30 border border-white/10 custom-scrollbar">
                          <div className="text-sm text-sci-text/80 whitespace-pre-wrap leading-relaxed">
                            {selectedOperation.summary}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 优化建议 */}
                    {selectedOperation.recommendations && selectedOperation.recommendations.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-xs font-sci font-bold text-sci-violet uppercase tracking-wider mb-2">
                          优化建议
                        </h5>
                        <div className="max-h-32 overflow-y-auto custom-scrollbar">
                          <ul className="space-y-1">
                            {selectedOperation.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-sm text-sci-text/70 flex items-start gap-2">
                                <span className="text-sci-violet mt-1">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 执行步骤 */}
                <div className="flex-1 overflow-y-auto p-6">
                  <h4 className="text-sm font-sci font-bold text-sci-cyan uppercase tracking-wider mb-4">
                    执行步骤 ({selectedOperation.steps.length})
                  </h4>
                  
                  <div className="space-y-3">
                    {selectedOperation.steps.length === 0 ? (
                      <div className="text-center py-8 text-sci-dim/50">
                        <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">等待开始执行...</p>
                      </div>
                    ) : (
                      selectedOperation.steps.map((step, index) => (
                        <ExecutionStepCard
                          key={step.stepNumber}
                          step={step}
                          isExpanded={expandedSteps.has(step.stepNumber)}
                          onToggle={() => toggleStepExpansion(step.stepNumber)}
                          isLast={index === selectedOperation.steps.length - 1}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sci-dim/50">
                <div className="text-center">
                  <Cpu size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-sm">选择一个操作任务查看详情</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// 执行步骤卡片组件
interface ExecutionStepCardProps {
  step: ExecutionStep;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}

const ExecutionStepCard: React.FC<ExecutionStepCardProps> = ({ 
  step, 
  isExpanded, 
  onToggle,
  isLast 
}) => {
  const getStatusIcon = (status: ExecutionStep['status']) => {
    switch (status) {
      case 'running': return <Activity size={16} className="text-sci-cyan animate-pulse" />;
      case 'completed': return <CheckCircle size={16} className="text-green-500" />;
      case 'error': return <XCircle size={16} className="text-red-500" />;
      case 'waiting_decision': return <AlertCircle size={16} className="text-orange-500 animate-bounce" />;
      default: return <Clock size={16} className="text-sci-dim" />;
    }
  };

  const getServerStatusIcon = (status: ServerExecutionResult['status']) => {
    switch (status) {
      case 'running': return <div className="w-2 h-2 rounded-full bg-sci-cyan animate-pulse" />;
      case 'success': return <CheckCircle size={12} className="text-green-500" />;
      case 'error': return <XCircle size={12} className="text-red-500" />;
      case 'skipped': return <div className="w-2 h-2 rounded-full bg-sci-dim" />;
      default: return <div className="w-2 h-2 rounded-full bg-sci-dim/50" />;
    }
  };

  const completedCount = step.serverResults.filter(sr => 
    sr.status === 'success' || sr.status === 'error'
  ).length;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all
                    ${step.status === 'running' 
                      ? 'border-sci-cyan/50 bg-sci-cyan/5' 
                      : step.status === 'completed'
                        ? 'border-green-500/30 bg-green-500/5'
                        : step.status === 'error'
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-white/10 bg-black/20'
                    }`}>
      {/* 步骤头部 */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center
                          ${step.status === 'running' 
                            ? 'bg-sci-cyan/20 text-sci-cyan' 
                            : step.status === 'completed'
                              ? 'bg-green-500/20 text-green-500'
                              : step.status === 'error'
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-sci-dim/20 text-sci-dim'
                          }`}>
            <span className="text-sm font-bold">{step.stepNumber}</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-sci-text">
              {step.description}
            </div>
            <div className="text-[10px] text-sci-dim font-mono mt-0.5">
              {step.command}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-sci-dim">
            <span className="flex items-center gap-1">
              <CheckCircle size={10} className="text-green-500" />
              {completedCount}/{step.serverResults.length}
            </span>
          </div>
          {getStatusIcon(step.status)}
          {isExpanded ? <ChevronDown size={16} className="text-sci-dim" /> 
                      : <ChevronRight size={16} className="text-sci-dim" />}
        </div>
      </button>

      {/* 展开的详情 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-4 space-y-3">
              {/* 服务器结果列表 */}
              {step.serverResults.map(result => (
                <div 
                  key={result.serverId}
                  className="p-3 rounded bg-black/30 border border-white/5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getServerStatusIcon(result.status)}
                      <span className="text-xs font-medium text-sci-text">
                        {result.serverName}
                      </span>
                      <span className="text-[10px] text-sci-dim">
                        ({result.ip})
                      </span>
                    </div>
                    <div className="text-[10px] text-sci-dim">
                      {result.duration && `${result.duration}ms`}
                    </div>
                  </div>
                  
                  {result.output && (
                    <div className="mt-2 p-2 rounded bg-black/50 font-mono text-[10px] 
                                    text-sci-dim/80 max-h-24 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{result.output}</pre>
                    </div>
                  )}
                  
                  {result.error && (
                    <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30
                                    text-[10px] text-red-400">
                      {result.error}
                    </div>
                  )}
                </div>
              ))}

              {/* AI 决策面板 */}
              {step.aiDecision && (
                <div className="p-3 rounded bg-sci-violet/10 border border-sci-violet/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-sci-violet" />
                    <span className="text-xs font-medium text-sci-violet">
                      AI 决策
                    </span>
                    {step.aiDecision.requiresConfirmation && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/20 
                                       text-[9px] text-orange-400">
                        需要确认
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-sci-text/80 mb-2">
                    {step.aiDecision.reasoning}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-sci-dim">下一步:</span>
                    <span className="text-[10px] text-sci-cyan">
                      {step.aiDecision.nextAction === 'continue' && '继续执行'}
                      {step.aiDecision.nextAction === 'retry' && '重试'}
                      {step.aiDecision.nextAction === 'skip' && '跳过'}
                      {step.aiDecision.nextAction === 'abort' && '中止'}
                      {step.aiDecision.nextAction === 'ask_user' && '询问用户'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiIPOperationCenter;
