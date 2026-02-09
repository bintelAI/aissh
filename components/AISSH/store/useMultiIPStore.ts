import { create } from 'zustand';
import { persist, StorageValue } from 'zustand/middleware';
import { MultiIPOperationState, MultiIPOperation, ExecutionStep } from '../types/multiIP';

const STORAGE_KEY = 'multi-ip-operations';

const customStorage = {
  getItem: (name: string): StorageValue<MultiIPOperationState> | null => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    
    try {
      const parsed = JSON.parse(str);
      return {
        state: {
          ...parsed.state,
          operations: deserializeOperations(parsed.state.operations)
        },
        version: parsed.version
      };
    } catch (e) {
      console.error('Failed to parse stored data:', e);
      return null;
    }
  },
  setItem: (name: string, value: StorageValue<MultiIPOperationState>): void => {
    try {
      const serialized = JSON.stringify({
        state: {
          ...value.state,
          operations: serializeOperations(value.state.operations)
        },
        version: value.version
      });
      localStorage.setItem(name, serialized);
    } catch (e) {
      console.error('Failed to serialize data:', e);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  }
};

// 序列化时处理 Date 对象
const serializeOperations = (operations: MultiIPOperation[]): any[] => {
  return operations.map(op => ({
    ...op,
    createdAt: op.createdAt.toISOString(),
    startedAt: op.startedAt?.toISOString(),
    completedAt: op.completedAt?.toISOString(),
    steps: op.steps.map(step => ({
      ...step,
      startTime: step.startTime.toISOString(),
      endTime: step.endTime?.toISOString(),
      serverResults: step.serverResults.map(sr => ({
        ...sr,
        startTime: sr.startTime?.toISOString(),
        endTime: sr.endTime?.toISOString()
      }))
    }))
  }));
};

// 反序列化时恢复 Date 对象
const deserializeOperations = (operations: any[]): MultiIPOperation[] => {
  return operations.map(op => ({
    ...op,
    createdAt: new Date(op.createdAt),
    startedAt: op.startedAt ? new Date(op.startedAt) : undefined,
    completedAt: op.completedAt ? new Date(op.completedAt) : undefined,
    steps: op.steps.map((step: any) => ({
      ...step,
      startTime: new Date(step.startTime),
      endTime: step.endTime ? new Date(step.endTime) : undefined,
      serverResults: step.serverResults.map((sr: any) => ({
        ...sr,
        startTime: sr.startTime ? new Date(sr.startTime) : undefined,
        endTime: sr.endTime ? new Date(sr.endTime) : undefined
      }))
    }))
  }));
};

