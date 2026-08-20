# 后端凭据与界面配置持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SSH 与 OpenAI 凭据保存在本地后端 SQLite，并让连接与 AI 调用由后端读取敏感数据。

**Architecture:** SQLite 保持服务器和普通配置的事务快照；凭据永不出现在读取响应。SSH gateway 只使用 `serverId` 查库，AI 服务从 SQLite 偏好读取 API Key。

**Tech Stack:** NestJS、node:sqlite、Socket.IO、React、Zustand、Jest。

---

### Task 1: 后端凭据来源

**Files:**
- Modify: `back/src/database/database.service.ts`
- Modify: `back/src/ai/credential.service.ts`
- Modify: `back/src/ssh/ssh.gateway.ts`
- Test: `back/src/database/database.service.spec.ts`
- Test: `back/test/app.e2e-spec.ts`

- [ ] **Step 1: 写入失败测试**

验证 `CredentialService` 将 API Key 保存在 `app_preferences`；验证数据库服务器数据存在时，`ssh-connect` 传入的 host、username 和 password 不可覆盖它。

- [ ] **Step 2: 运行后端测试确认失败**

Run: `pnpm --dir back test -- database.service.spec.ts --runInBand`

Expected: FAIL，缺少 SQLite API Key 读取/写入或 SSH 数据库优先行为。

- [ ] **Step 3: 实现最小后端改动**

在 `CredentialService` 注入 `DatabaseService`，将 Key 写为 `aiApiKey` 偏好；`SshGateway` 在服务器不存在或无密码时报告错误，并只使用数据库连接参数。

- [ ] **Step 4: 运行聚焦测试确认通过**

Run: `pnpm --dir back test -- database.service.spec.ts --runInBand`

Expected: PASS。

### Task 2: 前端不再传送 SSH 凭据

**Files:**
- Modify: `components/AISSH/services/sshService.ts`
- Modify: `components/AISSH/AISSH.tsx`
- Test: `pnpm run build`

- [ ] **Step 1: 调整 SSH 客户端 API**

将 `connect` 签名改为接收 `serverId` 与显示名称；Socket.IO 事件只发送 `{ serverId }`。

- [ ] **Step 2: 更新常规与批量连接调用**

移除 `server.password` 分支，改为依赖 `hasCredential`。手动输入密码后只先保存服务器记录，再以 `serverId` 连接。

- [ ] **Step 3: 编译验证**

Run: `pnpm run build`

Expected: PASS。

### Task 3: API Key 仅以后端 SQL 为准

**Files:**
- Modify: `components/AISSH/services/aiClient.ts`
- Modify: `components/AISSH/components/AIChatPanel.tsx`
- Test: `back/test/app.e2e-spec.ts`

- [ ] **Step 1: 保持输入只用于更新后端**

保存 Key 后立即清空前端 `customKey`；发送 AI 请求不再同步前端 Key，而让后端直接读取 SQLite。

- [ ] **Step 2: 运行 e2e 测试**

Run: `pnpm --dir back test:e2e --runInBand`

Expected: PASS。

### Task 4: 完整验证

**Files:**
- Verify only

- [ ] **Step 1: 运行后端测试**

Run: `pnpm --dir back test -- --runInBand`

- [ ] **Step 2: 运行后端 e2e 测试**

Run: `pnpm --dir back test:e2e --runInBand`

- [ ] **Step 3: 运行前端构建**

Run: `pnpm run build`

