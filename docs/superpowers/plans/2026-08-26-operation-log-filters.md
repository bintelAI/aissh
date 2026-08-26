# Operation Log Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add command search, one alert filter, and 100-row client-side pages to the operation log view.

**Architecture:** Keep filtering and page calculations as pure functions in `logHistory.ts`. The React view stores filter and page state, resets the page when a filter changes, and renders only the current slice.

**Tech Stack:** React, TypeScript, Jest, Tailwind CSS, Lucide.

---

### Task 1: Log History Helpers

**Files:**
- Modify: `components/AISSH/services/logHistory.ts`
- Modify: `components/AISSH/services/logHistory.spec.ts`

- [x] **Step 1: Write failing tests**

```ts
expect(filterOperationLogs(logs, servers, { commandQuery: 'uptime' })).toEqual([
  logs[1],
]);
expect(filterOperationLogs(logs, servers, { alertsOnly: true })).toEqual([
  logs[0],
]);
expect(paginateOperationLogs(Array.from({ length: 101 }), 2).items).toHaveLength(1);
```

- [x] **Step 2: Verify the tests fail**

Run: `pnpm test:frontend -- logHistory.spec.ts`
Expected: TypeScript error because the filter fields and pagination helper do not exist.

- [x] **Step 3: Add the minimal helpers**

```ts
export function paginateOperationLogs<T>(items: T[], page: number, pageSize = 100) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  return { currentPage, totalPages, items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize) };
}
```

Extend `LogHistoryFilters` with `commandQuery` and `alertsOnly`, then apply
case-insensitive command matching and the three agreed alert types.

- [x] **Step 4: Verify the tests pass**

Run: `pnpm test:frontend -- logHistory.spec.ts`
Expected: PASS.

### Task 2: Log View Controls

**Files:**
- Modify: `components/AISSH/components/OperationLogView.tsx`
- Test: `components/AISSH/services/logHistory.spec.ts`

- [x] **Step 1: Pass the new filters to the derived log list**

```tsx
const [commandQuery, setCommandQuery] = useState('');
const [alertsOnly, setAlertsOnly] = useState(false);
const [page, setPage] = useState(1);
```

Reset `page` to 1 whenever a filter changes.

- [x] **Step 2: Render controls and page slice**

```tsx
<input value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} />
<select onChange={(event) => setAlertsOnly(event.target.value === 'alerts')}>
  <option value="">全部日志</option>
  <option value="alerts">告警</option>
</select>
```

Render the `paginateOperationLogs` slice, page count, and previous/next icon
buttons. Disable navigation at the bounds.

- [x] **Step 3: Verify all checks**

Run: `pnpm test:frontend && pnpm exec tsc --noEmit && git diff --check`
Expected: all commands exit with code 0.
