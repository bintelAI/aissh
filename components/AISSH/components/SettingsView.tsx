import { BrainCircuit, FolderTree, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { NeuralCoreConfigPanel } from './NeuralCoreConfigPanel';
import { PromptConfigEditor } from './PromptConfigModal';

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<'core' | 'prompts'>('core');

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-sci-obsidian/20">
      <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center border border-sci-cyan/35 bg-sci-cyan/10 text-sci-cyan"><Settings2 size={18} /></div>
        <div><h1 className="text-sm font-bold tracking-widest text-sci-text">设置</h1><p className="mt-1 text-[10px] text-sci-dim">神经核心与设备类型提示语配置</p></div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <nav className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-black/15 p-3 md:w-48 md:flex-col md:overflow-visible md:border-b-0 md:border-r" aria-label="设置分类">
          <SettingsTab active={activeTab === 'core'} icon={<BrainCircuit size={16} />} label="神经核心配置" onClick={() => setActiveTab('core')} />
          <SettingsTab active={activeTab === 'prompts'} icon={<FolderTree size={16} />} label="设备类型提示语配置" onClick={() => setActiveTab('prompts')} />
        </nav>
        <article className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {activeTab === 'core' ? <NeuralCoreConfigPanel /> : <PromptConfigEditor />}
        </article>
      </div>
    </section>
  );
}

function SettingsTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-12 items-center gap-2 border px-3 py-2 text-left text-[11px] transition-colors ${active ? 'border-sci-cyan/50 bg-sci-cyan/10 text-sci-cyan' : 'border-transparent text-sci-dim hover:border-white/10 hover:bg-white/5 hover:text-sci-text'}`}><span className="flex-shrink-0">{icon}</span><span className="leading-4">{label}</span></button>;
}
