import React from 'react';
import { PanelConfig } from '../types/panel';
import { Play, Pause, Trash2, Settings, Eye, EyeOff } from 'lucide-react';

export interface PanelCardProps {
  panel: PanelConfig;
  globalPaused?: boolean;
  onUpdate: (panel: PanelConfig) => void;
  onDelete: (id: string) => void;
  onToggleVisible?: (id: string) => void;
  onTogglePause?: (id: string) => void;
  onEdit?: (panel: PanelConfig) => void;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  panel,
  globalPaused = false,
  onUpdate,
  onDelete,
  onToggleVisible,
  onTogglePause,
  onEdit,
}) => {
  const getModeLabel = () => {
    switch (panel.scroll.mode) {
      case 'horizontal':
        return '水平跑马灯';
      case 'vertical':
        return '垂直提词器';
      case 'none':
      default:
        return '静态便签';
    }
  };

  const getModeBadgeClass = () => {
    switch (panel.scroll.mode) {
      case 'horizontal':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
      case 'vertical':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'none':
      default:
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50';
    }
  };

  const isPaused = globalPaused || panel.scroll.paused;

  const handleToggleVisible = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleVisible) {
      onToggleVisible(panel.id);
    } else {
      onUpdate({ ...panel, visible: !panel.visible });
    }
  };

  const handleTogglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePause) {
      onTogglePause(panel.id);
    } else {
      onUpdate({
        ...panel,
        scroll: {
          ...panel.scroll,
          paused: !panel.scroll.paused,
        },
      });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(`确定要删除面板 "${panel.name}" 吗？`);
    if (confirmed) {
      onDelete(panel.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(panel);
  };

  return (
    <div
      data-testid={`panel-card-${panel.id}`}
      className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur transition-all duration-200 hover:border-slate-700 hover:shadow-xl"
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3
            className="font-semibold text-slate-100 text-base truncate max-w-[200px]"
            title={panel.name}
          >
            {panel.name}
          </h3>
          <span
            className={`px-2 py-0.5 text-xs rounded-full border font-medium ${getModeBadgeClass()}`}
          >
            {getModeLabel()}
          </span>
        </div>

        <div className="rounded-lg bg-slate-950/60 p-3 mb-4 border border-slate-800/80 min-h-[56px] flex items-center">
          <p className="text-sm text-slate-300 line-clamp-2 break-all select-none">
            {panel.text || <span className="italic text-slate-500">无内容</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
        {/* Visibility switch */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid={`toggle-visible-${panel.id}`}
            onClick={handleToggleVisible}
            title={panel.visible ? '隐藏面板' : '显示面板'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              panel.visible
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {panel.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{panel.visible ? '已显示' : '已隐藏'}</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {panel.scroll.mode !== 'none' && (
            <button
              type="button"
              data-testid={`toggle-pause-${panel.id}`}
              onClick={handleTogglePause}
              title={isPaused ? '继续播放' : '暂停播放'}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            data-testid={`edit-panel-${panel.id}`}
            onClick={handleEdit}
            title="编辑面板"
            className="p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-testid={`delete-panel-${panel.id}`}
            onClick={handleDelete}
            title="删除面板"
            className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
