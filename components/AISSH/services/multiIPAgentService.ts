import { useMultiIPStore } from '../store/useMultiIPStore';
import { useAIStore } from '../store/useAIStore';
import { MultiIPOperation, ExecutionStep, AIDecision, ExecutionMode, ServerExecutionResult } from '../types/multiIP';
import { SelectedIP } from '../components/IPSelectorInput';
import { sshManager } from './sshService';
import { chatWithAI } from './geminiService';

export interface MultiIPAgentConfig {
  maxRetries: number;
  timeout: number;
  continueOnError: boolean;
  enableSmartDecision: boolean;
  autoConfirmLowRisk: boolean;
  riskThreshold: 'low' | 'medium' | 'high';
}

/**
 * 多 IP Agent 服务 - 采用传统 Agent 链式思维模式
 * 
 * 执行流程:
 * 1. 思考 (Thought): AI 分析当前状态，决定下一步行动
 * 2. 执行 (Action): 在多台服务器上执行命令
 * 3. 观察 (Observation): 收集所有服务器的执行结果
 * 4. 决策 (Decision): AI 分析结果，决定下一步
 * 
 * 循环直到任务完成
 */
export class MultiIPAgentService {
  private config: MultiIPAgentConfig;
  private abortController: AbortController | null = null;
  private currentOperationId: string | null = null;

