import type React from 'react';
import { Activity, FileDown, FileUp, History, ShieldAlert, ShieldCheck, Sparkles, Thermometer, Wand2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAIStore } from '../store/useAIStore';
import { useMultiIPStore } from '../store/useMultiIPStore';
import { usePromptStore } from '../store/usePromptStore';
import { useSSHStore } from '../store/useSSHStore';
import type { AgentConfig, ExportConfigData, PromptProfile, Server } from '../types';
import {
  exportConfiguration,
  importConfiguration,
  saveConfigurationExport,
  toPersistedAgentConfig,
  toPersistedOperations,
  toPersistedServer,
} from '../services/configurationPersistence';
import { saveApiKey } from '../services/aiClient';

export function NeuralCoreConfigPanel() {
  const { agentConfig, setAgentConfig } = useAIStore(useShallow((state) => ({
    agentConfig: state.agentConfig,
    setAgentConfig: state.setAgentConfig,
  })));
  const { servers, folders, commandTemplates, commandHistory, setServers, setFolders, setCommandTemplates, setCommandHistory } = useSSHStore(useShallow((state) => ({
    servers: state.servers,
    folders: state.folders,
    commandTemplates: state.commandTemplates,
    commandHistory: state.commandHistory,
    setServers: state.setServers,
    setFolders: state.setFolders,
    setCommandTemplates: state.setCommandTemplates,
    setCommandHistory: state.setCommandHistory,
  })));
  const { promptTree, selectedPromptIds, setPromptTree, setSelectedPromptIds } = usePromptStore(useShallow((state) => ({
    promptTree: state.promptTree,
    selectedPromptIds: state.selectedPromptIds,
    setPromptTree: state.setPromptTree,
    setSelectedPromptIds: state.setSelectedPromptIds,
  })));
  const { operations, hydrateOperations } = useMultiIPStore(useShallow((state) => ({
    operations: state.operations,
    hydrateOperations: state.hydrateOperations,
  })));

  const updateConfig = (updates: Partial<AgentConfig>) => {
    setAgentConfig((current) => ({ ...current, ...updates }));
  };

  const handleExport = async () => {
    try {
      const snapshot = await exportConfiguration();
      const data: ExportConfigData = {
        version: '2.0.0',
        exportDate: new Date().toISOString(),
        agentConfig: snapshot.agentConfig as AgentConfig,
        servers: snapshot.servers.map((server) => ({ ...server, status: 'disconnected' })) as Server[],
        folders: snapshot.folders,
        commandTemplates: snapshot.commandTemplates,
        promptTree: snapshot.promptTree,
        selectedPromptIds: snapshot.selectedPromptIds,
        commandHistory: snapshot.commandHistory,
        operations: snapshot.operations,
      };
      const result = await saveConfigurationExport(
        `gemini-ssh-config-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
      );
      if (!result.canceled) alert('配置备份已导出（不包含密码、私钥和 AI Key）。');
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败：本地数据服务不可用');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const data: ExportConfigData = JSON.parse(loadEvent.target?.result as string);
        if (!window.confirm('导入会先自动备份当前配置，再覆盖本机 SQLite 数据，是否继续？')) return;
        const importedTree = data.promptTree ?? (
          data.promptProfiles ? migrateProfilesToTree(data.promptProfiles) : promptTree
        );
        const importedSelectedIds = data.selectedPromptIds ?? (
          data.promptProfiles ? importedTree.filter((node) => node.type === 'prompt').slice(0, 1).map((node) => node.id) : selectedPromptIds
        );
        const saved = await importConfiguration({
          folders: data.folders ?? folders,
          servers: (data.servers ?? servers).map(toPersistedServer),
          commandTemplates: data.commandTemplates ?? commandTemplates,
          promptTree: importedTree,
          selectedPromptIds: importedSelectedIds,
          agentConfig: toPersistedAgentConfig(data.agentConfig ?? agentConfig),
          commandHistory: data.commandHistory ?? commandHistory,
          operations: toPersistedOperations(data.operations ?? operations),
        });
        setServers(saved.servers.map((server) => ({ ...server, status: 'disconnected' })));
        setFolders(saved.folders);
        setCommandTemplates(saved.commandTemplates);
        setCommandHistory(saved.commandHistory);
        setPromptTree(saved.promptTree);
        setSelectedPromptIds(saved.selectedPromptIds);
        setAgentConfig(saved.agentConfig as AgentConfig);
        hydrateOperations(saved.operations);
        alert('配置导入成功，当前连接凭据需要重新输入。');
      } catch (error) {
        console.error('Import failed:', error);
        alert(`导入失败：${error instanceof Error ? error.message : '无效的配置文件'}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return <div className="flex min-h-0 flex-1 flex-col overflow-auto custom-scrollbar">
    <header className="border-b border-white/10 bg-sci-panel/50 p-4">
      <div className="flex items-center gap-2 text-sci-cyan"><Sparkles size={16} /><h2 className="text-xs font-bold tracking-widest">神经核心配置</h2></div>
      <p className="mt-1 text-[10px] text-sci-dim">编排引擎、模型和安全策略</p>
    </header>
    <div className="space-y-5 p-4">
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-[11px] font-bold text-sci-text"><ShieldCheck size={14} className="text-sci-cyan" />数据管理</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={handleExport} className="flex items-center justify-center gap-2 border border-sci-cyan/30 bg-sci-cyan/10 py-2 text-[10px] font-bold text-sci-cyan hover:bg-sci-cyan hover:text-black"><FileDown size={13} />导出配置</button>
          <label className="flex cursor-pointer items-center justify-center gap-2 border border-sci-violet/30 bg-sci-violet/10 py-2 text-[10px] font-bold text-sci-violet hover:bg-sci-violet hover:text-black"><FileUp size={13} />导入配置<input type="file" accept=".json" onChange={handleImport} className="hidden" /></label>
        </div>
      </section>
      <Toggle label="自动同步分析" description="在聊天模式下自动分析终端输出" checked={agentConfig.autoSyncTerminal} icon={<Wand2 size={17} />} onChange={() => updateConfig({ autoSyncTerminal: !agentConfig.autoSyncTerminal })} />
      <Range label="最大迭代次数" value={agentConfig.maxAttempts} min={1} max={50} accent="cyan" icon={<Activity size={14} />} onChange={(value) => updateConfig({ maxAttempts: value })} />
      <Range label="上下文记忆轮数" value={agentConfig.maxMemoryMessages || 10} min={1} max={50} accent="violet" icon={<History size={14} />} onChange={(value) => updateConfig({ maxMemoryMessages: value })} />
      <section className="space-y-2"><label className="flex items-center gap-2 text-[11px] font-bold text-sci-text"><Sparkles size={14} className="text-sci-violet" />OpenAI 兼容模型</label><p className="text-[9px] text-white/40">支持所有 OpenAI API 兼容服务</p>
        <input value={agentConfig.customUrl || ''} onChange={(event) => updateConfig({ customUrl: event.target.value })} placeholder="OpenAI 兼容 API 地址" className="w-full border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-sci-text outline-none focus:border-sci-cyan/30" />
        <input type="password" value={agentConfig.customKey || ''} onChange={(event) => updateConfig({ customKey: event.target.value })} onBlur={() => void persistApiKey(agentConfig, setAgentConfig)} placeholder="API Key" className="w-full border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-sci-text outline-none focus:border-sci-cyan/30" />
        <input value={agentConfig.customModelName || ''} onChange={(event) => updateConfig({ customModelName: event.target.value })} placeholder="模型名（如 gpt-4o）" className="w-full border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-sci-text outline-none focus:border-sci-cyan/30" />
      </section>
      <Range label="发散等级 (Temperature)" value={agentConfig.temperature} min={0} max={1} step={0.1} accent="violet" icon={<Thermometer size={14} />} onChange={(value) => updateConfig({ temperature: value })} />
      <Toggle label="安全协议" description="对敏感序列执行强制授权" checked={agentConfig.safeMode} icon={<ShieldAlert size={17} />} onChange={() => updateConfig({ safeMode: !agentConfig.safeMode })} tone="green" />
    </div>
  </div>;
}

function Range({ label, value, min, max, step, accent, icon, onChange }: { label: string; value: number; min: number; max: number; step?: number; accent: 'cyan' | 'violet'; icon: React.ReactNode; onChange: (value: number) => void }) {
  return <section className="space-y-2"><div className="flex items-center justify-between"><label className={`flex items-center gap-2 text-[11px] font-bold text-sci-text ${accent === 'cyan' ? 'text-sci-cyan' : 'text-sci-violet'}`}>{icon}{label}</label><span className={`border px-1.5 py-0.5 font-mono text-[10px] ${accent === 'cyan' ? 'border-sci-cyan/20 text-sci-cyan' : 'border-sci-violet/20 text-sci-violet'}`}>{value}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={`w-full ${accent === 'cyan' ? 'accent-sci-cyan' : 'accent-sci-violet'}`} /></section>;
}

function Toggle({ label, description, checked, icon, onChange, tone = 'cyan' }: { label: string; description: string; checked: boolean; icon: React.ReactNode; onChange: () => void; tone?: 'cyan' | 'green' }) {
  const active = tone === 'cyan' ? 'bg-sci-cyan text-sci-cyan' : 'bg-sci-green text-sci-green';
  return <section className="flex items-center justify-between border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-3"><span className={checked ? active.split(' ')[1] : 'text-white/30'}>{icon}</span><div><h3 className="text-[11px] font-bold text-sci-text">{label}</h3><p className="text-[9px] text-sci-dim">{description}</p></div></div><button type="button" aria-label={label} onClick={onChange} className={`relative h-5 w-10 rounded-full ${checked ? active.split(' ')[0] : 'bg-white/10'}`}><span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} /></button></section>;
}

type SetAgentConfig = (config: AgentConfig | ((previous: AgentConfig) => AgentConfig)) => void;

async function persistApiKey(agentConfig: AgentConfig, setAgentConfig: SetAgentConfig) {
  const apiKey = agentConfig.customKey?.trim();
  if (!apiKey) return;
  try {
    await saveApiKey(apiKey);
    setAgentConfig((current) => ({ ...current, customKey: '' }));
  } catch (error) {
    console.error('Failed to save AI API key:', error);
  }
}

function migrateProfilesToTree(profiles: PromptProfile[]) {
  return [{ id: 'folder-imported', name: '导入的配置', type: 'folder' as const, parentId: null, order: 0, isExpanded: true }, ...profiles.map((profile, index) => ({ id: profile.id, name: profile.name, type: 'prompt' as const, parentId: 'folder-imported', order: index, deviceType: profile.deviceType, prompt: profile.prompt, rules: profile.rules }))];
}
