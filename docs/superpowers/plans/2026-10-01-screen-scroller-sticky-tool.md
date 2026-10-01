# 屏幕滚动字幕 / 便签工具 (Screen Scroller & Sticky Tool) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Tauri 2.x + React + TypeScript + Tailwind CSS 的轻量跨平台屏幕滚动字幕与桌面便签工具，具备多面板管理、智能全局光标穿透与悬停激活、平滑跑马灯/提词器动画引擎及本地全配置持久化。

**Architecture:** Rust 核心作为唯一状态源与系统级调用层（持久化、光标轮询命中检测、穿透切换、窗口生命周期、托盘与全局快捷键），前端采用 React SPA 并通过 Hash 路由区分控制台 (`/#/`) 与覆盖层窗口 (`/#/overlay/:id`)，两端通过 Tauri IPC 事件总线解耦通信。

**Tech Stack:** Tauri 2.x, Rust, React 19 / 18, TypeScript, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-screen-scroller-sticky-tool-design.md`

## Global Constraints

- 存储路径：`{app_data_dir}/pinmu-gundong/panels.json`
- 覆盖层窗口特性：`transparent: true`, `decorations: false`, `always_on_top: true`, `skip_taskbar: true`
- 光标穿透与热区：60ms 采样周期，外扩 12px padding 热区
- 全局快捷键：Windows `Ctrl+Alt+Space`，macOS `Cmd+Alt+Space`
- 前端测试：Vitest + Testing Library

---

### Task 1: Environment & Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `tailwind.config.js`, `postcss.config.js`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Test: `vitest.config.ts`

**Interfaces:**
- Consumes: Node.js, Rust/Cargo toolchain (via rustup if absent)
- Produces: Runnable React + Tauri 2.x dev environment and Vitest runner

- [ ] **Step 1: Check and install Rust toolchain if absent**

Ensure Rust toolchain is installed in the system:
```bash
if ! command -v rustc &> /dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi
rustc --version && cargo --version
```

- [ ] **Step 2: Initialize Node.js dependencies and Tailwind setup**

Install React, TypeScript, Vite, Tailwind CSS, Lucide React, Vitest:
```bash
pnpm init
pnpm add react react-dom @tauri-apps/api @tauri-apps/plugin-shell lucide-react clsx tailwind-merge
pnpm add -D typescript @types/react @types/react-dom vite @vitejs/plugin-react tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create base frontend configs and minimal App**

Configure `vite.config.ts` with test environment and React plugin, `tailwind.config.js`, `index.html`, and `src/main.tsx`.

- [ ] **Step 4: Initialize Tauri 2.x backend structure**

Create `src-tauri/Cargo.toml` with `tauri = "2"`, `serde`, `serde_json`, and `src-tauri/tauri.conf.json` configured for multi-window support (`main` window and window permissions).

- [ ] **Step 5: Verify build & tests**

Run: `pnpm vitest run` and `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: scaffold tauri 2.x and react typescript project structure"
```

---

### Task 2: Core Data Types & Frontend State Store (TDD)

**Files:**
- Create: `src/types/panel.ts`
- Create: `src/store/panelStore.ts`
- Test: `src/store/panelStore.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `PanelConfig`, `PanelPosition`, `PanelSize`, `PanelStyle`, `PanelScroll`, `AppState` interfaces and state management functions (`addPanel`, `updatePanel`, `removePanel`, `toggleVisible`, `togglePause`, `setGlobalPause`, `createDefaultPanel`).

- [ ] **Step 1: Write failing tests for panelStore reducer and utilities**

```typescript
// src/store/panelStore.test.ts
import { describe, it, expect } from 'vitest';
import { panelReducer, createDefaultPanel, AppState } from './panelStore';