  constructor(config: Partial<MultiIPAgentConfig> = {}) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      continueOnError: true,
      enableSmartDecision: true,
      autoConfirmLowRisk: false,
      riskThreshold: 'medium',
      ...config
    };
  }

  /**
   * 启动多 IP Agent 任务 - 链式执行模式
   */
  async executeTask(
    operationId: string,
    userInput: string,
    onProgress?: (step: ExecutionStep, operation: MultiIPOperation) => void
  ): Promise<void> {
    this.currentOperationId = operationId;
    this.abortController = new AbortController();

    const store = useMultiIPStore.getState();
    const operation = store.getOperation(operationId);

    if (!operation) {
      throw new Error(`操作 ${operationId} 不存在`);
    }

    try {
      store.startOperation(operationId);

      // 初始化执行上下文
      const context: ExecutionContext = {
        userGoal: userInput,
        executionHistory: [],
        serverStatuses: new Map(),
        currentStep: 0,
        isCompleted: false
      };

      // 链式执行循环
      while (!context.isCompleted && !this.abortController?.signal.aborted) {
        const stepNumber = context.currentStep + 1;

        // === 1. 思考阶段 (Thought) ===
        const thought = await this.think(operationId, context);
        
        // 添加步骤到 store
        store.addStep(operationId, thought.command || '分析中...', thought.reasoning);

        // === 2. 执行阶段 (Action) ===
        if (thought.command) {
          await this.executeOnAllServers(operationId, stepNumber, thought.command, operation.executionMode);
        }

        // === 3. 观察阶段 (Observation) ===
        const observation = await this.observe(operationId, stepNumber);

        // 更新进度
        if (onProgress) {
          const updatedOperation = store.getOperation(operationId);
          const currentStep = updatedOperation?.steps.find(s => s.stepNumber === stepNumber);
          if (currentStep && updatedOperation) {
            onProgress(currentStep, updatedOperation);
          }
        }

        // === 4. 决策阶段 (Decision) ===
        const decision = await this.decide(operationId, context, thought, observation);

        // 更新执行历史
        context.executionHistory.push({
          stepNumber,
          thought,
          observation,
          decision
        });

        // 检查是否完成
        if (decision.nextAction === 'complete') {
          context.isCompleted = true;
          store.updateStepStatus(operationId, stepNumber, 'completed');
        } else if (decision.nextAction === 'abort') {
          store.cancelOperation(operationId);
          break;
        } else if (decision.nextAction === 'skip') {
          // 跳过当前步骤，标记为完成并继续下一步
          store.updateStepStatus(operationId, stepNumber, 'completed');
          context.currentStep++;
        } else if (decision.nextAction === 'retry') {
          // 重试当前步骤，不增加步骤计数
          store.updateStepStatus(operationId, stepNumber, 'error');
          // 记录重试次数，防止无限重试
          const retryCount = context.executionHistory.filter(h => 
            h.stepNumber === stepNumber && h.decision.nextAction === 'retry'
          ).length;
          if (retryCount >= 1) {
            // 已经重试过一次，强制跳过
            console.log(`[MultiIP] Step ${stepNumber} already retried, forcing skip`);
            context.currentStep++;
          }
        } else {
          // continue - 正常继续下一步
          store.updateStepStatus(operationId, stepNumber, 'completed');
          context.currentStep++;
        }

        // 处理需要确认的情况
        if (decision.requiresConfirmation) {
          const confirmed = await this.waitForConfirmation(operationId, stepNumber, decision);
          if (!confirmed) {
            store.cancelOperation(operationId);
            break;
          }
        }
      }

      // 生成总结
      await this.generateSummary(operationId, context);

    } catch (error) {
      console.error('MultiIP Agent Error:', error);
      store.cancelOperation(operationId);
      throw error;
    }
  }

  /**
   * 思考阶段 - AI 分析当前状态并决定下一步行动
   */
  private async think(operationId: string, context: ExecutionContext): Promise<AgentThought> {
    const store = useMultiIPStore.getState();
    const operation = store.getOperation(operationId);

    if (!operation) {
      return { reasoning: '操作不存在', command: '', shouldComplete: true, riskLevel: 'low', requiresConfirmation: false };
    }

    // 构建思考提示
    const historyText = context.executionHistory.length > 0
      ? context.executionHistory.map(h => `
步骤 ${h.stepNumber}:
思考: ${h.thought.reasoning}
执行: ${h.thought.command || '无'}
结果: ${h.observation.summary}
`).join('\n---\n')
      : '无执行历史';

    // 检查执行步骤数，防止死循环 - 使用神经核心配置中的最大运行次数
    const { agentConfig } = useAIStore.getState();
    const maxSteps = agentConfig.maxAttempts || 15;
    const shouldForceComplete = context.currentStep >= maxSteps;

    const prompt = `
你是一位专业的多服务器运维 Agent。请分析当前任务状态并决定下一步行动。

## 任务目标
${context.userGoal || '分析并优化多台服务器的状态'}

## 目标服务器 (${operation.targetServers.length} 台)
${operation.targetServers.map(s => `- ${s.name} (${s.ip})`).join('\n')}

## 执行历史
${historyText}

## 当前状态
- 已执行步骤: ${context.currentStep}
- 最大允许步骤: ${maxSteps}
- 执行模式: ${operation.executionMode}

## 重要说明
**命令执行方式**: 系统已经通过 SSH 连接到所有目标服务器，你只需要提供要在服务器上执行的 shell 命令即可。
**不要**使用 ssh 命令连接服务器（如: ssh user@host 'command'），直接提供命令本身（如: top -b -n 1）。

## 防死循环规则（必须遵守）
1. **步骤限制**: 最多执行 ${maxSteps} 个步骤，当前已执行 ${context.currentStep} 步
2. **无法处理时跳过**: 如果某个步骤执行失败或无法处理，应该跳过该步骤继续下一步，而不是重复尝试
3. **避免重复命令**: 不要连续执行相同的命令，如果上一步已经执行过类似命令且没有新进展，应该完成任务
4. **合理终止**: 当任务目标基本达成或无法继续推进时，应该设置 shouldComplete 为 true
5. **错误处理**: 如果多台服务器都执行失败，分析原因后决定是跳过还是终止任务

请决定下一步行动，以 JSON 格式返回:
{
  "reasoning": "详细分析当前状态和下一步计划",
  "command": "要在所有服务器上执行的具体命令（直接命令，不需要ssh前缀）",
  "shouldComplete": false,
  "riskLevel": "low/medium/high",
  "requiresConfirmation": false
}

注意:
1. 如果任务已完成或无法继续推进，设置 shouldComplete 为 true
2. 如果需要执行命令，提供具体的 shell 命令（直接命令，不要ssh连接）
3. 评估操作风险等级
4. 高风险操作需要用户确认
5. 示例正确命令: "top -b -n 1", "df -h", "ps aux | grep nginx"
6. 示例错误命令: "ssh root@host 'top -b -n 1'"
7. **关键**: 如果上一步执行失败或无进展，不要重复相同操作，应该尝试其他方法或完成任务
${shouldForceComplete ? '\n8. **强制**: 已达到最大步骤数，必须设置 shouldComplete 为 true 并总结当前完成情况' : ''}
`;

    try {
      const response = await chatWithAI(prompt, []);
      return this.parseThought(response);
    } catch (error) {
      console.error('Think phase error:', error);
      return {
        reasoning: '思考过程出错，使用默认命令',
        command: 'echo "继续执行"',
        shouldComplete: false,
        riskLevel: 'low',
        requiresConfirmation: false
      };
    }
  }

  /**
   * 在所有服务器上执行命令
   */
  private async executeOnAllServers(
    operationId: string,
    stepNumber: number,
    command: string,
    mode: ExecutionMode
  ): Promise<void> {
    const store = useMultiIPStore.getState();
    const operation = store.getOperation(operationId);
    const step = operation?.steps.find(s => s.stepNumber === stepNumber);

    if (!operation || !step) return;

    // 根据执行模式选择策略
    switch (mode) {
      case 'parallel':
        await this.executeParallel(operationId, stepNumber, command);
        break;
      case 'sequential':
        await this.executeSequential(operationId, stepNumber, command);
        break;
      case 'adaptive':
        await this.executeAdaptive(operationId, stepNumber, command);
        break;
    }
  }

  /**
   * 并行执行
   */
  private async executeParallel(
    operationId: string,
    stepNumber: number,
    command: string
  ): Promise<void> {
    const store = useMultiIPStore.getState();
    const step = store.getOperation(operationId)?.steps.find(s => s.stepNumber === stepNumber);
    if (!step) return;

    const promises = step.serverResults.map(async (serverResult) => {
      if (this.abortController?.signal.aborted) return;

      store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
        status: 'running',
        startTime: new Date()
      });

      try {
        const output = await sshManager.executeCommand(command, serverResult.serverId);
        const isError = output.startsWith('Error:') || output.includes('error') || output.includes('failed');

        store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
          status: isError ? 'error' : 'success',
          output,
          endTime: new Date(),
          duration: Date.now() - (serverResult.startTime?.getTime() || Date.now())
        });
      } catch (error) {
        store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
          status: 'error',
          output: '',
          error: error instanceof Error ? error.message : '执行失败',
          endTime: new Date()
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * 串行执行
   */
  private async executeSequential(
    operationId: string,
    stepNumber: number,
    command: string
  ): Promise<void> {
    const store = useMultiIPStore.getState();
    const step = store.getOperation(operationId)?.steps.find(s => s.stepNumber === stepNumber);
    if (!step) return;

    for (const serverResult of step.serverResults) {
      if (this.abortController?.signal.aborted) break;

      store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
        status: 'running',
        startTime: new Date()
      });

      try {
        const output = await sshManager.executeCommand(command, serverResult.serverId);
        const isError = output.startsWith('Error:') || output.includes('error') || output.includes('failed');

        store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
          status: isError ? 'error' : 'success',
          output,
          endTime: new Date(),
          duration: Date.now() - (serverResult.startTime?.getTime() || Date.now())
        });

        if (isError && !this.config.continueOnError) break;
      } catch (error) {
        store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
          status: 'error',
          output: '',
          error: error instanceof Error ? error.message : '执行失败',
          endTime: new Date()
        });

        if (!this.config.continueOnError) break;
      }
    }
  }

  /**
   * 自适应执行 - 先并行，失败的重试
   */
  private async executeAdaptive(
    operationId: string,
    stepNumber: number,
    command: string
  ): Promise<void> {
    // 先并行执行
    await this.executeParallel(operationId, stepNumber, command);

    const store = useMultiIPStore.getState();
    const step = store.getOperation(operationId)?.steps.find(s => s.stepNumber === stepNumber);
    if (!step) return;

    // 找出失败的服务器
    const failedServers = step.serverResults.filter(sr => sr.status === 'error');

    if (failedServers.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      for (const serverResult of failedServers) {
        if (this.abortController?.signal.aborted) break;

        store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
          status: 'running',
          startTime: new Date()
        });

        try {
          const output = await sshManager.executeCommand(command, serverResult.serverId);
          const isError = output.startsWith('Error:') || output.includes('error') || output.includes('failed');

          store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
            status: isError ? 'error' : 'success',
            output,
            endTime: new Date(),
            duration: Date.now() - (serverResult.startTime?.getTime() || Date.now())
          });
        } catch (error) {
          store.updateServerResult(operationId, stepNumber, serverResult.serverId, {
            status: 'error',
            output: '',
            error: error instanceof Error ? error.message : '重试失败',
            endTime: new Date()
          });
        }
      }
    }
  }

  /**
   * 观察阶段 - 收集并分析执行结果
   */
  private async observe(operationId: string, stepNumber: number): Promise<AgentObservation> {
    const store = useMultiIPStore.getState();
    const operation = store.getOperation(operationId);
    const step = operation?.steps.find(s => s.stepNumber === stepNumber);

    if (!operation || !step) {
      return { summary: '步骤不存在', serverResults: [], hasError: false };
    }

    // 构建观察结果
    const serverResults = step.serverResults.map(sr => ({
      serverId: sr.serverId,
      serverName: sr.serverName,
      ip: sr.ip,
      status: sr.status,
      output: sr.output,
      error: sr.error,
      duration: sr.duration
    }));

    const hasError = serverResults.some(sr => sr.status === 'error');
    const hasSuccess = serverResults.some(sr => sr.status === 'success');

    // 生成摘要
    const summary = `
执行结果统计:
- 成功: ${serverResults.filter(sr => sr.status === 'success').length} 台
- 失败: ${serverResults.filter(sr => sr.status === 'error').length} 台
- 总计: ${serverResults.length} 台
${hasError ? '注意: 部分服务器执行失败' : '所有服务器执行成功'}
`.trim();

    return {
      summary,
      serverResults,
      hasError,
      hasSuccess
    };
  }

  /**
   * 决策阶段 - AI 分析结果并决定下一步
   */
  private async decide(
    operationId: string,
    context: ExecutionContext,
    thought: AgentThought,
    observation: AgentObservation
  ): Promise<AgentDecision> {
    const store = useMultiIPStore.getState();
    const operation = store.getOperation(operationId);

    if (!operation) {
      return { nextAction: 'abort', reasoning: '操作不存在', requiresConfirmation: false };
    }

    // 如果思考阶段已经决定完成
    if (thought.shouldComplete) {
      return {
        nextAction: 'complete',
        reasoning: thought.reasoning,
        requiresConfirmation: false
      };
    }

    // 构建决策提示
    const resultsText = observation.serverResults.map(sr => `
服务器: ${sr.serverName} (${sr.ip})
状态: ${sr.status}
输出: ${sr.output.slice(0, 300)}${sr.output.length > 300 ? '...' : ''}
${sr.error ? `错误: ${sr.error}` : ''}
`).join('\n---\n');

    // 检查是否需要强制完成 - 使用神经核心配置中的最大运行次数
    const { agentConfig: decisionConfig } = useAIStore.getState();
    const maxSteps = decisionConfig.maxAttempts || 15;
    const shouldForceComplete = context.currentStep >= maxSteps;
    const hasMultipleFailures = context.executionHistory.filter(h => h.observation.hasError).length >= 3;

    const prompt = `
你是一位专业的多服务器运维 Agent。请分析执行结果并决定下一步行动。

## 任务目标
${context.userGoal}

## 上一步执行
命令: ${thought.command || '无'}
思考: ${thought.reasoning}

## 执行结果
${resultsText}

## 结果摘要
${observation.summary}

## 执行统计
- 已执行步骤: ${context.currentStep}
- 最大允许步骤: ${maxSteps}
- 历史失败次数: ${context.executionHistory.filter(h => h.observation.hasError).length}

请决定下一步行动，以 JSON 格式返回:
{
  "nextAction": "continue/complete/retry/abort/skip",
  "reasoning": "详细分析结果和决策理由",
  "requiresConfirmation": false,
  "riskLevel": "low/medium/high",
  "suggestions": ["建议1", "建议2"]
}

nextAction 说明:
- continue: 继续执行下一步（有明确进展时使用）
- complete: 任务已完成或无法继续推进（推荐在目标达成或遇到不可解决的问题时使用）
- retry: 需要重试当前步骤（仅在临时性错误如网络波动时使用，同一命令不要重试超过1次）
- abort: 中止任务（仅在严重错误或用户要求时使用）
- skip: 跳过当前步骤继续下一步（当前步骤无法完成但不影响整体任务时使用）

## 防死循环规则（必须遵守）
1. **步骤限制**: 最多执行 ${maxSteps} 个步骤，当前已执行 ${context.currentStep} 步
2. **避免重复重试**: 同一个命令不要重试超过1次，如果重试后仍然失败，选择 skip 或 complete
3. **失败处理**: ${hasMultipleFailures ? '已经多次失败，建议评估是否继续或完成任务' : '如果当前步骤失败，分析原因后选择 skip 或重试1次'}
4. **合理终止**: 当任务目标基本达成、无法继续推进或遇到无法解决的问题时，选择 complete
5. **跳过机制**: 如果某个步骤无法完成但不影响整体任务，选择 skip 而不是一直重试
${shouldForceComplete ? '\n6. **强制**: 已达到最大步骤数，必须选择 complete 并总结当前完成情况' : ''}

## 决策建议
- 如果上一步执行成功且有进展: continue
- 如果上一步执行失败是临时性问题: retry（仅限1次）
- 如果上一步执行失败且无法解决: skip 或 complete
- 如果任务目标已达成: complete
- 如果已达到最大步骤数: complete
`;

    try {
      const response = await chatWithAI(prompt, []);
      return this.parseDecision(response);
    } catch (error) {
      console.error('Decision phase error:', error);
      return {
        nextAction: observation.hasError ? 'abort' : 'complete',
        reasoning: '决策过程出错，根据执行结果自动判断',
        requiresConfirmation: false,
        riskLevel: 'medium'
      };
    }
  }

  /**
   * 等待用户确认
   */
  private async waitForConfirmation(
    operationId: string,
    stepNumber: number,
    decision: AgentDecision
  ): Promise<boolean> {
    const store = useMultiIPStore.getState();

    // 更新步骤状态为等待决策
    store.setAIDecision(operationId, stepNumber, {
      reasoning: decision.reasoning,
      nextAction: decision.nextAction as any,
      riskLevel: decision.riskLevel || 'medium',
      requiresConfirmation: true,
      suggestions: decision.suggestions
    });

    // TODO: 实现真正的用户确认对话框
    // 临时返回 true，实际应该等待用户点击确认
    return new Promise((resolve) => {
      // 模拟用户确认
      setTimeout(() => {
        store.confirmDecision(operationId, stepNumber, true);
        resolve(true);
      }, 1000);
    });
  }

  /**
   * 生成任务总结
   */
  private async generateSummary(operationId: string, context: ExecutionContext): Promise<void> {
    const store = useMultiIPStore.getState();
    const operation = store.getOperation(operationId);

    if (!operation) return;

    // 构建详细的执行历史，包含每台服务器的具体结果
    const executionHistory = context.executionHistory.map(h => {
      const serverDetails = h.observation.serverResults.map(sr => {
        const status = sr.status === 'success' ? '✅ 成功' : sr.status === 'error' ? '❌ 失败' : '⏳ 等待';
        const output = sr.output ? `\n    输出: ${sr.output.slice(0, 200)}${sr.output.length > 200 ? '...' : ''}` : '';
        const error = sr.error ? `\n    错误: ${sr.error}` : '';
        return `  - ${sr.serverName} (${sr.ip}): ${status}${output}${error}`;
      }).join('\n');

      return `
## 步骤 ${h.stepNumber}: ${h.thought.command || '无命令'}
**思考**: ${h.thought.reasoning}
**执行结果**:
${serverDetails}
**决策**: ${h.decision.nextAction} - ${h.decision.reasoning}
`;
    }).join('\n---\n');

    // 统计信息
    const totalSteps = context.executionHistory.length;
    const successfulSteps = context.executionHistory.filter(h => !h.observation.hasError).length;
    const failedSteps = context.executionHistory.filter(h => h.observation.hasError).length;
    const totalServers = operation.targetServers.length;

    // 收集所有错误
    const allErrors: string[] = [];
    context.executionHistory.forEach(h => {
      h.observation.serverResults.forEach(sr => {
        if (sr.error && !allErrors.includes(sr.error)) {
          allErrors.push(sr.error);
        }
      });
    });

    const prompt = `
你是一位专业的运维报告生成助手。请基于以下多服务器批量任务的执行详情，生成一份结构化的执行报告。

# 任务概览
- **任务目标**: ${context.userGoal}
- **执行模式**: ${operation.executionMode}
- **目标服务器**: ${totalServers} 台
- **执行步骤**: ${totalSteps} 步
- **成功步骤**: ${successfulSteps} 步
- **失败步骤**: ${failedSteps} 步

# 目标服务器列表
${operation.targetServers.map(s => `- ${s.name} (${s.ip})`).join('\n')}

# 执行详情
${executionHistory}

# 发现的问题
${allErrors.length > 0 ? allErrors.map((e, i) => `${i + 1}. ${e}`).join('\n') : '无明显错误'}

请生成一份结构化的 JSON 格式报告：

\`\`\`json
{
  "executiveSummary": "执行总结 - 用2-3句话概括整体执行情况",
  "detailedAnalysis": {
    "successRate": "成功率分析",
    "keyFindings": ["发现1", "发现2", "发现3"],
    "serverPerformance": "各服务器表现分析"
  },
  "issuesIdentified": [
    {
      "severity": "high/medium/low",
      "description": "问题描述",
      "affectedServers": ["服务器1", "服务器2"],
      "rootCause": "根本原因分析",
      "impact": "影响范围"
    }
  ],
  "recommendations": [
    {
      "priority": "high/medium/low",
      "category": "performance/security/reliability/maintenance",
      "description": "具体建议",
      "expectedBenefit": "预期收益",
      "implementation": "实施方法"
    }
  ],
  "nextSteps": [
    "建议的后续操作1",
    "建议的后续操作2"
  ],
  "riskAssessment": {
    "overallRisk": "low/medium/high",
    "riskFactors": ["风险因素1", "风险因素2"],
    "mitigationStrategies": ["缓解策略1", "缓解策略2"]
  }
}
\`\`\`

要求：
1. 分析要具体，引用实际执行中的问题和数据
2. 建议要可操作，包含实施方法
3. 问题要分类（性能/安全/可靠性/维护）
4. 风险评估要基于实际执行情况
`;

    try {
      const response = await chatWithAI(prompt, []);

      // 尝试解析 JSON 报告
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      let structuredReport: any = null;

      if (jsonMatch) {
        try {
          structuredReport = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse structured report:', e);
        }
      }

      // 生成格式化的 Markdown 报告
      const formattedReport = this.formatStructuredReport(structuredReport, context, operation);

      // 提取建议列表
      const recommendations = this.extractRecommendationsFromStructured(structuredReport);

      // 使用 completeOperation 方法完成操作
      store.completeOperation(operationId, formattedReport, recommendations);
    } catch (error) {
      console.error('Summary generation error:', error);
      // 即使生成总结失败，也要标记操作完成
      const fallbackReport = this.generateFallbackReport(context, operation);
      store.completeOperation(operationId, fallbackReport, []);
    }
  }

  /**
   * 格式化结构化报告为 Markdown
   */
  private formatStructuredReport(structured: any, context: ExecutionContext, operation: MultiIPOperation): string {
    if (!structured) {
      return this.generateFallbackReport(context, operation);
    }

    const lines: string[] = [];

    // 执行总结
    lines.push(`# 📊 执行报告`);
    lines.push('');
    lines.push(`## 📝 执行总结`);
    lines.push(structured.executiveSummary || '任务执行完成');
    lines.push('');

    // 详细分析
    if (structured.detailedAnalysis) {
      lines.push(`## 🔍 详细分析`);
      lines.push('');
      if (structured.detailedAnalysis.successRate) {
        lines.push(`**成功率**: ${structured.detailedAnalysis.successRate}`);
      }
      if (structured.detailedAnalysis.keyFindings?.length > 0) {
        lines.push('');
        lines.push(`**关键发现**:`);
        structured.detailedAnalysis.keyFindings.forEach((finding: string) => {
          lines.push(`- ${finding}`);
        });
      }
      if (structured.detailedAnalysis.serverPerformance) {
        lines.push('');
        lines.push(`**服务器表现**: ${structured.detailedAnalysis.serverPerformance}`);
      }
      lines.push('');
    }

    // 发现的问题
    if (structured.issuesIdentified?.length > 0) {
      lines.push(`## ⚠️ 发现的问题`);
      lines.push('');
      structured.issuesIdentified.forEach((issue: any, idx: number) => {
        const severityEmoji = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
        lines.push(`### ${severityEmoji} 问题 ${idx + 1}: ${issue.description || '未命名问题'}`);
        if (issue.severity) lines.push(`- **严重程度**: ${issue.severity}`);
        if (issue.affectedServers?.length > 0) {
          lines.push(`- **影响服务器**: ${issue.affectedServers.join(', ')}`);
        }
        if (issue.rootCause) lines.push(`- **根本原因**: ${issue.rootCause}`);
        if (issue.impact) lines.push(`- **影响范围**: ${issue.impact}`);
        lines.push('');
      });
    }

    // 优化建议
    if (structured.recommendations?.length > 0) {
      lines.push(`## 💡 优化建议`);
      lines.push('');
      structured.recommendations.forEach((rec: any, idx: number) => {
        const priorityEmoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`### ${priorityEmoji} 建议 ${idx + 1}: ${rec.description || '未命名建议'}`);
        if (rec.category) lines.push(`- **类别**: ${rec.category}`);
        if (rec.priority) lines.push(`- **优先级**: ${rec.priority}`);
        if (rec.expectedBenefit) lines.push(`- **预期收益**: ${rec.expectedBenefit}`);
        if (rec.implementation) lines.push(`- **实施方法**: ${rec.implementation}`);
        lines.push('');
      });
    }

    // 后续步骤
    if (structured.nextSteps?.length > 0) {
      lines.push(`## 🚀 后续步骤`);
      lines.push('');
      structured.nextSteps.forEach((step: string, idx: number) => {
        lines.push(`${idx + 1}. ${step}`);
      });
      lines.push('');
    }

    // 风险评估
    if (structured.riskAssessment) {
      lines.push(`## ⚡ 风险评估`);
      lines.push('');
      if (structured.riskAssessment.overallRisk) {
        const riskEmoji = structured.riskAssessment.overallRisk === 'high' ? '🔴' : structured.riskAssessment.overallRisk === 'medium' ? '🟡' : '🟢';
        lines.push(`**整体风险等级**: ${riskEmoji} ${structured.riskAssessment.overallRisk}`);
      }
      if (structured.riskAssessment.riskFactors?.length > 0) {
        lines.push('');
        lines.push(`**风险因素**:`);
        structured.riskAssessment.riskFactors.forEach((factor: string) => {
          lines.push(`- ${factor}`);
        });
      }
      if (structured.riskAssessment.mitigationStrategies?.length > 0) {
        lines.push('');
        lines.push(`**缓解策略**:`);
        structured.riskAssessment.mitigationStrategies.forEach((strategy: string) => {
          lines.push(`- ${strategy}`);
        });
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 从结构化报告中提取建议列表
   */
  private extractRecommendationsFromStructured(structured: any): string[] {
    if (!structured?.recommendations) return [];

    return structured.recommendations.map((rec: any) => {
      const parts: string[] = [];
      if (rec.description) parts.push(rec.description);
      if (rec.implementation) parts.push(`实施: ${rec.implementation}`);
      return parts.join(' - ');
    });
  }

  /**
   * 生成备用报告（当 AI 生成失败时使用）
   */
  private generateFallbackReport(context: ExecutionContext, operation: MultiIPOperation): string {
    const lines: string[] = [];
    lines.push(`# 📊 执行报告`);
    lines.push('');
    lines.push(`## 📝 执行总结`);
    lines.push(`任务 "${operation.taskName}" 已执行完成。共执行 ${context.executionHistory.length} 个步骤。`);
    lines.push('');

    // 统计
    const hasErrors = context.executionHistory.some(h => h.observation.hasError);
    lines.push(`## 📈 执行统计`);
    lines.push(`- 总步骤数: ${context.executionHistory.length}`);
    lines.push(`- 执行结果: ${hasErrors ? '部分步骤执行失败' : '全部步骤执行成功'}`);
    lines.push('');

    // 执行历史
    lines.push(`## 📋 执行历史`);
    context.executionHistory.forEach(h => {
      lines.push(`- 步骤 ${h.stepNumber}: ${h.thought.command || '无命令'} - ${h.decision.nextAction}`);
    });

    return lines.join('\n');
  }

  /**
   * 从总结中提取建议
   */
  private extractRecommendations(summary: string): string[] {
    const recommendations: string[] = [];
    
    // 尝试匹配 "优化建议" 或 "建议" 部分
    const suggestionPatterns = [
      /优化建议[：:]\s*([\s\S]*?)(?=\n\n|\n##|$)/i,
      /建议[：:]\s*([\s\S]*?)(?=\n\n|\n##|$)/i,
      /后续操作[：:]\s*([\s\S]*?)(?=\n\n|\n##|$)/i
    ];
    
    for (const pattern of suggestionPatterns) {
      const match = summary.match(pattern);
      if (match) {
        const lines = match[1].split('\n').filter(line => line.trim());
        for (const line of lines) {
          const cleaned = line.replace(/^[-*•\d.\s]+/, '').trim();
          if (cleaned && cleaned.length > 5) {
            recommendations.push(cleaned);
          }
        }
        break;
      }
    }
    
    return recommendations;
  }

  /**
   * 解析思考结果
   */
  private parseThought(response: string): AgentThought {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          reasoning: parsed.reasoning || 'AI 思考完成',
          command: parsed.command || '',
          shouldComplete: parsed.shouldComplete || false,
          riskLevel: parsed.riskLevel || 'low',
          requiresConfirmation: parsed.requiresConfirmation || false
        };
      }
    } catch (error) {
      console.error('Parse thought error:', error);
    }

    return {
      reasoning: '解析失败，使用默认思考',
      command: '',
      shouldComplete: false,
      riskLevel: 'low',
      requiresConfirmation: false
    };
  }

  /**
   * 解析决策结果
   */
  private parseDecision(response: string): AgentDecision {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          nextAction: parsed.nextAction || 'complete',
          reasoning: parsed.reasoning || 'AI 决策完成',
          requiresConfirmation: parsed.requiresConfirmation || false,
          riskLevel: parsed.riskLevel || 'medium',
          suggestions: parsed.suggestions || []
        };
      }
    } catch (error) {
      console.error('Parse decision error:', error);
    }

    return {
      nextAction: 'complete',
      reasoning: '解析失败，默认完成任务',
      requiresConfirmation: false,
      riskLevel: 'medium'
    };
  }

  /**
   * 中止执行
   */
  abort(): void {
    this.abortController?.abort();
  }
}

// 执行上下文
interface ExecutionContext {
  userGoal: string;
  executionHistory: {
    stepNumber: number;
    thought: AgentThought;
    observation: AgentObservation;
    decision: AgentDecision;
  }[];
  serverStatuses: Map<string, ServerExecutionResult>;
  currentStep: number;
  isCompleted: boolean;
}

// Agent 思考结果
interface AgentThought {
  reasoning: string;
  command: string;
  shouldComplete: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

// Agent 观察结果
interface AgentObservation {
  summary: string;
  serverResults: {
    serverId: string;
    serverName: string;
    ip: string;
    status: string;
    output: string;
    error?: string;
    duration?: number;
  }[];
  hasError: boolean;
  hasSuccess?: boolean;
}

// Agent 决策
interface AgentDecision {
  nextAction: 'continue' | 'complete' | 'retry' | 'abort' | 'skip';
  reasoning: string;
  requiresConfirmation: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  suggestions?: string[];
}

// 导出单例
export const multiIPAgentService = new MultiIPAgentService();
