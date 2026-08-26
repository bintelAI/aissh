# Agentation Dev-Only Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在开发环境为应用根节点启用 Agentation，生产环境不渲染该调试工具。

**Architecture:** 根入口 `index.tsx` 继续负责 React 挂载。它在现有 `AISSH` 根组件旁渲染 `Agentation`，并使用 Vite 的编译期环境变量 `import.meta.env.DEV` 限制渲染范围。

**Tech Stack:** React 19、TypeScript、Vite 6、agentation 3.0.2。

---

### Task 1: 在根入口挂载开发调试工具

**Files:**
- Modify: `index.tsx:1-15`
- Test: 无现成前端测试脚本；使用 TypeScript 编译检查验证 JSX 与导入类型。

- [ ] **Step 1: 确认当前入口不包含 `Agentation` 挂载**

Run: `rg -n "Agentation|import\.meta\.env\.DEV" index.tsx`

Expected: 无匹配输出。

- [ ] **Step 2: 最小化修改入口代码**

```tsx
import { Agentation } from 'agentation';

root.render(
  <React.StrictMode>
    <AISSH />
    {import.meta.env.DEV && <Agentation />}
  </React.StrictMode>
);
```

- [ ] **Step 3: 执行 TypeScript 编译检查**

Run: `pnpm exec tsc --noEmit`

Expected: 进程以状态码 0 退出。

- [ ] **Step 4: 审查最终差异**

Run: `git diff -- index.tsx`

Expected: 仅包含 `Agentation` 导入和受 `import.meta.env.DEV` 保护的 JSX 挂载。
