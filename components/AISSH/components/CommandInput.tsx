import React, { useState, useRef } from 'react';
import { Command, Terminal as TerminalIcon, ChevronDown, Send, Brain, Sparkles, Loader2, X, AlertTriangle, Info, BookOpen, Save, ArrowRightLeft } from 'lucide-react';
import { CyberPanel } from '../common/CyberPanel';
import { CyberSelect } from '../common/CyberSelect';
import { useSSHStore } from '../store/useSSHStore';
import { AIServiceFactory } from '../services/aiServiceFactory';
import { SingleExecutionStrategy, BatchExecutionStrategy, BatchCompareStrategy, CommandExecutor } from '../services/commandStrategy';
import { CommandTemplateModal } from './CommandTemplateModal';
import { BatchResultCompare } from './BatchResultCompare';
import { usePromptStore } from '../store/usePromptStore';

interface CommandInputProps {
  onInsertCommand: (command: string) => void;
}

export const CommandInput: React.FC<CommandInputProps> = ({ onInsertCommand }) => {
  const { servers, activeSessionId, openSessions, addLog, commandHistory, addCommandToHistory, batchResults, addBatchResult, clearBatchResults, commandTemplates } = useSSHStore();
  const { profiles, selectedProfileId, selectProfile } = usePromptStore();
  const [globalCommand, setGlobalCommand] = useState('');
  const [operationMode, setOperationMode] = useState<'single' | 'batch' | 'compare'>('single');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [prediction, setPrediction] = useState<{ explanation: string, riskLevel: string, warning: string } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<{ command: string, type: 'history' | 'template', name?: string, description?: string }[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [showCompareResults, setShowCompareResults] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executor = useRef(new CommandExecutor(new SingleExecutionStrategy()));

  const operationModeOptions = [
    { value: 'single', label: '单个操作' },
    { value: 'batch', label: '批量分发' },
    { value: 'compare', label: '批量对比' },
  ];

  const profileOptions = profiles.map(p => ({ value: p.id, label: p.name }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = historyIndex + 1;
      if (nextIndex < commandHistory.length) {
        setHistoryIndex(nextIndex);
        setGlobalCommand(commandHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setGlobalCommand(commandHistory[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setGlobalCommand('');
      }
    } else if (e.key === 'Tab') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setGlobalCommand(suggestions[0].command);
        setSuggestions([]);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGlobalCommand(val);
    setHistoryIndex(-1);
    if (prediction) setPrediction(null);

    if (val.trim()) {
      // Get historical suggestions
      const histSuggestions: { command: string, type: 'history' }[] = commandHistory
        .filter(c => c.toLowerCase().startsWith(val.toLowerCase()) && c !== val)
        .slice(0, 5)
        .map(c => ({ command: c, type: 'history' }));

      // Get template suggestions
      const templateSuggestions: { command: string, type: 'template', name: string, description?: string }[] = commandTemplates
        .filter(t => 
          (t.command.toLowerCase().includes(val.toLowerCase()) || t.name.toLowerCase().includes(val.toLowerCase())) && 
          t.command !== val
        )
        .slice(0, 5)
        .map(t => ({ command: t.command, type: 'template', name: t.name, description: t.description }));

      // Merge and remove duplicate commands, prioritizing templates if commands are identical
      const seen = new Set<string>();
      const combined: { command: string, type: 'history' | 'template', name?: string, description?: string }[] = [];

      [...templateSuggestions, ...histSuggestions].forEach(item => {
        if (!seen.has(item.command)) {
          seen.add(item.command);
          combined.push(item);
        }
      });

      setSuggestions(combined.slice(0, 8));
    } else {
      setSuggestions([]);
    }
  };

  const handlePredictRisk = async () => {
    if (!globalCommand.trim()) return;
    if (isPredicting) {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      setIsPredicting(false);
      return;
    }

    setIsPredicting(true);
    setPrediction(null);
    abortControllerRef.current = new AbortController();

    try {
      const aiService = AIServiceFactory.getService('gemini');
      const res = await aiService.predictCommandRisk(globalCommand, abortControllerRef.current.signal);
      if (res) setPrediction(res);
    } catch (err) {
      console.error("Prediction UI error:", err);
    } finally {
      setIsPredicting(false);
      abortControllerRef.current = null;
    }
  };

  const handleAITranslate = async () => {
    if (!globalCommand.trim()) return;
    setIsAIProcessing(true);
    try {
      const aiService = AIServiceFactory.getService('gemini');
      const translated = await aiService.chatWithAI(`请将以下运维意图转化为一条标准的 Linux 命令（只返回命令本身，不要解释）：\n${globalCommand}`, []);
      setGlobalCommand(translated.replace(/`/g, '').trim());
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleExecuteCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalCommand.trim()) return;

    if (operationMode === 'compare') {
      setIsComparing(true);
      clearBatchResults();
      executor.current.setStrategy(new BatchCompareStrategy());
      await executor.current.execute(globalCommand, { 
        activeSessionId, 
        openSessions,
        onBatchResults: (results) => {
          results.forEach(res => {
            const server = servers.find(s => s.id === res.serverId);
            addBatchResult({ ...res, serverName: server?.name || res.serverId });
          });
          setIsComparing(false);
          setShowCompareResults(true);
        }
      });
    } else if (operationMode === 'batch') {
      executor.current.setStrategy(new BatchExecutionStrategy());
      await executor.current.execute(globalCommand, { activeSessionId, openSessions });
    } else {
      executor.current.setStrategy(new SingleExecutionStrategy());
      await executor.current.execute(globalCommand, { activeSessionId, openSessions });
    }

    addCommandToHistory(globalCommand);
    if (operationMode !== 'compare') {
      setGlobalCommand('');
    }
    setPrediction(null);
    setHistoryIndex(-1);
    setSuggestions([]);
  };

  const terminalSessions = openSessions.filter(id => !id.endsWith('#files'));

  if (terminalSessions.length === 0) return null;

  return (
    <>
      <form onSubmit={handleExecuteCommand} className="relative z-[60]">
        <CyberPanel variant="obsidian" className="p-2 border-t border-white/10 flex items-center gap-3 flex-shrink-0 shadow-2xl">
          <div className="flex items-center gap-0 shrink-0">
             <CyberSelect 
               value={operationMode} 
               onChange={(val) => setOperationMode(val as any)}
               options={operationModeOptions}
               variant="cyan"
               direction="up"
             />
           </div>


           <div className="flex items-center gap-1 min-w-[120px]">
             <CyberSelect 
               value={selectedProfileId || ''} 
               onChange={(val) => selectProfile(val)}
               options={profileOptions}
               variant="violet"
               label="类型"
               width="100%"
               direction="up"
             />
           </div>

          <div className="relative flex-1 group">
             <input 
               type="text" 
               value={globalCommand} 
               onChange={handleInputChange}
               onKeyDown={handleKeyDown}
               placeholder={
                 operationMode === 'compare' ? "输入指令并在所有节点执行对比结果..." :
                 operationMode === 'batch' ? "输入指令批量分发到所有终端..." : 
                 "输入指令发送到当前终端..."
               } 
               className="w-full bg-black/40 border border-white/10 px-4 py-2 font-mono text-xs focus:outline-none focus:border-sci-cyan/50 text-sci-text transition-all" 
             />
             
             {suggestions.length > 0 && (
               <div className="absolute bottom-full left-0 w-full mb-1 bg-sci-obsidian border border-sci-cyan/30 shadow-[0_-5px_20px_rgba(0,243,255,0.15)] z-[60] animate-in fade-in slide-in-from-bottom-1">
                 {suggestions.map((s, i) => (
                   <div 
                     key={i}
                     className="px-4 py-2 text-xs font-mono group/item hover:bg-sci-cyan/10 cursor-pointer border-b border-white/5 last:border-0 flex items-center justify-between"
                     onClick={() => {
                       setGlobalCommand(s.command);
                       setSuggestions([]);
                     }}
                   >
                     <div className="flex items-center gap-2 overflow-hidden flex-1">
                       {s.type === 'template' ? (
                         <BookOpen size={12} className="text-sci-cyan shrink-0" />
                       ) : (
                         <TerminalIcon size={12} className="text-sci-dim shrink-0" />
                       )}
                       <div className="flex items-baseline gap-2 overflow-hidden">
                         <span className="text-sci-cyan/80 group-hover/item:text-sci-cyan truncate">
                           {s.command}
                         </span>
                         {s.type === 'template' && (
                           <div className="flex items-center gap-1 shrink-0 overflow-hidden">
                             <span className="text-[10px] text-sci-dim/60 font-sans truncate">
                               ({s.name})
                             </span>
                             {s.description && (
                               <span className="text-[10px] text-sci-dim/40 font-sans truncate italic border-l border-white/10 pl-1">
                                 {s.description}
                               </span>
                             )}
                           </div>
                         )}
                       </div>
                     </div>
                     {s.type === 'template' && (
                       <span className="text-[9px] font-bold uppercase tracking-tighter text-sci-cyan/40 bg-sci-cyan/5 px-1 rounded shrink-0 ml-2">
                         模板
                       </span>
                     )}
                     {s.type === 'history' && (
                       <span className="text-[9px] font-bold uppercase tracking-tighter text-sci-dim/40 shrink-0 ml-2">
                         历史
                       </span>
                     )}
                   </div>
                 ))}
               </div>
             )}
             
             <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
               {globalCommand.trim() && (
                 <>
                   <button 
                     type="button"
                     onClick={() => setIsTemplateModalOpen(true)}
                     className="p-1.5 text-sci-dim hover:text-sci-cyan transition-colors"
                     title="保存为模板"
                   >
                     <Save size={14}/>
                   </button>
                   <button 
                     type="button"
                     onClick={handlePredictRisk}
                     className="flex items-center gap-1.5 px-2 py-1 transition-all font-sci font-bold text-[10px] uppercase tracking-widest bg-sci-cyan/5 text-sci-cyan/60 hover:bg-sci-cyan/20 hover:text-sci-cyan border border-transparent hover:border-sci-cyan/30"
                     title={isPredicting ? "停止评估" : "AI 风险评估"}
                   >
                     {isPredicting ? <Loader2 size={12} className="animate-spin"/> : <Brain size={12}/>}
                     <span>{isPredicting ? '分析中' : '风险评估'}</span>
                   </button>
                 </>
               )}
               <button 
                 type="button"
                 onClick={() => setIsTemplateModalOpen(true)}
                 className="flex items-center gap-1 hover:text-sci-cyan transition-colors text-sci-dim"
                 title="命令模板库"
               >
                 <BookOpen size={12}/> 
                 <span className="text-[10px] font-bold uppercase">模板</span>
               </button>
             </div>

             {prediction && (
               <div className="absolute bottom-full mb-4 left-0 right-0 animate-in slide-in-from-bottom-2 fade-in duration-300 z-50">
                 <div className={`p-3 border backdrop-blur-xl shadow-2xl flex gap-3 items-start transition-colors relative clip-corner
                   ${prediction.riskLevel === 'high' ? 'bg-sci-red/10 border-sci-red/30 text-sci-red' : 
                     prediction.riskLevel === 'medium' ? 'bg-sci-violet/10 border-sci-violet/30 text-sci-violet' : 'bg-sci-cyan/10 border-sci-cyan/30 text-sci-cyan'}`}>
                   
                   <button 
                     onClick={() => setPrediction(null)}
                     className="absolute top-2 right-2 p-1 hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
                   >
                     <X size={14}/>
                   </button>

                   <div className={`p-2 shrink-0 ${prediction.riskLevel === 'high' ? 'bg-sci-red/20' : prediction.riskLevel === 'medium' ? 'bg-sci-violet/20' : 'bg-sci-cyan/20'}`}>
                     {prediction.riskLevel === 'high' ? <AlertTriangle size={16}/> : <Info size={16}/>}
                   </div>
                   <div className="flex-1 pr-6 max-h-40 overflow-y-auto custom-scrollbar font-sci">
                     <div className="flex items-center justify-between mb-1 sticky top-0 bg-transparent">
                       <span className="text-[10px] font-black uppercase tracking-widest opacity-60">风险评估报告</span>
                       <span className={`text-[10px] font-bold px-1.5 uppercase ${prediction.riskLevel === 'high' ? 'bg-sci-red text-black' : 'bg-white/10 text-sci-text'}`}>
                         {prediction.riskLevel === 'high' ? '高' : prediction.riskLevel === 'medium' ? '中' : '低'} 风险
                       </span>
                     </div>
                     <p className="text-xs font-bold text-sci-text/90 leading-relaxed">{prediction.explanation}</p>
                     {prediction.warning && (
                       <div className="mt-2 p-2 bg-black/20 border-l-2 border-sci-red">
                          <p className="text-[10px] text-sci-red italic font-bold uppercase tracking-tighter">警告: {prediction.warning}</p>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             )}
           </div>
          
          <button 
            type="submit" 
            disabled={!globalCommand.trim() || isComparing}
            className="px-6 py-2 bg-sci-cyan/10 border border-sci-cyan/50 text-sci-cyan text-xs font-bold uppercase tracking-widest hover:bg-sci-cyan hover:text-black disabled:opacity-30 disabled:hover:bg-sci-cyan/10 disabled:hover:text-sci-cyan transition-all clip-corner flex items-center gap-2"
          >
            {isComparing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {isComparing ? '执行中' : '执行'}
          </button>
        </CyberPanel>
      </form>

      {isTemplateModalOpen && (
        <CommandTemplateModal 
          onClose={() => setIsTemplateModalOpen(false)}
          onSelect={(cmd) => {
            setGlobalCommand(cmd);
            setIsTemplateModalOpen(false);
          }}
          initialCommand={globalCommand}
        />
      )}

      {showCompareResults && batchResults.length > 0 && (
        <BatchResultCompare 
          results={batchResults}
          onClose={() => setShowCompareResults(false)}
        />
      )}
    </>
  );
};
