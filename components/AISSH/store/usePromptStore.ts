import { create } from 'zustand';
import { PromptNode, PromptNodeType, HighlightRule } from '../types';

// 默认树形结构
const defaultTree: PromptNode[] = [
  {
    id: 'folder-default',
    name: '默认配置',
    type: 'folder',
    parentId: null,
    order: 0,
    isExpanded: true
  },
  {
    id: 'p-linux',
    name: '通用 Linux 配置',
    type: 'prompt',
    parentId: 'folder-default',
    order: 0,
    deviceType: 'linux',
    prompt:
      '你是在 Linux 服务器环境下执行操作，所有命令需兼容常见发行版。遵循安全与备份原则，禁止未经确认的破坏性命令。',
    rules: [
      { id: 'r-err', pattern: '(error|failed|fatal|critical)', color: 'red', remark: '错误' },
      { id: 'r-warn', pattern: '(warn|warning)', color: 'orange', remark: '警告' },
      { id: 'r-ok', pattern: '(success|ok|ready|passed)', color: 'green', remark: '成功' },
      { id: 'r-info', pattern: '(info|notice)', color: 'cyan', remark: '信息' }
    ]
  },
  {
    id: 'folder-network',
    name: '网络设备',
    type: 'folder',
    parentId: null,
    order: 1,
    isExpanded: true
  },
  {
    id: 'p-cisco',
    name: '思科网络设备',
    type: 'prompt',
    parentId: 'folder-network',
    order: 0,
    deviceType: 'cisco',
    prompt:
      `
      你是思科网络专家，专门负责诊断与优化思科路由、交换、无线及数据中心产品。  
擅长使用  
\`show version\`、\`show interface\`、\`show ip route\`、\`show cdp neighbors\`、\`show spanning-tree\`、\`show vlan\`、\`show mac address-table\`、\`show ip arp\`、\`show etherchannel summary\`、\`show ip bgp\`、\`show ip ospf neighbor\`、\`show inventory\`、\`show environment\`、\`show logging\`、\`show processes cpu sorted\`、\`show platform hardware\`、\`show redundancy\`、\`dir all-filesystems\`、\`show tech-support\`  
等命令快速定位端口、VLAN、STP、路由、PoE、堆叠、冗余、硬件及性能类故障。

### 安全红线
禁止在未充分说明风险并取得用户书面确认的情况下执行任何高危操作，包括但不限于：
- \`write erase\` / \`erase startup-config\`
- \`reload\` / \`reload in\` / \`reload at\`
- \`no vlan 1\` 或批量删除 VLAN
- \`clear ip route *\`、\`clear ip bgp *\` 重置路由表或 BGP 会话
- \`debug all\`、\`debug ip packet detail\` 等全开调试
- \`archive download-sw /overwrite\` 强制覆盖 IOS/IOS-XE
- \`request platform software package install\` 强制升级或降级
- \`config-register 0x2142\` 跳过配置启动
- 任何带 \`force\`、\`reset\`、\`shutdown\`、\`delete /force\` 等关键字的命令

> 若必须执行，须提前输出完整回滚方案与业务影响评估，并让用户二次确认 **"已知晓风险并同意继续"** 后方可操作。
      `,
    rules: [
      { id: 'r-conf', pattern: '(configure terminal|conf t)', color: 'violet', remark: '进入配置模式' },
      { id: 'r-int', pattern: '(interface\\s+\\S+)', color: 'blue', remark: '接口配置' },
      { id: 'r-show', pattern: '\\bshow\\b', color: 'cyan', remark: '查看命令' }
    ]
  },
  {
    id: 'p-san',
    name: '博科光交',
    type: 'prompt',
    parentId: 'folder-network',
    order: 1,
    deviceType: 'san',
    prompt:
      ` 
你是博科 SAN 专家，专门用于分析博科光纤交换机。  
擅长使用  
\`switchshow\`、\`zoneshow\`、\`sfpshow\`、\`cfgshow\`、\`porterrshow\`、\`supportshow\`、\`fabricshow\`、\`nsshow\`、\`nsallshow\`、\`portcfgshow\`、\`portstatsshow\`、\`hashow\`、\`errdump\`、\`portlogdump\`  
等命令快速定位与排查 Zone、光模块、端口、Fabric、Name Server、HA、性能及日志类故障。

### 安全红线
禁止在未充分说明风险并取得用户书面确认的情况下执行任何高危操作，包括但不限于：
- \`switchdisable\` / \`portdisable\`
- \`cfgdisable\` / \`cfgclear\` / \`cfgsave\` 覆盖生效配置
- \`configupload\` / \`configdownload\` 重定向或覆盖核心配置
- \`firmwaredownload\` 升级或降级系统
- \`supportsave\` 覆盖已有日志仓库
- \`portcfgdefault\` / \`switchcfgdefault\` 恢复出厂默认
- 任何带 \`force\`、\`clear\`、\`reset\`、\`kill\` 等关键字的命令

> 若必须执行，须提前输出完整回滚方案与业务影响评估，并让用户二次确认 **"已知晓风险并同意继续"** 后方可操作。
      
      `,
    rules: [
      { id: 'r-conf', pattern: '(Disabled|No_Module)', color: 'violet', remark: '模块' },
      { id: 'r-int', pattern: '(No_Sync)', color: 'red', remark: '错误' },
      { id: 'r-show', pattern: '(Online)', color: 'blue', remark: '状态' }
    ]
  }
];

