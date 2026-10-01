import React, { useState, useEffect, useRef } from 'react';
import { PanelConfig } from '../types/panel';
import { useScrollEngine } from '../hooks/useScrollEngine';
import { ResizeHandles } from './ResizeHandles';
import { QuickEditPopover } from './QuickEditPopover';
import { GripHorizontal, Play, Pause, Plus, Minus, Pencil } from 'lucide-react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalPosition } from '@tauri-apps/api/dpi';

export interface OverlayViewProps {
  panel: PanelConfig;
  isHovered?: boolean;
  onUpdate: (panel: PanelConfig) => void;
  globalPaused?: boolean;
}

/**
 * Converts a hex or rgb/rgba color string into an rgba string with the specified opacity.
 */
export function hexToRgba(hexOrColor: string, opacity: number): string {
  const clampedOpacity = Math.min(1, Math.max(0, opacity));
  const trimmed = hexOrColor.trim();

  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
    }
  }

  const rgbMatch = trimmed.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${clampedOpacity})`;
  }

  const rgbaMatch = trimmed.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/i);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${clampedOpacity})`;
  }

  return trimmed;
}

export const OverlayView: React.FC<OverlayViewProps> = ({
  panel,
  isHovered,
  onUpdate,
  globalPaused = false,
}) => {
  const [internalHover, setInternalHover] = useState(false);
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: panel.size?.width || 400,
    height: panel.size?.height || 120,
  });

  const [contentDimensions, setContentDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Effective hover state prefers prop if provided, else falls back to internal state
  const effectiveHover = isHovered !== undefined ? isHovered : internalHover;

  // Listen to Tauri event `overlay:hover-state` if running in Tauri environment
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let isCancelled = false;

    listen<{ id: string; isHovered?: boolean; is_hovered?: boolean }>(
      'overlay:hover-state',
      (event) => {
        if (event.payload.id === panel.id) {
          const hovered = Boolean(event.payload.isHovered ?? event.payload.is_hovered);
          setInternalHover(hovered);
        }
      }
    )
      .then((fn) => {
        if (isCancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {
        // Tauri events not available in pure browser/test mode
      });

    return () => {
      isCancelled = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [panel.id]);

  // Measure container and content sizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerDimensions({
          width: rect.width || containerRef.current.clientWidth || panel.size.width,
          height: rect.height || containerRef.current.clientHeight || panel.size.height,
        });
      }
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect();
        setContentDimensions({
          width: Math.max(rect.width, contentRef.current.scrollWidth, contentRef.current.clientWidth),
          height: Math.max(rect.height, contentRef.current.scrollHeight, contentRef.current.clientHeight),
        });
      }
    };

    updateDimensions();

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const ro = new ResizeObserver(() => updateDimensions());
      ro.observe(containerRef.current);
      if (contentRef.current) {
        ro.observe(contentRef.current);
      }
      return () => ro.disconnect();
    }
  }, [panel.text, panel.style, panel.size]);

  // Determine viewport and content size for scroll engine based on mode
  const containerSize =
    panel.scroll.mode === 'horizontal'
      ? containerDimensions.width
      : panel.scroll.mode === 'vertical'
        ? containerDimensions.height
        : 0;

  const contentSize =
    panel.scroll.mode === 'horizontal'
      ? contentDimensions.width
      : panel.scroll.mode === 'vertical'
        ? contentDimensions.height
        : 0;

  const { offset, isPaused, togglePause } = useScrollEngine(
    panel.scroll,
    containerSize,
    contentSize,
    globalPaused,
    0
  );

  const handlePanelMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) {
      return;
    }

    const target = e.target as HTMLElement;

    // Do not trigger window drag if clicking on interactive controls
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[data-testid="quick-edit-popover"]') ||
      target.closest('[data-direction]')
    ) {
      return;
    }

    // Try native OS drag
    try {
      void getCurrentWebviewWindow().startDragging();
    } catch {
      // Ignore outside Tauri
    }

    // Direct pointer tracking drag fallback (especially robust for Windows WebView2)
    const startScreenX = e.screenX || e.clientX;
    const startScreenY = e.screenY || e.clientY;
    const startPosX = panel.position.x;
    const startPosY = panel.position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const currentX = moveEvent.screenX || moveEvent.clientX;
      const currentY = moveEvent.screenY || moveEvent.clientY;
      const deltaX = currentX - startScreenX;
      const deltaY = currentY - startScreenY;

      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        const newX = startPosX + deltaX;
        const newY = startPosY + deltaY;

        try {
          const win = getCurrentWebviewWindow();
          void win.setPosition(new LogicalPosition(newX, newY));
        } catch {
          // Ignore outside Tauri
        }

        onUpdate({
          ...panel,
          position: { x: newX, y: newY },
        });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTogglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePause();
    onUpdate({
      ...panel,
      scroll: {
        ...panel.scroll,
        paused: !isPaused,
      },
    });
  };

  const handleIncreaseFontSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({
      ...panel,
      style: {
        ...panel.style,
        fontSize: panel.style.fontSize + 2,
      },
    });
  };

  const handleDecreaseFontSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({
      ...panel,
      style: {
        ...panel.style,
        fontSize: Math.max(8, panel.style.fontSize - 2),
      },
    });
  };

  const handleToggleQuickEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsQuickEditOpen((prev) => !prev);
  };

  // Transform calculation based on scroll mode
  const getTransform = () => {
    if (panel.scroll.mode === 'horizontal') {
      return `translateX(${offset}px)`;
    }
    if (panel.scroll.mode === 'vertical') {
      return `translateY(${offset}px)`;
    }
    return 'none';
  };

  const isHorizontal = panel.scroll.mode === 'horizontal';

  return (
    <div
      ref={containerRef}
      data-testid="overlay-container"
      data-tauri-drag-region
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      onMouseDown={handlePanelMouseDown}
      style={{
        backgroundColor: hexToRgba(panel.style.bgColor, panel.style.bgOpacity),
        width: '100%',
        height: '100%',
      }}
      className={`relative w-full h-full select-none transition-colors duration-150 ${
        effectiveHover ? 'border-2 border-sky-400/80 shadow-lg cursor-move' : 'border-2 border-transparent'
      }`}
    >
      {/* Hover Controls Top Bar */}
      {effectiveHover && (
        <div
          data-testid="overlay-controls"
          data-tauri-drag-region
          className="absolute top-1 left-1 right-1 z-40 flex items-center justify-between px-2 py-1 bg-slate-900/85 backdrop-blur text-white rounded shadow text-xs border border-slate-700/60 cursor-move"
        >
          {/* Drag Handle */}
          <div
            data-testid="drag-handle"
            data-tauri-drag-region
            className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-white px-1 py-0.5 rounded hover:bg-slate-800"
            title="按住拖拽窗口"
          >
            <GripHorizontal className="w-4 h-4 pointer-events-none" />
            <span className="text-[11px] font-medium pointer-events-none">{panel.name}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Play / Pause */}
            <button
              type="button"
              data-testid="toggle-pause-btn"
              onClick={handleTogglePause}
              aria-label={isPaused ? '播放' : '暂停'}
              className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isPaused ? '恢复滚动' : '暂停滚动'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            </button>

            {/* Font Size Plus */}
            <button
              type="button"
              data-testid="font-size-plus"
              onClick={handleIncreaseFontSize}
              aria-label="增大字号"
              className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="增大字号 (+2px)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* Font Size Minus */}
            <button
              type="button"
              data-testid="font-size-minus"
              onClick={handleDecreaseFontSize}
              aria-label="减小字号"
              className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="减小字号 (-2px)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Quick Edit Popover Toggle */}
            <button
              type="button"
              data-testid="quick-edit-btn"
              onClick={handleToggleQuickEdit}
              aria-label="快速编辑"
              className={`p-1 rounded transition-colors cursor-pointer ${
                isQuickEditOpen
                  ? 'bg-sky-500 text-white'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
              title="快速设置"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Resize Handles when hovered */}
      {effectiveHover && <ResizeHandles panel={panel} onUpdate={onUpdate} />}

      {/* Quick In-Place Edit Popover */}
      {effectiveHover && isQuickEditOpen && (
        <QuickEditPopover
          panel={panel}
          onUpdate={onUpdate}
          onClose={() => setIsQuickEditOpen(false)}
        />
      )}

      {/* Text / Scrolling Content Viewport */}
      <div
        data-testid="scroll-viewport"
        data-tauri-drag-region
        className={`w-full h-full overflow-hidden p-2 flex ${
          effectiveHover ? 'cursor-move' : ''
        } ${
          panel.scroll.mode === 'horizontal'
            ? 'justify-start items-center'
            : panel.scroll.mode === 'vertical'
              ? 'items-start justify-start w-full'
              : 'items-center justify-start w-full'
        }`}
      >
        <div
          ref={contentRef}
          data-testid="scroll-content"
          data-tauri-drag-region
          className={`pointer-events-auto ${effectiveHover ? 'cursor-move' : ''}`}
          style={{
            transform: getTransform(),
            whiteSpace: isHorizontal ? 'nowrap' : 'pre-wrap',
            fontSize: `${panel.style.fontSize}px`,
            color: panel.style.fontColor,
            fontWeight: panel.style.fontWeight,
            fontStyle: panel.style.fontStyle,
            textAlign: panel.style.textAlign,
            textShadow: panel.style.textShadow ? '0 2px 4px rgba(0, 0, 0, 0.8)' : 'none',
            display: isHorizontal ? 'inline-block' : 'block',
            width: isHorizontal ? 'auto' : '100%',
            maxWidth: isHorizontal ? 'none' : '100%',
            willChange: panel.scroll.mode === 'none' ? 'auto' : 'transform',
          }}
        >
          {panel.text}
        </div>
      </div>
    </div>
  );
};
