import React, { useState, useMemo } from 'react';
import { X, Search, LayoutGrid, List, Columns, ArrowRightLeft, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { CyberPanel } from '../common/CyberPanel';
import { BatchResult } from '../types';

interface BatchResultCompareProps {
  results: BatchResult[];
  onClose: () => void;
}

export const BatchResultCompare: React.FC<BatchResultCompareProps> = ({ results, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'side'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(true);

  const referenceOutput = useMemo(() => {
    if (results.length === 0) return '';
    const counts = new Map<string, number>();
    results.forEach(r => {
      counts.set(r.output, (counts.get(r.output) || 0) + 1);
    });
    let maxCount = 0;
    let reference = results[0].output;
    counts.forEach((count, output) => {
      if (count > maxCount) {
        maxCount = count;
        reference = output;
      }
    });
    return reference;
  }, [results]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredResults = useMemo(() => {
    return results.filter((r: BatchResult) => 
      r.serverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.output.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [results, searchTerm]);

  const getCommonOutput = () => {
    if (results.length < 2) return '';
    // Simple heuristic: if all outputs are identical
    const firstOutput = results[0].output;
    const allSame = results.every((r: BatchResult) => r.output === firstOutput);
    return allSame ? firstOutput : null;
  };

  const commonOutput = getCommonOutput();

  const renderContent = (content: string) => {
    const refLines = referenceOutput.split('\n');
    const lines = content.split('\n');
    
    return lines.map((line, i) => {
      const isDifferent = showDiff && line !== refLines[i];
      
      if (!searchTerm) {
        return (
          <div key={i} className={`${isDifferent ? 'bg-sci-violet/20 border-l-2 border-sci-violet' : ''} px-1 min-h-[1.2em]`}>
            {line || ' '}
          </div>
        );
      }

      const parts = line.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return (
        <div key={i} className={`${isDifferent ? 'bg-sci-violet/20 border-l-2 border-sci-violet' : ''} px-1 min-h-[1.2em]`}>
          {parts.map((part, index) => 
            part.toLowerCase() === searchTerm.toLowerCase() ? (
              <span key={index} className="bg-sci-cyan text-black font-bold px-0.5 rounded-sm shadow-[0_0_5px_rgba(0,243,255,0.5)]">{part}</span>
            ) : part
          )}
          {!line && ' '}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <CyberPanel variant="obsidian" className="w-[90vw] h-[85vh] flex flex-col border border-sci-cyan/30 shadow-[0_0_100px_rgba(0,243,255,0.2)] relative overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-sci-cyan/5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sci-cyan/20 rounded-sm">
                <ArrowRightLeft size={18} className="text-sci-cyan" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-sci-cyan">批量执行结果对比</h3>
                <p className="text-[10px] text-sci-dim uppercase font-bold tracking-tighter">Batch Execution Comparison</p>
              </div>
            </div>
            
            <div className="h-8 w-px bg-white/10 mx-2"></div>

            <div className="flex items-center bg-black/40 border border-white/10 px-3 py-1.5 gap-2 min-w-[300px]">
              <Search size={14} className="text-sci-dim" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder="搜索服务器或输出内容..."
                className="bg-transparent text-xs text-sci-text outline-none w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-black/40 border border-white/10 p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-all ${viewMode === 'grid' ? 'bg-sci-cyan text-black' : 'text-sci-dim hover:text-sci-text'}`}
                title="网格视图"
              >
                <LayoutGrid size={14} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 transition-all ${viewMode === 'list' ? 'bg-sci-cyan text-black' : 'text-sci-dim hover:text-sci-text'}`}
                title="列表视图"
              >
                <List size={14} />
              </button>
              <button 
                onClick={() => setViewMode('side')}
                className={`p-1.5 transition-all ${viewMode === 'side' ? 'bg-sci-cyan text-black' : 'text-sci-dim hover:text-sci-text'}`}
                title="侧边对比"
              >
                <Columns size={14} />
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-sci-red/20 transition-colors text-sci-dim hover:text-sci-red">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="px-4 py-2 bg-black/20 border-b border-white/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
          <div className="flex gap-4">
            <span className="text-sci-dim">总计: <span className="text-sci-cyan">{results.length}</span></span>
            <span className="text-sci-dim">一致性: {commonOutput ? (
              <span className="text-sci-green flex items-center gap-1 inline-flex">
                <CheckCircle2 size={10} /> 全部一致
              </span>
            ) : (
              <span className="text-sci-violet flex items-center gap-1 inline-flex">
                <AlertCircle size={10} /> 存在差异
              </span>
            )}</span>
          </div>
          <div className="text-sci-dim italic">
            Command: <span className="text-sci-text font-mono normal-case">{results[0]?.command}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResults.map((result: BatchResult) => (
                <div 
                  key={result.serverId}
                  className={`flex flex-col border transition-all overflow-hidden ${
                    commonOutput ? 'border-white/10' : 
                    result.output === commonOutput ? 'border-white/10' : 'border-sci-violet/30 bg-sci-violet/5'
                  }`}
                >
                  <div className="px-3 py-2 bg-white/5 border-b border-white/5 flex justify-between items-center">
                    <span className="text-xs font-bold text-sci-cyan truncate">{result.serverName}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleCopy(result.output, result.serverId)}
                        className="p-1 hover:text-sci-cyan transition-colors text-sci-dim"
                        title="复制输出"
                      >
                        {copiedId === result.serverId ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <span className="text-[9px] text-sci-dim">{result.serverId}</span>
                    </div>
                  </div>
                  <pre className="flex-1 p-3 font-mono text-[10px] whitespace-pre-wrap overflow-y-auto max-h-[200px] custom-scrollbar bg-black/20 text-sci-text/80">
                    {renderContent(result.output)}
                  </pre>
                </div>
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-4">
              {filteredResults.map((result: BatchResult) => (
                <div 
                  key={result.serverId}
                  className={`border transition-all ${
                    commonOutput ? 'border-white/10' : 
                    result.output === commonOutput ? 'border-white/10' : 'border-sci-violet/30 bg-sci-violet/5'
                  }`}
                >
                  <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-sci-cyan">{result.serverName}</span>
                      <span className="text-[10px] text-sci-dim font-mono">{result.serverId}</span>
                      <button 
                        onClick={() => handleCopy(result.output, result.serverId)}
                        className="p-1 hover:text-sci-cyan transition-colors text-sci-dim"
                        title="复制输出"
                      >
                        {copiedId === result.serverId ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                    {commonOutput && result.output === commonOutput && (
                      <span className="text-[9px] font-bold text-sci-green uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 size={10} /> 与其它节点一致
                      </span>
                    )}
                  </div>
                  <pre className="p-4 font-mono text-[10px] whitespace-pre-wrap bg-black/20 text-sci-text/80">
                    {renderContent(result.output)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {filteredResults.map((result: BatchResult) => (
                <div 
                  key={result.serverId}
                  className={`flex-shrink-0 w-[400px] flex flex-col border transition-all ${
                    commonOutput ? 'border-white/10' : 
                    result.output === commonOutput ? 'border-white/10' : 'border-sci-violet/30 bg-sci-violet/5'
                  }`}
                >
                  <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-sci-cyan">{result.serverName}</span>
                      <span className="text-[9px] text-sci-dim font-mono">{result.serverId}</span>
                    </div>
                    <button 
                      onClick={() => handleCopy(result.output, result.serverId)}
                      className="p-1.5 hover:bg-sci-cyan/10 text-sci-dim hover:text-sci-cyan transition-colors"
                      title="复制输出"
                    >
                      {copiedId === result.serverId ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <pre className="flex-1 p-4 font-mono text-[11px] whitespace-pre-wrap overflow-y-auto custom-scrollbar bg-black/40 text-sci-text/90 leading-relaxed">
                    {renderContent(result.output)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </CyberPanel>
    </div>
  );
};