// 工具函数：获取所有提示语节点（扁平化）
export const getAllPromptNodes = (tree: PromptNode[]): PromptNode[] => {
  const result: PromptNode[] = [];
  const traverse = (nodes: PromptNode[]) => {
    nodes.forEach(node => {
      if (node.type === 'prompt') {
        result.push(node);
      }
    });
  };
  traverse(tree);
  return result;
};

// 工具函数：根据ID查找节点
export const findNodeById = (tree: PromptNode[], id: string): PromptNode | null => {
  for (const node of tree) {
    if (node.id === id) return node;
  }
  return null;
};

// 工具函数：获取子节点
export const getChildNodes = (tree: PromptNode[], parentId: string | null): PromptNode[] => {
  return tree
    .filter(node => node.parentId === parentId)
    .sort((a, b) => a.order - b.order);
};

// 工具函数：生成唯一ID
const generateId = (prefix: string = 'node'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

interface PromptStoreState {
  promptTree: PromptNode[];
  selectedPromptIds: string[];
}

interface PromptStoreActions {
  // 树形结构操作
  setPromptTree: (tree: PromptNode[] | ((prev: PromptNode[]) => PromptNode[])) => void;
  addNode: (node: Omit<PromptNode, 'id' | 'order' | 'parentId'>, parentId?: string | null) => void;
  updateNode: (id: string, data: Partial<PromptNode>) => void;
  deleteNode: (id: string) => void;
  moveNode: (id: string, newParentId: string | null, newOrder?: number) => void;
  toggleFolder: (id: string) => void;

  // 多选操作
  setSelectedPromptIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  togglePromptSelection: (id: string) => void;
  selectPrompt: (id: string) => void;
  deselectPrompt: (id: string) => void;

  // 高亮规则操作
  addRule: (promptId: string, rule: Omit<HighlightRule, 'id'>) => void;
  updateRule: (promptId: string, ruleId: string, data: Partial<HighlightRule>) => void;
  deleteRule: (promptId: string, ruleId: string) => void;

  // 获取整合后的提示语
  getMergedPrompt: () => string;
  getSelectedPrompts: () => PromptNode[];
  hydrateConfiguration: (promptTree: PromptNode[], selectedPromptIds: string[]) => void;
}

export const usePromptStore = create<PromptStoreState & PromptStoreActions>((set, get) => ({
  promptTree: defaultTree,
  selectedPromptIds: ['p-linux'],

  // ============ 树形结构操作 ============

  setPromptTree: (tree) =>
    set((state) => {
      const next = typeof tree === 'function' ? tree(state.promptTree) : tree;
      return { promptTree: next };
    }),

  addNode: (nodeData, parentId = null) =>
    set((state) => {
      const siblings = state.promptTree.filter(n => n.parentId === parentId);
      const newNode: PromptNode = {
        ...nodeData,
        id: generateId(nodeData.type),
        parentId,
        order: siblings.length
      } as PromptNode;

      const newTree = [...state.promptTree, newNode];
      return { promptTree: newTree };
    }),

  updateNode: (id, data) =>
    set((state) => {
      const newTree = state.promptTree.map((node) =>
        node.id === id ? { ...node, ...data } : node
      );
      return { promptTree: newTree };
    }),

  deleteNode: (id) =>
    set((state) => {
      // 递归删除节点及其子节点
      const idsToDelete = new Set<string>();
      const collectIds = (nodeId: string) => {
        idsToDelete.add(nodeId);
        state.promptTree
          .filter(n => n.parentId === nodeId)
          .forEach(child => collectIds(child.id));
      };
      collectIds(id);

      const newTree = state.promptTree.filter((node) => !idsToDelete.has(node.id));

      // 更新选中状态
      const newSelectedIds = state.selectedPromptIds.filter(sid => !idsToDelete.has(sid));

      return { promptTree: newTree, selectedPromptIds: newSelectedIds };
    }),

  moveNode: (id, newParentId, newOrder) =>
    set((state) => {
      const node = state.promptTree.find(n => n.id === id);
      if (!node) return state;

      // 检查是否移动到子节点中（防止循环）
      const isDescendant = (parentId: string, childId: string): boolean => {
        if (parentId === childId) return true;
        const children = state.promptTree.filter(n => n.parentId === childId);
        return children.some(child => isDescendant(parentId, child.id));
      };

      if (newParentId && isDescendant(id, newParentId)) {
        console.error('Cannot move a node to its own descendant');
        return state;
      }

      let newTree = state.promptTree.map((n) => {
        if (n.id === id) {
          return { ...n, parentId: newParentId, order: newOrder ?? n.order };
        }
        return n;
      });

      // 重新排序同级的其他节点
      if (newOrder !== undefined) {
        const siblings = newTree
          .filter(n => n.parentId === newParentId && n.id !== id)
          .sort((a, b) => a.order - b.order);

        siblings.splice(newOrder, 0, newTree.find(n => n.id === id)!);

        siblings.forEach((sibling, index) => {
          const idx = newTree.findIndex(n => n.id === sibling.id);
          if (idx !== -1) {
            newTree[idx] = { ...newTree[idx], order: index };
          }
        });
      }

      return { promptTree: newTree };
    }),

  toggleFolder: (id) =>
    set((state) => {
      const newTree = state.promptTree.map((node) =>
        node.id === id ? { ...node, isExpanded: !node.isExpanded } : node
      );
      return { promptTree: newTree };
    }),

  // ============ 多选操作 ============

  setSelectedPromptIds: (ids) =>
    set((state) => {
      const next = typeof ids === 'function' ? ids(state.selectedPromptIds) : ids;
      return { selectedPromptIds: next };
    }),

  togglePromptSelection: (id) =>
    set((state) => {
      const node = state.promptTree.find(n => n.id === id);
      if (!node || node.type !== 'prompt') return state;

      const newSelectedIds = state.selectedPromptIds.includes(id)
        ? state.selectedPromptIds.filter(sid => sid !== id)
        : [...state.selectedPromptIds, id];

      return { selectedPromptIds: newSelectedIds };
    }),

  selectPrompt: (id) =>
    set((state) => {
      const node = state.promptTree.find(n => n.id === id);
      if (!node || node.type !== 'prompt') return state;

      if (state.selectedPromptIds.includes(id)) return state;

      const newSelectedIds = [...state.selectedPromptIds, id];
      return { selectedPromptIds: newSelectedIds };
    }),

  deselectPrompt: (id) =>
    set((state) => {
      const newSelectedIds = state.selectedPromptIds.filter(sid => sid !== id);
      return { selectedPromptIds: newSelectedIds };
    }),

  // ============ 高亮规则操作 ============

  addRule: (promptId, rule) =>
    set((state) => {
      const newTree = state.promptTree.map((node) => {
        if (node.id === promptId && node.type === 'prompt') {
          const newRule: HighlightRule = {
            ...rule,
            id: generateId('rule')
          };
          return {
            ...node,
            rules: [...(node.rules || []), newRule]
          };
        }
        return node;
      });
      return { promptTree: newTree };
    }),

  updateRule: (promptId, ruleId, data) =>
    set((state) => {
      const newTree = state.promptTree.map((node) => {
        if (node.id === promptId && node.type === 'prompt') {
          return {
            ...node,
            rules: node.rules?.map((rule) =>
              rule.id === ruleId ? { ...rule, ...data } : rule
            ) || []
          };
        }
        return node;
      });
      return { promptTree: newTree };
    }),

  deleteRule: (promptId, ruleId) =>
    set((state) => {
      const newTree = state.promptTree.map((node) => {
        if (node.id === promptId && node.type === 'prompt') {
          return {
            ...node,
            rules: node.rules?.filter((rule) => rule.id !== ruleId) || []
          };
        }
        return node;
      });
      return { promptTree: newTree };
    }),

  hydrateConfiguration: (promptTree, selectedPromptIds) => set({ promptTree, selectedPromptIds }),

  // ============ 获取整合后的提示语 ============

  getSelectedPrompts: () => {
    const state = get();
    return state.selectedPromptIds
      .map(id => findNodeById(state.promptTree, id))
      .filter((node): node is PromptNode => node !== null && node.type === 'prompt');
  },

  getMergedPrompt: () => {
    const state = get();
    const selectedPrompts = state.selectedPromptIds
      .map(id => findNodeById(state.promptTree, id))
      .filter((node): node is PromptNode => node !== null && node.type === 'prompt');

    if (selectedPrompts.length === 0) return '';
    if (selectedPrompts.length === 1) {
      const p = selectedPrompts[0];
      return `
[设备配置信息]
- 类型名称: ${p.name}
- 设备标识: ${p.deviceType || 'custom'}
- 核心指令规范: 
${p.prompt || ''}
`;
    }

    // 多个提示语整合
    const sections = selectedPrompts.map((p, index) => `
--- 配置 ${index + 1}: ${p.name} ---
- 设备标识: ${p.deviceType || 'custom'}
- 核心指令规范: 
${p.prompt || ''}
`);

    return `
[多设备配置信息 - 共 ${selectedPrompts.length} 个配置]
${sections.join('\n')}

[整合说明]
以上配置需要综合考虑，在执行命令时请结合所有设备的特性规范。
`;
  }
}));

// 兼容旧版导出
export const usePromptStoreLegacy = usePromptStore;
