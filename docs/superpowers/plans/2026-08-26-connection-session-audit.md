# Connection Session Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat SSH log history with paged connection-session history and session-scoped details.

**Architecture:** SQLite stores connection sessions and an optional session ID on operation logs. The SSH backend owns session state transitions, while the renderer propagates the UUID into local command logs. The log UI lists sessions and fetches details by ID.

**Tech Stack:** NestJS, node:sqlite, Socket.IO, React, TypeScript, Jest, Tailwind CSS.

---

### Task 1: Persisted Session Domain

**Files:**
- Modify: `back/src/database/database.service.ts`
- Modify: `back/src/operation-logs/operation-logs.types.ts`
- Modify: `back/src/operation-logs/operation-logs.service.ts`
- Create: `back/src/connection-sessions/connection-sessions.service.ts`
- Create: `back/src/connection-sessions/connection-sessions.service.spec.ts`

- [x] Write failing service tests for creating, closing, ordering, paging, and session-log queries.
- [x] Run `pnpm --dir back exec jest connection-sessions.service.spec.ts` and observe failure because the domain does not exist.
- [x] Add migrations for `connection_sessions` and nullable `operation_logs.session_id`; add the minimal service and operation-log session filter.
- [x] Run the focused backend tests and confirm success.

### Task 2: SSH Lifecycle Correlation

**Files:**
- Modify: `back/src/ssh/ssh.service.ts`
- Modify: `back/src/ssh/ssh.gateway.ts`
- Modify: `back/src/ssh/ssh.module.ts`
- Modify: `components/AISSH/services/sshService.ts`
- Modify: `components/AISSH/types/index.ts`
- Modify: `components/AISSH/store/useSSHStore.ts`

- [x] Write failing SSH lifecycle tests for manual disconnect and session ID propagation.
- [x] Run focused SSH tests and observe missing session lifecycle behavior.
- [x] Create, connect, close, and fail session records from backend lifecycle events; include `sessionId` in status/data/error events and new operation logs.
- [x] Run focused SSH and operation-log tests and confirm success.

### Task 3: Session History UI

**Files:**
- Create: `components/AISSH/services/connectionSessionService.ts`
- Create: `components/AISSH/components/ConnectionSessionList.tsx`
- Create: `components/AISSH/components/ConnectionSessionDetail.tsx`
- Modify: `components/AISSH/components/OperationLogView.tsx`
- Modify: `components/AISSH/AISSH.tsx`

- [x] Add a session list request and a detail-log request using the existing backend base URL convention.
- [x] Render a 100-row session list and a back-navigable, session-scoped detail view with command and alert filters.
- [x] Refresh the list when SSH status changes without polling raw terminal output.

### Task 4: Verification

**Files:**
- Modify: relevant test files only.

- [x] Run `pnpm --dir back test`.
- [x] Run `pnpm test:frontend`.
- [x] Run `pnpm exec tsc --noEmit` and `git diff --check`.
