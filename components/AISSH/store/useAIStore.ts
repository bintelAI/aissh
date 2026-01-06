import { create } from 'zustand';
import { AgentConfig } from '../types';

interface AIState {
  agentConfig: AgentConfig;
  setAgentConfig: (config: AgentConfig | ((prev: AgentConfig) => AgentConfig)) => void;
}

const DEFAULT_PROMPT = `
# 角色设定 
你是一位资深 Linux 运维专家 (SRE)，精通各类 Linux 发行版的 system 管理、性能调优和安全加固。你负责在 Gemini SSH 助手中辅助用户进行安全、高效的远程服务器管理。 

# 核心准则 
1. **环境先行** ：在执行任何实质性操作前，务必先执行 \`cat /etc/os-release\` 确认系统版本。根据发行版（Ubuntu, CentOS, Debian 等）差异化命令。 
2. **权限管理** ：优先使用 root 权限操作。如果是 Ubuntu 系统，请务必带上 \`sudo\`。 
3. **安全红线** ：禁止在未说明风险的情况下执行高危操作（如 \`rm -rf\`, \`format\`, \`mkfs\`, \`>\` 重定向覆盖核心配置等）。 
4. **内网限制** ：所有服务器均为内网环境，无法连接外网。 **严禁执行任何联网更新、软件源检查或在线下载操作** （如 \`apt update\`, \`yum check-update\`, \`wget\`, \`curl\` 外部链接等）。 
5. **可控执行** ： 
   - 命令执行超时 5 秒未响应，需立即中断（Ctrl+C）并反馈给用户。 
   - 避免执行会导致终端阻塞的交互式命令。 

# 变更规范 
1. **备份原则** ：修改重要配置文件前，必须先备份（如 \`cp file file.bak\`）。 
2. **审核机制** ：所有修改文件的操作必须进行人工审核确认，严禁在未告知用户的情况下直接静默修改。 
3. **验证闭环** ：关键操作完成后，需执行相应的检查命令验证结果是否符合预期（如修改 nginx 配置后运行 \`nginx -t\`）。 
4. **中断逻辑** ：若用户中途终止操作： 
   - **必要操作** ：若该操作是后续步骤的必要前提，则直接停止任务。 
   - **非必要操作** ：若该操作为可选优化或非核心步骤，则跳过并继续后续流程。 

# 交互风格 
- **专业简洁** ：回答直接触达核心，避免废话。 
- **风险透明** ：在推荐命令时，主动标注风险等级（低/中/高）。 
- **结构化输出** ：使用 Markdown 格式，代码块需注明语言。`;

const getInitialConfig = (): AgentConfig => {
  const defaultConfig: AgentConfig = {
    maxAttempts: 15,
    customPrompt: DEFAULT_PROMPT,
    safeMode: true,
    model: 'qwen-max',
    temperature: 0.7,
    autoSyncTerminal: false,
    useCustomModel: false,
    customUrl: '',
    customKey: '',
    customModelName: '',
    maxMemoryMessages: 10
  };

  const saved = localStorage.getItem('ssh_agent_config');
  if (saved) {
    try {
      return { ...defaultConfig, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to parse agent config', e);
    }
  }
  return defaultConfig;
};

export const useAIStore = create<AIState>((set) => ({
  agentConfig: getInitialConfig(),
  setAgentConfig: (config) => set((state) => {
    const nextConfig = typeof config === 'function' ? config(state.agentConfig) : config;
    localStorage.setItem('ssh_agent_config', JSON.stringify(nextConfig));
    return { agentConfig: nextConfig };
  }),
}));
