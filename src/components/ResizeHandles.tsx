import React, { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PanelConfig } from '../types/panel';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export interface ResizeHandlesProps {
  panel: PanelConfig;
  onUpdate: (panel: PanelConfig) => void;
  minWidth?: number;
  minHeight?: number;
}

const HANDLE_CONFIGS: {
  direction: ResizeDirection;
  className: string;
}[] = [
  // Corners
  {
    direction: 'nw',
    className: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize w-3 h-3',
  },
  {
    direction: 'ne',
    className: 'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize w-3 h-3',
  },
  {
    direction: 'sw',
    className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize w-3 h-3',
  },
  {
    direction: 'se',
    className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize w-3 h-3',
  },
  // Edges
  {
    direction: 'n',
    className: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize w-6 h-2',
  },
  {
    direction: 's',
    className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize w-6 h-2',
  },
  {
    direction: 'w',
    className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize w-2 h-6',
  },
  {
    direction: 'e',
    className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize w-2 h-6',
  },
];

async function syncTauriWindow(width: number, height: number, x: number, y: number) {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const { LogicalSize, LogicalPosition } = await import('@tauri-apps/api/dpi');
    const win = getCurrentWebviewWindow();
    await win.setSize(new LogicalSize(width, height));
    await win.setPosition(new LogicalPosition(x, y));
  } catch {
    // Gracefully ignore outside Tauri
  }
}

async function setIgnoreCursor(id: string, ignore: boolean) {
  try {
    await invoke('set_overlay_ignore_cursor', { id, ignore });
  } catch {
    // Ignore outside Tauri
  }
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  panel,
  onUpdate,
  minWidth = 100,
  minHeight = 40,
}) => {
  const handleMouseDown = useCallback(
    (direction: ResizeDirection, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.screenX || e.clientX;
      const startY = e.screenY || e.clientY;
      const startWidth = panel.size.width;
      const startHeight = panel.size.height;
      const startPosX = panel.position.x;
      const startPosY = panel.position.y;

      void setIgnoreCursor(panel.id, false);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const currentScreenX = moveEvent.screenX || moveEvent.clientX;
        const currentScreenY = moveEvent.screenY || moveEvent.clientY;
        const deltaX = currentScreenX - startX;
        const deltaY = currentScreenY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newPosX = startPosX;
        let newPosY = startPosY;

        if (direction.includes('e')) {
          newWidth = Math.max(minWidth, startWidth + deltaX);
        } else if (direction.includes('w')) {
          const maxDeltaX = startWidth - minWidth;
          const appliedDeltaX = Math.min(deltaX, maxDeltaX);
          newWidth = startWidth - appliedDeltaX;
          newPosX = startPosX + appliedDeltaX;
        }

        if (direction.includes('s')) {
          newHeight = Math.max(minHeight, startHeight + deltaY);
        } else if (direction.includes('n')) {
          const maxDeltaY = startHeight - minHeight;
          const appliedDeltaY = Math.min(deltaY, maxDeltaY);
          newHeight = startHeight - appliedDeltaY;
          newPosY = startPosY + appliedDeltaY;
        }

        void syncTauriWindow(newWidth, newHeight, newPosX, newPosY);

        onUpdate({
          ...panel,
          position: { x: newPosX, y: newPosY },
          size: { width: newWidth, height: newHeight },
        });
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        void setIgnoreCursor(panel.id, true);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [panel, onUpdate, minWidth, minHeight]
  );

  return (
    <>
      {HANDLE_CONFIGS.map(({ direction, className }) => (
        <div
          key={direction}
          data-testid={`resize-handle-${direction}`}
          data-direction={direction}
          aria-label={`Resize handle ${direction}`}
          className={`absolute z-50 bg-sky-500 border border-white shadow-sm rounded-sm hover:scale-125 transition-transform ${className}`}
          onMouseDown={(e) => handleMouseDown(direction, e)}
        />
      ))}
    </>
  );
};
