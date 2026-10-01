import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PanelConfig, PanelScroll } from '../types/panel';
import { X } from 'lucide-react';

export interface QuickEditPopoverProps {
  panel: PanelConfig;
  onUpdate: (panel: PanelConfig) => void;
  onClose: () => void;
}

export const QuickEditPopover: React.FC<QuickEditPopoverProps> = ({
  panel,
  onUpdate,
  onClose,
}) => {
  // Keep overlay window interactive in Tauri while popover is open
  useEffect(() => {
    let isCancelled = false;

    async function setCursorLock(ignore: boolean) {
      try {
        if (!isCancelled) {
          await invoke('set_overlay_ignore_cursor', { id: panel.id, ignore });
        }
      } catch {
        // Ignore outside Tauri
      }
    }

    void setCursorLock(false);

    return () => {
      isCancelled = true;
      void setCursorLock(true);
    };
  }, [panel.id]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({
      ...panel,
      text: e.target.value,
    });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    onUpdate({
      ...panel,
      style: {
        ...panel.style,
        fontSize: Math.max(8, isNaN(val) ? panel.style.fontSize : val),
      },
    });
  };

  const handleFontColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      ...panel,
      style: {
        ...panel.style,
        fontColor: e.target.value,
      },
    });
  };

  const handleBgColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      ...panel,
      style: {
        ...panel.style,
        bgColor: e.target.value,
      },
    });
  };

  const handleBgOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const opacity = parseFloat(e.target.value);
    onUpdate({
      ...panel,
      style: {
        ...panel.style,
        bgOpacity: Math.min(1, Math.max(0, isNaN(opacity) ? panel.style.bgOpacity : opacity)),
      },
    });
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = Number(e.target.value);
    onUpdate({
      ...panel,
      scroll: {
        ...panel.scroll,
        speed: Math.max(0, isNaN(speed) ? panel.scroll.speed : speed),
      },
    });
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate({
      ...panel,
      scroll: {
        ...panel.scroll,
        mode: e.target.value as PanelScroll['mode'],
      },
    });
  };

  const handleLoopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      ...panel,
      scroll: {
        ...panel.scroll,
        loop: e.target.checked,
      },
    });
  };

  return (
    <div
      data-testid="quick-edit-popover"
      className="absolute top-10 left-2 right-2 max-w-sm mx-auto z-50 bg-slate-900/95 text-slate-100 border border-slate-700 rounded-lg shadow-2xl p-3 text-xs flex flex-col gap-2.5 backdrop-blur cursor-default select-none max-h-[calc(100vh-32px)] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 shrink-0">
        <span className="font-semibold text-sky-400">快速设置</span>
        <button
          type="button"
          data-testid="close-popover-btn"
          aria-label="关闭快速编辑"
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Text Content */}
      <div className="flex flex-col gap-1">
        <label className="text-slate-400 text-[11px]">文本内容</label>
        <textarea
          data-testid="edit-text-input"
          value={panel.text}
          onChange={handleTextChange}
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:border-sky-500 resize-none select-text"
        />
      </div>

      {/* Row: Font size & Font color */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-[11px]">字号 (px)</label>
          <input
            type="number"
            data-testid="edit-font-size-input"
            value={panel.style.fontSize}
            onChange={handleFontSizeChange}
            min={8}
            max={200}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 select-text"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-[11px]">文字颜色</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              data-testid="edit-font-color-input"
              value={panel.style.fontColor}
              onChange={handleFontColorChange}
              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent select-text"
            />
            <span className="font-mono text-[11px] text-slate-300">{panel.style.fontColor}</span>
          </div>
        </div>
      </div>

      {/* Row: Background color & Background opacity */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-[11px]">背景颜色</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              data-testid="edit-bg-color-input"
              value={panel.style.bgColor}
              onChange={handleBgColorChange}
              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent select-text"
            />
            <span className="font-mono text-[11px] text-slate-300">{panel.style.bgColor}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-[11px]">
            背景不透明度: {Math.round(panel.style.bgOpacity * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            data-testid="edit-bg-opacity-input"
            value={panel.style.bgOpacity}
            onChange={handleBgOpacityChange}
            className="w-full accent-sky-500 cursor-pointer mt-1 select-text"
          />
        </div>
      </div>

      {/* Row: Scroll mode & Speed */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-[11px]">滚动模式</label>
          <select
            data-testid="edit-scroll-mode-select"
            value={panel.scroll.mode}
            onChange={handleModeChange}
            className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500 select-text"
          >
            <option value="none">静止便签</option>
            <option value="horizontal">水平跑马灯</option>
            <option value="vertical">垂直滚动</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-slate-400 text-[11px]">速度 (px/s)</label>
          <input
            type="number"
            data-testid="edit-scroll-speed-input"
            value={panel.scroll.speed}
            onChange={handleSpeedChange}
            min={0}
            max={500}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 select-text"
          />
        </div>
      </div>

      {/* Row: Loop toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <label className="text-slate-400 text-[11px] cursor-pointer" htmlFor="edit-loop-checkbox">
          循环滚动
        </label>
        <input
          id="edit-loop-checkbox"
          type="checkbox"
          data-testid="edit-loop-checkbox"
          checked={panel.scroll.loop}
          onChange={handleLoopChange}
          className="w-4 h-4 accent-sky-500 rounded cursor-pointer select-text"
        />
      </div>
    </div>
  );
};