export const useMultiIPStore = create<MultiIPOperationState>()(
  persist(
    (set, get) => ({
      operations: [],
      activeOperationId: null,

      createOperation: (taskName, description, servers, mode) => {
        const id = `op-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const newOperation: MultiIPOperation = {
          id,
          taskName,
          taskDescription: description,
          targetServers: servers,
          executionMode: mode,
          status: 'preparing',
          steps: [],
          currentStepIndex: -1,
          createdAt: new Date(),
          stats: {
            totalServers: servers.length,
            completedServers: 0,
            failedServers: 0,
            totalDuration: 0
          }
        };

        set(state => ({
          operations: [...state.operations, newOperation],
          activeOperationId: id
        }));

        return id;
      },

      startOperation: (operationId) => {
        set(state => ({
          operations: state.operations.map(op =>
            op.id === operationId
              ? { ...op, status: 'running', startedAt: new Date() }
              : op
          )
        }));
      },

      pauseOperation: (operationId) => {
        set(state => ({
          operations: state.operations.map(op =>
            op.id === operationId
              ? { ...op, status: 'paused' }
              : op
          )
        }));
      },

      resumeOperation: (operationId) => {
        set(state => ({
          operations: state.operations.map(op =>
            op.id === operationId
              ? { ...op, status: 'running' }
              : op
          )
        }));
      },

      cancelOperation: (operationId) => {
        set(state => ({
          operations: state.operations.map(op =>
            op.id === operationId
              ? { ...op, status: 'cancelled', completedAt: new Date() }
              : op
          )
        }));
      },

      completeOperation: (operationId, summary, recommendations) => {
        set(state => ({
          operations: state.operations.map(op =>
            op.id === operationId
              ? { ...op, status: 'completed', completedAt: new Date(), summary, recommendations }
              : op
          )
        }));
      },

      deleteOperation: (operationId) => {
        set(state => ({
          operations: state.operations.filter(op => op.id !== operationId),
          activeOperationId: state.activeOperationId === operationId
            ? (state.operations.find(op => op.id !== operationId)?.id || null)
            : state.activeOperationId
        }));
      },

      // 清除所有本地缓存
      clearAllOperations: () => {
        set({
          operations: [],
          activeOperationId: null
        });
      },

      addStep: (operationId, command, description) => {
        set(state => ({
          operations: state.operations.map(op => {
            if (op.id !== operationId) return op;

            const stepNumber = op.steps.length + 1;
            const newStep: ExecutionStep = {
              stepNumber,
              command,
              description,
              serverResults: op.targetServers.map(server => ({
                serverId: server.id,
                serverName: server.name,
                ip: server.ip,
                status: 'pending',
                output: ''
              })),
              startTime: new Date(),
              status: 'running'
            };

            return {
              ...op,
              steps: [...op.steps, newStep],
              currentStepIndex: stepNumber - 1
            };
          })
        }));
      },

      updateStepStatus: (operationId, stepNumber, status) => {
        set(state => ({
          operations: state.operations.map(op => {
            if (op.id !== operationId) return op;

            return {
              ...op,
              steps: op.steps.map(step =>
                step.stepNumber === stepNumber
                  ? { ...step, status, endTime: status === 'completed' || status === 'error' ? new Date() : step.endTime }
                  : step
              )
            };
          })
        }));
      },

      updateServerResult: (operationId, stepNumber, serverId, result) => {
        set(state => ({
          operations: state.operations.map(op => {
            if (op.id !== operationId) return op;

            const updatedSteps = op.steps.map(step => {
              if (step.stepNumber !== stepNumber) return step;

              return {
                ...step,
                serverResults: step.serverResults.map(sr =>
                  sr.serverId === serverId
                    ? { ...sr, ...result }
                    : sr
                )
              };
            });

            // 计算所有步骤的累计统计
            let totalCompletedServers = 0;
            let totalFailedServers = 0;

            updatedSteps.forEach(step => {
              step.serverResults.forEach(sr => {
                if (sr.status === 'success' || sr.status === 'error') {
                  totalCompletedServers++;
                  if (sr.status === 'error') {
                    totalFailedServers++;
                  }
                }
              });
            });

            return {
              ...op,
              steps: updatedSteps,
              stats: {
                ...op.stats,
                completedServers: totalCompletedServers,
                failedServers: totalFailedServers
              }
            };
          })
        }));
      },

      setAIDecision: (operationId, stepNumber, decision) => {
        set(state => ({
          operations: state.operations.map(op => {
            if (op.id !== operationId) return op;

            return {
              ...op,
              steps: op.steps.map(step =>
                step.stepNumber === stepNumber
                  ? { ...step, aiDecision: decision, status: 'waiting_decision' }
                  : step
              )
            };
          })
        }));
      },

      confirmDecision: (operationId, stepNumber, confirmed) => {
        set(state => ({
          operations: state.operations.map(op => {
            if (op.id !== operationId) return op;

            return {
              ...op,
              steps: op.steps.map(step =>
                step.stepNumber === stepNumber
                  ? { ...step, status: confirmed ? 'running' : 'error' }
                  : step
              )
            };
          })
        }));
      },

      getOperation: (operationId) => {
        return get().operations.find(op => op.id === operationId);
      },

      getActiveOperation: () => {
        const { operations, activeOperationId } = get();
        return operations.find(op => op.id === activeOperationId);
      }
    }),
    {
      name: STORAGE_KEY,
      storage: customStorage,
      partialize: (state) => ({
        operations: state.operations,
        activeOperationId: state.activeOperationId
      })
    }
  )
);
