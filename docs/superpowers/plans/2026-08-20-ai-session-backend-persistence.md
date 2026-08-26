# AI Session Backend Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AI sessions and messages in the backend SQLite database and make the frontend load/update them only through APIs.

**Architecture:** Add a dedicated AI sessions module backed by normalized SQLite tables and REST endpoints. The AI panel keeps only transient render state while using the backend as the source of truth for session metadata and messages.

**Tech Stack:** NestJS 11, TypeScript, Node `node:sqlite`, Jest, React 19, Zustand, Vite.

---

### Task 1: Add SQLite schema and backend domain types

**Files:**
- Modify: `back/src/database/database.service.ts`
- Modify: `back/src/database/database.service.spec.ts`
- Create: `back/src/ai/sessions.types.ts`

- [ ] **Step 1: Write the failing migration assertion**

Extend the database test to expect migration version `4` and both new tables.

- [ ] **Step 2: Run the database test and verify it fails**

Run: `pnpm --dir back exec jest database/database.service.spec.ts --runInBand`

Expected: failure because migration version 4 and the AI session tables do not exist.

- [ ] **Step 3: Add migration v4**

Create `ai_chat_sessions` and `ai_chat_messages` with foreign-key cascade, indexes on `server_id` and `(session_id, created_at)`, and valid role/mode checks.

- [ ] **Step 4: Add shared request/response types**

Define `AiChatSession`, `AiChatMessage`, `CreateAiChatSessionInput`, `UpdateAiChatSessionInput`, and `CreateAiChatMessageInput` without exposing credentials.

- [ ] **Step 5: Run the database test and verify it passes**

Run: `pnpm --dir back exec jest database/database.service.spec.ts --runInBand`

Expected: PASS with migration version 4 and both tables present.

### Task 2: Implement AI session/message CRUD API

**Files:**
- Create: `back/src/ai/ai-sessions.service.ts`
- Create: `back/src/ai/ai-sessions.controller.ts`
- Modify: `back/src/ai/ai.module.ts`
- Create: `back/src/ai/ai-sessions.service.spec.ts`
- Modify: `back/test/app.e2e-spec.ts`

- [ ] **Step 1: Write service tests for CRUD and cascade behavior**

Cover session creation/list filtering, message creation/update, validation rejection, and deleting a session removes its messages.

- [ ] **Step 2: Run the new service tests and verify they fail**

Run: `pnpm --dir back exec jest ai/ai-sessions.service.spec.ts --runInBand`

Expected: module-not-found or missing-method failures before implementation.

- [ ] **Step 3: Implement the service**

Use prepared SQL statements, generate IDs with `randomUUID`, update `updated_at` whenever session data or messages change, and throw Nest HTTP exceptions for invalid IDs/input.

- [ ] **Step 4: Implement controller routes and register them**

Expose the eight routes from the approved design and register the controller in `AiModule`.

- [ ] **Step 5: Run service tests and add E2E CRUD coverage**

Run the unit test first, then add a full HTTP test for create/list/message/update/clear/delete.

- [ ] **Step 6: Run backend tests**

Run: `pnpm --dir back exec jest --runInBand`

Expected: all unit and E2E suites pass.

### Task 3: Add frontend API client and hydrate AI sessions

**Files:**
- Create: `components/AISSH/services/aiSessionService.ts`
- Modify: `components/AISSH/types/index.ts`
- Modify: `components/AISSH/components/AIChatPanel.tsx`

- [ ] **Step 1: Add typed client tests or compile-time contract fixtures**

Cover URL construction, ISO date deserialization, and conversion between API message dates and `ChatMessage` dates.

- [ ] **Step 2: Implement the client**

Use the same Electron-aware backend URL resolution as existing clients; expose typed functions for list/create/update/delete sessions and list/create/update/clear messages.

- [ ] **Step 3: Replace default-only AI session initialization**

On panel mount and server change, load sessions from the API. If a server has no sessions, create one through the API before rendering it active.

- [ ] **Step 4: Persist session mutations**

Route new session, delete, clear, mode change, user message, and final assistant message through the client. Keep only the active stream buffer transient until the final message update succeeds.

- [ ] **Step 5: Remove configuration snapshot ownership of chat sessions**

Do not add `sessions` to the ordinary configuration snapshot; session APIs are the sole persistence path.

### Task 4: Verify no browser persistence and full integration

**Files:**
- Modify: `docs/superpowers/specs/2026-08-20-ai-session-backend-persistence-design.md`
- Modify: `docs/superpowers/plans/2026-08-20-ai-session-backend-persistence.md`

- [ ] **Step 1: Audit forbidden browser persistence APIs**

Run: `rg -n -i "localStorage|sessionStorage|indexeddb|createJSONStorage|zustand/middleware|navigator\.storage" components src electron`

Expected: no persistence calls.

- [ ] **Step 2: Run backend tests and builds**

Run: `pnpm --dir back exec jest --runInBand && pnpm --dir back run build`

Expected: all tests and Nest build pass.

- [ ] **Step 3: Run frontend TypeScript/Vite verification**

Run: `pnpm exec tsc --noEmit` and `pnpm run build`.

Expected: both commands exit 0.

- [ ] **Step 4: Review the diff for scope**

Confirm no file-editor draft persistence, connection-state persistence, browser storage, or API credential exposure was introduced.
