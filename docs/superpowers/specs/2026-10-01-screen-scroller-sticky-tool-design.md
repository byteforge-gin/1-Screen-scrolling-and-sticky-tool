# 屏幕滚动字幕 / 便签工具 (Screen Scroller & Sticky Tool) 架构设计规范

## 1. 目标与概述

本项目是一款基于 **Tauri 2.x + React + TypeScript + Tailwind CSS** 的跨平台桌面工具（优先 Windows/macOS 开发与构建），服务于两类核心场景：
1. **提词器 (Teleprompter)**：直播、录屏或会议时置顶、平滑滚动显示讲稿或台词。
2. **桌面便签 (Sticky Notes)**：常驻屏幕置顶显示提醒文字，静态无边框展示。

核心特性要求：极小资源占用（< 15MB 打包体积）、支持创建多面板、智能无感穿透与悬停激活、全参数持久化。

---

## 2. 系统拓扑与窗口模型

系统采用多窗口架构，包含一个常驻主控制面板和任意数量的透明覆盖层面板（Overlay）：

```
+-------------------------------------------------------------+
|                     Tauri 2.x Core (Rust)                   |
|  - 状态持久化中心 (JSON SSOT)                                 |
|  - 窗口生命周期调度 (Main Window / Overlays)                 |
|  - 全局光标轮询检测器 (Cursor Poller) -> 穿透切换             |
|  - 全局快捷键注册 (Global Shortcut: Pause/Resume)            |
|  - 系统托盘服务 (System Tray Menu)                          |
+-------------------------------------------------------------+
             |                                 |
      Tauri IPC Event / Command         Tauri IPC Event / Command
             v                                 v
+-----------------------------+   +-----------------------------+
|   Main Window (React SPA)   |   | Overlay Windows (React SPA) |
|   Route: /#/                |   | Route: /#/overlay/:id       |
| - 面板列表展示与增删改查    |   | - 透明置顶、无边框渲染      |
| - 样式/参数详细配置编辑     |   | - rAF 平滑跑马灯/提词器引擎 |
| - 全局启停开关与托盘联动    |   | - 悬停高亮操作栏与就地快编  |
+-----------------------------+   +-----------------------------+
```

### 2.1 主控制台窗口 (`main`)
- **窗口属性**：`decorations: true`, `transparent: false`, `always_on_top: false`, 默认尺寸 `800x600`。
- **行为规范**：
  - 点击关闭按钮不退出进程，而是隐藏到后台。
  - 通过系统托盘图标左键点击或右键菜单“显示主面板”唤醒。

### 2.2 覆盖层窗口 (`overlay_${id}`)
- **窗口属性**：`transparent: true`, `decorations: false`, `always_on_top: true`, `skip_taskbar: true`。
- **背景设置**：HTML/CSS 根容器背景完全透明（`rgba(0,0,0,0)`）。
- **生命周期**：根据面板配置中的 `visible: true` 动态创建与展示；当用户关闭或隐藏该面板时销毁或隐藏窗口。

---

## 3. 全局光标轮询与穿透/悬停机制

为实现“默认鼠标点击穿透、悬停自动唤醒控制手柄”的效果，系统在 Rust 端实现全局光标轮询状态机：

1. **采样频率**：Rust 后台维持轻量轮询线程（采样间隔 60ms）。
2. **命中检测**：
   - 提取所有处于打开状态的 Overlay 窗口全局绝对屏幕矩形 `(win_x, win_y, win_w, win_h)`。
   - 判定全局光标 `(cur_x, cur_y)` 是否落在外扩 `12px` 缓冲区（Padding 热区）内。
3. **状态机转换**：
   - **进入热区**：
     - 若当前窗口处于穿透状态，调用 `window.set_ignore_cursor_events(false)`。
     - 发送前端事件 `overlay:hover-state`，参数 `{ id, isHovered: true }`。
     - 前端展示淡色半透明外边框、四角/四边 8 个缩放手柄、顶部拖动把手及快捷工具条。
   - **离开热区**：
     - 若非用户正在拖动或处于浮层编辑状态，调用 `window.set_ignore_cursor_events(true)`。
     - 发送前端事件 `overlay:hover-state`，参数 `{ id, isHovered: false }`。
     - 前端隐藏边框与操作手柄，恢复鼠标完全点击穿透。
4. **多屏异常保护**：
   - 当屏幕分辨率改变或拔掉外接屏幕时，若窗口坐标超出任何物理屏幕可见矩形，自动拉回主显示器可视中心区域。

---

## 4. 数据模型与持久化规范

### 4.1 数据模型定义 (TypeScript)

