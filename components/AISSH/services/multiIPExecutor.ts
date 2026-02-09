import { useSSHStore } from '../store/useSSHStore';
import { sshManager } from './sshService';
import { chatWithAI } from './geminiService';

export interface SelectedIP {
  id: string;
  ip: string;
  name: string;
}

export interface ExecutionResult {
  serverId: string;
  serverName: string;
  ip: string;
  command: string;
  output: string;
  exitCode?: number;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

export type ExecutionMode = 'parallel' | 'sequential' | 'adaptive';

export interface MultiIPExecuteOptions {
  mode?: ExecutionMode;
  timeout?: number;
  continueOnError?: boolean;
  onProgress?: (result: ExecutionResult, completed: number, total: number) => void;
}

/**
 * 多 IP 执行器 - 支持并行、串行、自适应执行模式
 */
export class MultiIPExecutor {
  private abortController: AbortController | null = null;

  /**
   * 执行命令到多个服务器
   */
  async execute(
    command: string,
    targets: SelectedIP[],
    options: MultiIPExecuteOptions = {}
  ): Promise<ExecutionResult[]> {
    const {
      mode = 'parallel',
      timeout = 30000,
      continueOnError = true,
      onProgress
    } = options;

    this.abortController = new AbortController();
    const results: ExecutionResult[] = [];

    try {
      switch (mode) {
        case 'parallel':
          return await this.executeParallel(command, targets, timeout, continueOnError, onProgress);
        case 'sequential':
          return await this.executeSequential(command, targets, timeout, continueOnError, onProgress);
        case 'adaptive':
          return await this.executeAdaptive(command, targets, timeout, continueOnError, onProgress);
        default:
          throw new Error(`未知的执行模式: ${mode}`);
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * 并行执行 - 所有服务器同时执行
   */
  private async executeParallel(
    command: string,
    targets: SelectedIP[],
    timeout: number,
    continueOnError: boolean,
    onProgress?: (result: ExecutionResult, completed: number, total: number) => void
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    let completed = 0;

    const promises = targets.map(async (target) => {
      const result = await this.executeOnServer(command, target, timeout);
      results.push(result);
      completed++;
      onProgress?.(result, completed, targets.length);
      return result;
    });

    if (continueOnError) {
      await Promise.all(promises.map(p => p.catch(err => err)));
    } else {
      await Promise.all(promises);
    }

    return results;
  }

  /**
   * 串行执行 - 逐个服务器执行
   */
  private async executeSequential(
    command: string,
    targets: SelectedIP[],
    timeout: number,
    continueOnError: boolean,
    onProgress?: (result: ExecutionResult, completed: number, total: number) => void
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (let i = 0; i < targets.length; i++) {
      if (this.abortController?.signal.aborted) {
        break;
      }

      const target = targets[i];
      const result = await this.executeOnServer(command, target, timeout);
      results.push(result);
      onProgress?.(result, i + 1, targets.length);

      if (!result.success && !continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * 自适应执行 - 根据结果动态调整
   */
  private async executeAdaptive(
    command: string,
    targets: SelectedIP[],
    timeout: number,
    continueOnError: boolean,
    onProgress?: (result: ExecutionResult, completed: number, total: number) => void
  ): Promise<ExecutionResult[]> {
    // 初始并行执行
    const results = await this.executeParallel(
      command,
      targets,
      timeout,
      continueOnError,
      onProgress
    );

    // 检查是否有失败的
    const failedTargets = results
      .filter(r => !r.success)
      .map(r => targets.find(t => t.id === r.serverId))
      .filter((t): t is SelectedIP => t !== undefined);

    if (failedTargets.length > 0) {
      // 对失败的进行串行重试
      const retryResults = await this.executeSequential(
        command,
        failedTargets,
        timeout * 2, // 增加超时时间
        continueOnError,
        onProgress
      );

      // 更新结果
      retryResults.forEach(retryResult => {
        const index = results.findIndex(r => r.serverId === retryResult.serverId);
        if (index !== -1) {
          results[index] = retryResult;
        }
      });
    }

    return results;
  }

  /**
   * 在单个服务器上执行命令
   */
  private async executeOnServer(
    command: string,
    target: SelectedIP,
    timeout: number
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // 检查是否被取消
      if (this.abortController?.signal.aborted) {
        throw new Error('执行已取消');
      }

      // 使用 SSH 服务执行命令
      const output = await sshManager.executeCommand(command, target.id);
      const exitCode = output.startsWith('Error:') ? 1 : 0;

      return {
        serverId: target.id,
        serverName: target.name,
        ip: target.ip,
        command,
        output,
        exitCode,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: exitCode === 0
      };
    } catch (error) {
      return {
        serverId: target.id,
        serverName: target.name,
        ip: target.ip,
        command,
        output: '',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 使用 AI 分析执行结果
   */
  async analyzeResults(
    results: ExecutionResult[],
    originalCommand: string
  ): Promise<string> {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    const prompt = `
你是一位专业的运维专家。请分析以下多服务器命令执行结果：

执行的命令: ${originalCommand}
目标服务器数量: ${results.length}
成功: ${successCount} 台
失败: ${failCount} 台

各服务器执行详情:
${results.map(r => `
服务器: ${r.serverName} (${r.ip})
状态: ${r.success ? '成功' : '失败'}
执行时长: ${r.duration}ms
${r.exitCode !== undefined ? `退出码: ${r.exitCode}` : ''}
输出:
${r.output || '(无输出)'}
${r.error ? `错误: ${r.error}` : ''}
---
`).join('\n')}

请提供:
1. 执行结果总结
2. 发现的任何问题或异常
3. 建议的后续操作
`;

    try {
      const analysis = await chatWithAI(prompt, []);
      return analysis;
    } catch (error) {
      return `分析失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  /**
   * 取消执行
   */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * 生成执行报告
   */
  generateReport(results: ExecutionResult[]): string {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    return `
## 执行报告

- **总服务器数**: ${results.length}
- **成功**: ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%)
- **失败**: ${failCount} (${((failCount / results.length) * 100).toFixed(1)}%)
- **平均执行时长**: ${avgDuration.toFixed(0)}ms

### 详细结果

| 服务器 | IP | 状态 | 时长 | 输出 |
|--------|-----|------|------|------|
${results.map(r => `| ${r.serverName} | ${r.ip} | ${r.success ? '✅' : '❌'} | ${r.duration}ms | ${r.output.slice(0, 50)}${r.output.length > 50 ? '...' : ''} |`).join('\n')}
`;
  }
}

// 导出单例
export const multiIPExecutor = new MultiIPExecutor();
