import { create } from 'zustand';
import { MultiIPOperationState, MultiIPOperation, ExecutionStep } from '../types/multiIP';

interface PersistedMultiIPState {
  hydrateOperations: (operations: MultiIPOperation[]) => void;
}

export const useMultiIPStore = create<MultiIPOperationState & PersistedMultiIPState>((set, get) => ({
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

      hydrateOperations: (operations) => set({
        operations,
        activeOperationId: null,
      }),

      getOperation: (operationId) => {
        return get().operations.find(op => op.id === operationId);
      },

      getActiveOperation: () => {
        const { operations, activeOperationId } = get();
        return operations.find(op => op.id === activeOperationId);
      }
    }));
