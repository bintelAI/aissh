# SSH Workbench Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SSH workbench visually coherent through one restrained dark developer-tool theme while preserving every existing workflow and layout.

**Architecture:** Keep visual decisions at the existing design-system boundaries: semantic Tailwind tokens provide the palette, `index.css` supplies global typography and surface behavior, and the shared `CyberPanel` and `Button` components enforce consistent geometry and interaction feedback. Feature components retain their public APIs and inherit the updated visual language without behavioral changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 3, Framer Motion, Lucide React, Vite.

---

### Task 1: Establish a semantic dark-workbench token set

**Files:**
- Modify: `tailwind.config.js:9-63`
- Test: `pnpm run build`

- [ ] **Step 1: Record the current build baseline**

Run: `pnpm run build`

Expected: the command either exits successfully, or reports pre-existing diagnostics before the visual-token change is made.

- [ ] **Step 2: Replace the cyberpunk token values with a restrained blue-cyan workbench palette**

In `tailwind.config.js`, replace the `sci` colors and visual effects with this focused system:

```ts
colors: {
  sci: {
    base: '#0b1017',
    panel: '#121a24',
    obsidian: '#182331',
    cyan: '#38bdf8',
    violet: '#94a3b8',
    green: '#34d399',
    red: '#fb7185',
    text: '#e5edf6',
    dim: '#8b9bae',
  },
},
backgroundImage: {
  'grid-pattern': "linear-gradient(rgba(56, 189, 248, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.025) 1px, transparent 1px)",
},
```

Remove the unused animated cyberpunk keyframes (`reverse-spin`, `scanline`, `glitch`, `pulse-fast`, `hologram`, `decode`) from the Tailwind extension only when no source file references their corresponding animation classes.

- [ ] **Step 3: Build after token replacement**

Run: `pnpm run build`

Expected: exit code `0` and a generated production bundle.

### Task 2: Normalize global typography, code surfaces, and scrolling

**Files:**
- Modify: `index.css:4-115`
- Test: `pnpm run build`

- [ ] **Step 1: Verify the global stylesheet currently contains the legacy visual treatment**

Run: `rg -n "Rajdhani|00f3ff|bc13fe|text-glow|clip-corner" index.css`

Expected: matches identify the legacy font, neon colors, and ornamental utilities that the next step replaces.

- [ ] **Step 2: Apply the shared workbench surface rules**

Replace legacy global colors and neon-only scrollbar states with semantic dark surfaces. Set `body` to use a compact system UI stack with `JetBrains Mono` only for code, make `pre` and inline code use `sci-panel`/`sci-obsidian` equivalents, and use subdued blue scroll thumbs without glow shadows. Retain `.no-scrollbar` and preserve the existing markdown selector coverage.

```css
body {
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #0b1017;
  color: #e5edf6;
}

pre,
.prose pre {
  background-color: #121a24 !important;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 6px;
}
```

Remove `.text-glow`, `.border-glow`, and `.clip-corner` only after their usages are removed or replaced in Task 3 and no source reference remains.

- [ ] **Step 3: Build after the stylesheet update**

Run: `pnpm run build`

Expected: exit code `0`.

### Task 3: Align shared panels and buttons with the new visual system

**Files:**
- Modify: `components/AISSH/common/CyberPanel.tsx:7-69`
- Modify: `components/AISSH/common/Button.tsx:4-58`
- Test: `pnpm run build`

- [ ] **Step 1: Identify public component API and current decorative behavior**

Run: `rg -n "<CyberPanel|<Button|clip-corner|text-glow|border-glow" components index.css`

Expected: existing usages rely on `CyberPanel` and `Button` props, while visual utility matches show where compatibility must be retained or replaced.

- [ ] **Step 2: Simplify `CyberPanel` without changing its props**

Keep `glow`, `variant`, and `noAnimation` public props. Update `bgMap` to opaque/semi-opaque dark surfaces, use a neutral `border-slate-700/60`, add `rounded-md`, and limit the optional `glow` to a soft shadow. Remove the four decorative corner `motion.div` elements so every panel shares one quiet frame.

```tsx
className={`relative ${bgMap[variant]} rounded-md border border-slate-700/60 shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${glow ? 'border-sky-400/35 shadow-[0_12px_30px_rgba(14,165,233,0.12)]' : ''} ${className}`}
```

- [ ] **Step 3: Simplify `Button` variants without changing callers**

Keep all current variant names and sizes, but make every button use `rounded-md`, normal mixed-case label styling, a 150ms transition, and consistent focus visibility. Make `primary` and `sci-cyan` solid sky-blue commands; make `secondary`/`sci-violet` neutral outlined actions; keep semantic success and error colors. Remove the hover-overlay element and the `clip-corner` dependency.

```tsx
const baseClasses = 'relative inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-sci-base disabled:pointer-events-none disabled:opacity-50';
```

- [ ] **Step 4: Build and inspect production output**

Run: `pnpm run build`

Expected: exit code `0`; Vite emits the application bundle with no TypeScript or Tailwind compilation errors.

### Task 4: Validate the live hot-loaded interface and source hygiene

**Files:**
- Verify: `tailwind.config.js`
- Verify: `index.css`
- Verify: `components/AISSH/common/CyberPanel.tsx`
- Verify: `components/AISSH/common/Button.tsx`

- [ ] **Step 1: Confirm no removed decorative utilities remain referenced**

Run: `rg -n "clip-corner|text-glow|border-glow|animate-(reverse-spin|scanline|glitch|pulse-fast|hologram|decode)" components index.css tailwind.config.js`

Expected: no matches, or only deliberate compatibility declarations documented in the source.

- [ ] **Step 2: Inspect the already running local app in a desktop viewport**

Use the existing dev-server URL and confirm the first viewport has: a visibly distinct sidebar, main workspace, and AI panel; readable text hierarchy; no fluorescent purple or green surface treatment; controls do not overlap; and the terminal area remains visually dominant.

- [ ] **Step 3: Inspect a narrow viewport**

Use a 390px-wide viewport and confirm labels stay within controls, panel borders remain aligned, and no horizontal overlap or clipped interface text appears.

- [ ] **Step 4: Review only task-owned changes**

Run: `git diff -- tailwind.config.js index.css components/AISSH/common/CyberPanel.tsx components/AISSH/common/Button.tsx`

Expected: the diff is limited to the visual-system changes described above and does not overwrite the user's pre-existing work.
