import { PromptNode, HighlightRule } from '../types';

/**
 * 提示语整合服务
 * 负责将多个选中的提示语整合成最终的 System Prompt
 */

export interface MergedPromptResult {
  content: string;
  allRules: HighlightRule[];
  selectedPrompts: PromptNode[];
}

/**
 * 根据选中的提示语ID列表，从树形结构中提取提示语节点
 */
export const getSelectedPrompts = (
  selectedIds: string[],
  promptTree: PromptNode[]
): PromptNode[] => {
  return selectedIds
    .map(id => promptTree.find(node => node.id === id))
    .filter((node): node is PromptNode => 
      node !== undefined && node.type === 'prompt'
    );
};

/**
 * 整合多个提示语的内容
 */
export const mergePromptContent = (prompts: PromptNode[]): string => {
  if (prompts.length === 0) {
    return '';
  }

  if (prompts.length === 1) {
    const p = prompts[0];
    return `
[设备配置信息]
- 类型名称: ${p.name}
- 设备标识: ${p.deviceType || 'custom'}
- 核心指令规范: 
${p.prompt || ''}
`;
  }

  // 多个提示语整合
  const sections = prompts.map((p, index) => `
--- 配置 ${index + 1}: ${p.name} ---
- 设备标识: ${p.deviceType || 'custom'}
- 核心指令规范: 
${p.prompt || ''}
`);

  return `
[多设备配置信息 - 共 ${prompts.length} 个配置]
${sections.join('\n')}

[整合说明]
以上配置需要综合考虑，在执行命令时请结合所有设备的特性规范。
当不同配置之间存在冲突时，请优先遵循更严格的限制条件。
`;
};

/**
 * 整合所有选中提示语的高亮规则
 */
export const mergeHighlightRules = (prompts: PromptNode[]): HighlightRule[] => {
  const allRules: HighlightRule[] = [];
  const seenPatterns = new Set<string>();

  prompts.forEach(prompt => {
    if (prompt.rules && prompt.rules.length > 0) {
      prompt.rules.forEach(rule => {
        // 去重：相同 pattern 的规则只保留第一个
        if (!seenPatterns.has(rule.pattern)) {
          seenPatterns.add(rule.pattern);
          allRules.push(rule);
        }
      });
    }
  });

  return allRules;
};

/**
 * 生成设备类型标识列表
 */
export const generateDeviceTypeList = (prompts: PromptNode[]): string => {
  if (prompts.length === 0) return 'unknown';
  if (prompts.length === 1) return prompts[0].deviceType || 'custom';
  return prompts.map(p => p.deviceType || 'custom').join(', ');
};

/**
 * 主函数：整合提示语
 * @param selectedIds 选中的提示语ID列表
 * @param promptTree 提示语树形结构
 * @returns 整合后的结果
 */
export const mergePrompts = (
  selectedIds: string[],
  promptTree: PromptNode[]
): MergedPromptResult => {
  const selectedPrompts = getSelectedPrompts(selectedIds, promptTree);
  
  return {
    content: mergePromptContent(selectedPrompts),
    allRules: mergeHighlightRules(selectedPrompts),
    selectedPrompts
  };
};

/**
 * 获取单个提示语的格式化内容（兼容旧版）
 */
export const formatSinglePrompt = (prompt: PromptNode): string => {
  if (prompt.type !== 'prompt') return '';
  
  return `
[设备配置信息]
- 类型名称: ${prompt.name}
- 设备标识: ${prompt.deviceType || 'custom'}
- 核心指令规范: 
${prompt.prompt || ''}
`;
};

/**
 * 验证提示语选择是否有效
 */
export const validatePromptSelection = (
  selectedIds: string[],
  promptTree: PromptNode[]
): { valid: boolean; message?: string } => {
  if (selectedIds.length === 0) {
    return { valid: false, message: '请至少选择一个提示语配置' };
  }

  const validPrompts = getSelectedPrompts(selectedIds, promptTree);
  
  if (validPrompts.length === 0) {
    return { valid: false, message: '选中的提示语配置无效' };
  }

  if (validPrompts.length !== selectedIds.length) {
    const invalidCount = selectedIds.length - validPrompts.length;
    return { 
      valid: true, 
      message: `有 ${invalidCount} 个选中的配置未找到` 
    };
  }

  return { valid: true };
};

/**
 * 对选中的提示语进行排序
 */
export const sortSelectedPrompts = (
  selectedIds: string[],
  promptTree: PromptNode[],
  order: 'original' | 'name' | 'deviceType' = 'original'
): string[] => {
  const prompts = getSelectedPrompts(selectedIds, promptTree);
  
  switch (order) {
    case 'name':
      prompts.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'deviceType':
      prompts.sort((a, b) => 
        (a.deviceType || '').localeCompare(b.deviceType || '')
      );
      break;
    case 'original':
    default:
      // 保持原有顺序
      break;
  }
  
  return prompts.map(p => p.id);
};