describe('panelStore', () => {
  it('creates default panel with standard properties', () => {
    const p = createDefaultPanel('Test Panel');
    expect(p.name).toBe('Test Panel');
    expect(p.style.fontSize).toBe(24);
    expect(p.scroll.mode).toBe('horizontal');
    expect(p.visible).toBe(true);
  });

  it('adds a panel to app state', () => {
    const initialState: AppState = { panels: [], globalPaused: false, hotkey: 'Ctrl+Alt+Space' };
    const newPanel = createDefaultPanel('P1');
    const state = panelReducer(initialState, { type: 'ADD_PANEL', payload: newPanel });
    expect(state.panels).toHaveLength(1);
    expect(state.panels[0].id).toBe(newPanel.id);
  });

  it('updates panel properties', () => {
    const p = createDefaultPanel('P1');
    const initialState: AppState = { panels: [p], globalPaused: false, hotkey: 'Ctrl+Alt+Space' };
    const state = panelReducer(initialState, {
      type: 'UPDATE_PANEL',
      payload: { id: p.id, changes: { text: 'Updated Text' } }
    });
    expect(state.panels[0].text).toBe('Updated Text');
  });

  it('toggles global pause', () => {
    const initialState: AppState = { panels: [], globalPaused: false, hotkey: 'Ctrl+Alt+Space' };
    const s1 = panelReducer(initialState, { type: 'TOGGLE_GLOBAL_PAUSE' });
    expect(s1.globalPaused).toBe(true);
    const s2 = panelReducer(s1, { type: 'TOGGLE_GLOBAL_PAUSE' });
    expect(s2.globalPaused).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/store/panelStore.test.ts`
Expected: FAIL (module `panelStore` not found)

- [ ] **Step 3: Implement `types/panel.ts` and `store/panelStore.ts`**

Define all types adhering to spec Section 4.1, implement immutable reducer operations and default factory.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/store/panelStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/panel.ts src/store/panelStore.ts src/store/panelStore.test.ts
git commit -m "feat: add panel data models and state reducer with tests"
```

---

### Task 3: Precise Smooth Scrolling Engine Hook (TDD)

**Files:**
- Create: `src/hooks/useScrollEngine.ts`
- Create: `src/utils/scrollMath.ts`
- Test: `src/utils/scrollMath.test.ts`

**Interfaces:**
- Consumes: `PanelScroll`
- Produces: `calculateNextOffset(params: ScrollStepParams): number`, and React hook `useScrollEngine` returning `{ offset, isPaused, togglePause }`.

- [ ] **Step 1: Write failing tests for scroll calculation logic**

```typescript
// src/utils/scrollMath.test.ts
import { describe, it, expect } from 'vitest';
import { calculateNextOffset } from './scrollMath';

describe('scrollMath', () => {
  it('does not increment offset when paused or mode is none', () => {
    const res1 = calculateNextOffset({
      mode: 'none',
      currentOffset: 10,
      speed: 50,
      deltaMs: 16,
      containerSize: 400,
      contentSize: 200,
      loop: true,
      paused: false
    });
    expect(res1).toBe(10);

    const res2 = calculateNextOffset({
      mode: 'horizontal',
      currentOffset: 10,
      speed: 50,
      deltaMs: 16,
      containerSize: 400,
      contentSize: 200,
      loop: true,
      paused: true
    });
    expect(res2).toBe(10);
  });

  it('increments offset based on speed and delta time for horizontal scroll', () => {
    // speed 100px/s, 100ms delta => moves 10px
    const next = calculateNextOffset({
      mode: 'horizontal',
      currentOffset: 100,
      speed: 100,
      deltaMs: 100,
      containerSize: 400,
      contentSize: 200,
      loop: true,
      paused: false
    });
    expect(next).toBe(90); // moving left
  });

  it('resets to start position when looping past content bounds', () => {
    // When currentOffset <= -contentSize, reset to containerSize
    const next = calculateNextOffset({
      mode: 'horizontal',
      currentOffset: -195,
      speed: 100,
      deltaMs: 100, // moves -10 => -205 <= -200
      containerSize: 400,
      contentSize: 200,
      loop: true,
      paused: false
    });
    expect(next).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/utils/scrollMath.test.ts`
Expected: FAIL (`scrollMath` not found)

- [ ] **Step 3: Implement `scrollMath.ts` and `useScrollEngine.ts`**

Implement smooth linear displacement with delta-time clamping, bounds checking, looping reset, and hook connecting to `requestAnimationFrame`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/utils/scrollMath.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/scrollMath.ts src/utils/scrollMath.test.ts src/hooks/useScrollEngine.ts
git commit -m "feat: implement delta-time scroll engine math and react hook"
```

---

### Task 4: Rust Backend Data Persistence & Window Management

**Files:**
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/store.rs`
- Create: `src-tauri/src/window_manager.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/store.rs` (inline Rust unit tests)

**Interfaces:**
- Consumes: AppData directory path from Tauri
- Produces: Tauri Commands:
  - `load_panels() -> Result<AppState, String>`
  - `save_panels(state: AppState) -> Result<(), String>`
  - `open_or_focus_overlay(id: String, x: i32, y: i32, w: u32, h: u32) -> Result<(), String>`
  - `close_overlay(id: String) -> Result<(), String>`

- [ ] **Step 1: Write failing Rust unit tests for storage load/save & recovery**

```rust
// In src-tauri/src/store.rs
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_save_and_load_state() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("panels.json");
        let initial_state = AppState::default();
        save_state_to_file(&file_path, &initial_state).unwrap();

        let loaded = load_state_from_file(&file_path).unwrap();
        assert_eq!(loaded.panels.len(), initial_state.panels.len());
    }

    #[test]
    fn test_corrupted_file_recovery() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("panels.json");
        std::fs::write(&file_path, "{ invalid_json ").unwrap();

        let loaded = load_state_from_file(&file_path).unwrap();
        assert!(!loaded.panels.is_empty(), "Should recover with default panel");
        assert!(file_path.with_extension("json.bak").exists(), "Should create backup file");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml test_save_and_load_state`
Expected: FAIL (modules not implemented)

- [ ] **Step 3: Implement `models.rs`, `store.rs`, and `window_manager.rs`**

- `models.rs`: Serde-compatible structs matching TypeScript interfaces.
- `store.rs`: Atomic write, error recovery, backup creation on malformed JSON.
- `window_manager.rs`: WebviewWindow creation with transparent, always-on-top, skip_taskbar settings pointing to `/#/overlay/{id}`.
- Expose commands in `lib.rs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: add rust state storage, window manager, and commands with tests"
```

---

### Task 5: Rust Cursor Polling & Transparent Window Pass-Through Engine

**Files:**
- Create: `src-tauri/src/cursor_poller.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

**Interfaces:**
- Consumes: Active overlay windows list
- Produces: Background worker thread toggling `window.set_ignore_cursor_events` and emitting `overlay:hover-state` with `{ id: String, is_hovered: bool }`.

- [ ] **Step 1: Add dependencies to `src-tauri/Cargo.toml`**

Add `mouse_position` or platform coordinate fetch crate.
```toml
[dependencies]
mouse_position = "0.1"
```

- [ ] **Step 2: Implement geometric hit-test logic and unit test**

```rust
// In src-tauri/src/cursor_poller.rs
pub fn is_point_in_rect_with_padding(
    px: i32,
    py: i32,
    rx: i32,
    ry: i32,
    rw: u32,
    rh: u32,
    padding: i32,
) -> bool {
    px >= rx - padding
        && px <= rx + (rw as i32) + padding
        && py >= ry - padding
        && py <= ry + (rh as i32) + padding
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_inside_rect_padding() {
        assert!(is_point_in_rect_with_padding(95, 95, 100, 100, 200, 100, 10)); // in padding
        assert!(is_point_in_rect_with_padding(150, 150, 100, 100, 200, 100, 10)); // inside
        assert!(!is_point_in_rect_with_padding(80, 80, 100, 100, 200, 100, 10)); // outside
    }
}
```

- [ ] **Step 3: Run test to verify hit-test logic**

Run: `cargo test --manifest-path src-tauri/Cargo.toml test_point_inside_rect_padding`
Expected: PASS

- [ ] **Step 4: Implement cursor polling loop**

Spawn thread with 60ms sleep that polls cursor position, checks against visible overlay windows, updates ignore cursor events state, and emits `overlay:hover-state`.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: add global cursor polling and dynamic pass-through switcher"
```

---

### Task 6: Overlay Window UI & Quick In-Place Editor

**Files:**
- Create: `src/components/OverlayView.tsx`
- Create: `src/components/ResizeHandles.tsx`
- Create: `src/components/QuickEditPopover.tsx`
- Test: `src/components/OverlayView.test.tsx`

**Interfaces:**
- Consumes: `PanelConfig`, `useScrollEngine`, Tauri events (`overlay:hover-state`, `panel:update`)
- Produces: Transparent overlay UI component with drag bar, resize handles, floating quick editor, and scroll rendering.

- [ ] **Step 1: Write failing test for OverlayView display and styling**

```typescript
// src/components/OverlayView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OverlayView } from './OverlayView';
import { createDefaultPanel } from '../store/panelStore';

describe('OverlayView', () => {
  it('renders panel text with custom styling', () => {
    const panel = createDefaultPanel('Test');
    panel.text = 'Teleprompter Line 1';
    panel.style.fontSize = 32;
    panel.style.fontColor = '#ff0000';

    render(<OverlayView panel={panel} isHovered={false} onUpdate={() => {}} />);
    const textEl = screen.getByText('Teleprompter Line 1');
    expect(textEl).toBeInTheDocument();
    expect(textEl.style.fontSize).toBe('32px');
  });

  it('shows controls when isHovered is true', () => {
    const panel = createDefaultPanel('Test');
    render(<OverlayView panel={panel} isHovered={true} onUpdate={() => {}} />);
    expect(screen.getByTestId('overlay-controls')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/OverlayView.test.tsx`
Expected: FAIL (components not found)

- [ ] **Step 3: Implement `OverlayView.tsx`, `ResizeHandles.tsx`, and `QuickEditPopover.tsx`**

- Responsive text container honoring `style.textAlign`, `fontWeight`, `fontStyle`, `bgColor`, `bgOpacity`.
- Smooth scrolling integration using `useScrollEngine`.
- Hover layout with `start_dragging` top bar, resize handles emitting dimension changes, and popover for text/style/speed quick edits.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/OverlayView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/OverlayView.tsx src/components/ResizeHandles.tsx src/components/QuickEditPopover.tsx src/components/OverlayView.test.tsx
git commit -m "feat: implement overlay window view with resize handles and quick editor"
```

---

### Task 7: Main Control Panel UI & System Tray & Global Shortcut

**Files:**
- Create: `src/components/MainDashboard.tsx`
- Create: `src/components/PanelCard.tsx`
- Create: `src/components/PanelEditModal.tsx`
- Modify: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/shortcut.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src/components/MainDashboard.test.tsx`

**Interfaces:**
- Consumes: `AppState`, Tauri IPC commands (`save_panels`, `load_panels`, `open_or_focus_overlay`, `close_overlay`)
- Produces: Complete management dashboard for creating, editing, removing, toggling overlays; system tray menu and global hotkey.

- [ ] **Step 1: Write failing test for MainDashboard panel listing & creation**

```typescript
// src/components/MainDashboard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainDashboard } from './MainDashboard';
import { createDefaultPanel } from '../store/panelStore';

describe('MainDashboard', () => {
  it('renders empty prompt when no panels exist', () => {
    render(<MainDashboard panels={[]} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/暂无文字面板/i)).toBeInTheDocument();
  });

  it('renders panel cards when panels exist', () => {
    const p = createDefaultPanel('台词 1');
    render(<MainDashboard panels={[p]} onAdd={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('台词 1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/MainDashboard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `MainDashboard`, `PanelCard`, and `PanelEditModal`**

- Dashboard header: App title, "+ 新建面板", "全部暂停 / 全部恢复".
- Panel cards: Name, text snippet preview, mode badge (水平跑马灯 / 垂直提词 / 便签), display switch, edit button, delete button.
- Comprehensive edit modal: full typography controls, speed slider, loop switch, background opacity.
- Rust tray & shortcut setup in `tray.rs` and `shortcut.rs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/MainDashboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MainDashboard.tsx src/components/PanelCard.tsx src/components/PanelEditModal.tsx src/components/MainDashboard.test.tsx src-tauri/
git commit -m "feat: implement main control dashboard, system tray, and hotkey control"
```

---

### Task 8: Routing, App Integration & Verification

**Files:**
- Modify: `src/App.tsx`
- Create: `src/router.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `MainDashboard`, `OverlayView`, IPC synchronization
- Produces: Complete working desktop application routing between main window and overlays, with error boundaries and data persistence.

- [ ] **Step 1: Implement Hash router in `App.tsx`**

Route hash `#` or `#/` -> `MainDashboard`
Route hash `#/overlay/:id` -> `OverlayView` for specific panel config.

- [ ] **Step 2: Wire cross-window synchronization & auto-save**

Listen to `panel:update`, `panel:sync-rect`, `panel:toggle-global-pause` events. Debounce `save_panels` calls (300ms) on state modification.

- [ ] **Step 3: Run comprehensive test suites**

Run: `pnpm vitest run`
Expected: All tests pass.

- [ ] **Step 4: Run typecheck and frontend build**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Verify Rust compilation**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete application router, event bus integration, and verification"
```