```typescript
export interface PanelPosition {
  x: number;
  y: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface PanelStyle {
  fontSize: number;          // 像素，默认 24
  fontColor: string;         // 默认 "#ffffff"
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  bgColor: string;           // 默认 "#000000"
  bgOpacity: number;         // 0 ~ 1，默认 0.5
  textAlign: 'left' | 'center' | 'right';
  textShadow: boolean;       // 字体阴影
}

export interface PanelScroll {
  mode: 'none' | 'horizontal' | 'vertical'; // none: 静态便签; horizontal: 跑马灯; vertical: 垂直提词器
  speed: number;             // 像素/秒，默认 50
  loop: boolean;             // 循环滚动
  paused: boolean;           // 单个面板暂停状态
}

export interface PanelConfig {
  id: string;                // uuid
  name: string;              // 面板显示名称
  text: string;              // 滚动/展示文本内容
  position: PanelPosition;   // 屏幕坐标
  size: PanelSize;           // 像素尺寸
  style: PanelStyle;         // 外观样式
  scroll: PanelScroll;       // 滚动控制
  visible: boolean;          // 是否显示在屏幕上
}

export interface AppState {
  panels: PanelConfig[];
  globalPaused: boolean;     // 全局暂停标志
  hotkey: string;            // 快捷键，默认 "Ctrl+Alt+Space"
}
```

### 4.2 数据持久化与容灾
- **存储位置**：本地 JSON 文件 `{app_data_dir}/pinmu-gundong/panels.json`。
- **读写原则**：
  - 由 Rust 后端作为单一管理端，前端调用 Tauri Command `save_panels` 与 `load_panels`。
  - **防抖保存**：前端修改或拖拽改变窗口位置后以 300ms 防抖同步。
  - **异常兜底**：若文件损坏或解析失败，将旧文件重命名备份为 `panels.json.bak` 并初始化包含 1 条默认演示便签的全新状态。

---

## 5. 滚动动画引擎与交互细节

### 5.1 滚动引擎实现 (`useScrollEngine`)
- 采用 `requestAnimationFrame` 并以真实时间差 `deltaTime = currentTime - lastTime` 计算位移：
  - `offset += (speed * deltaTime) / 1000`
- **水平跑马灯 (horizontal)**：
  - 内容宽度 `contentWidth`，视口宽度 `containerWidth`。
  - 从 `containerWidth` 偏移向左移动至 `-contentWidth`。若 `loop: true`，平滑复位至 `containerWidth` 继续循环。
- **垂直提词器 (vertical)**：
  - 内容高度 `contentHeight`，视口高度 `containerHeight`。
  - 从视口底部向上滚动，当末行移出视口顶部，若 `loop: true` 则从底部重新开始。
- **单停/全局暂停**：
  - 当 `scroll.paused == true` 或 `appState.globalPaused == true` 时，`rAF` 保持渲染循环但不累加 `offset`，保证恢复时位置零跳跃。

### 5.2 窗口交互与手柄行为
- **拖动位置**：在悬停状态下，按下顶部标题栏把手或非文本背景区，调用 `window.start_dragging()` 触发原生窗口平滑移动。
- **调整尺寸**：四角与四边共 8 个手柄，`mousedown` 捕获鼠标偏移，实时计算最新尺寸并调用 `window.set_size(LogicalSize)`。
- **就地编辑 (Quick Edit)**：悬停时在右上角展示悬浮操作条：
  - 播放/暂停快捷按钮
  - 字体大小快速增减 (`+` / `-`)
  - 铅笔图标打开就地 Popover（可修改文字、字色、背景透明度、速度），支持所见即所得实时预览。

---

## 6. 系统托盘与快捷键

### 6.1 系统托盘
- **托盘图标**：提供清爽高对比度小图标。
- **菜单项**：
  - `显示控制面板` (唤醒并置顶主窗口)
  - `暂停所有字幕 / 继续所有字幕` (切换全局状态)
  - `全部隐藏 / 全部显示` (批量控制 Overlay)
  - 分隔线
  - `退出程序` (真正退出进程)

### 6.2 全局快捷键
- 默认监听 `Ctrl+Alt+Space`（macOS 上为 `Cmd+Alt+Space`）。
- 触发时切换 `globalPaused` 状态并广播 `panel:global-pause-changed` 事件，无延时通知所有正在滚动的 Overlay 暂停或继续。

---

## 7. 测试与验证策略

1. **单元测试 (Vitest)**：
   - 滚动引擎数学计算测试：`horizontal` 与 `vertical` 边界位置重置与步进。
   - 状态更新测试：面板新增、修改、删除、可见性切换 Reducer 纯函数测试。
2. **Rust 后端验证**：
   - 配置文件序列化与损坏修复逻辑单元测试。
   - 物理屏幕边界校正函数测试。
3. **集成与手动验证矩阵**：
   - 单面板与多面板并发创建与销毁。
   - 穿透状态与悬停手柄唤醒响应速度。
   - 跨分辨率与多显示器拖拽。
   - 重启程序后的位置、内容、样式恢复精度。
