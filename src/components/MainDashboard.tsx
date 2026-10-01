import React, { useState } from 'react';
import { PanelConfig, AppState } from '../types/panel';
import { PanelCard } from './PanelCard';
import { PanelEditModal } from './PanelEditModal';
import { Plus, Pause, Play, LayoutGrid } from 'lucide-react';

export interface MainDashboardProps {
  state?: AppState;
  panels?: PanelConfig[];
  globalPaused?: boolean;
  onAdd: () => void;
  onUpdate: (panel: PanelConfig) => void;
  onDelete: (id: string) => void;
  onToggleGlobalPause?: () => void;
  onToggleVisible?: (id: string) => void;
  onTogglePause?: (id: string) => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  state,
  panels: propsPanels,
  globalPaused: propsGlobalPaused,
  onAdd,
  onUpdate,
  onDelete,
  onToggleGlobalPause,
  onToggleVisible,
  onTogglePause,
}) => {
  const panels = propsPanels ?? state?.panels ?? [];
  const globalPaused = propsGlobalPaused ?? state?.globalPaused ?? false;
  const [editingPanel, setEditingPanel] = useState<PanelConfig | null>(null);

  const handleEditSave = (updated: PanelConfig) => {
    onUpdate(updated);
    setEditingPanel(null);
  };

  const handleEditClose = () => {
    setEditingPanel(null);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-950 text-slate-100">
      {/* Top Navbar / Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">屏幕字幕与便签管理</h1>
            <p className="text-xs text-slate-400">Screen Scroller &amp; Sticky Tool</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onToggleGlobalPause && (
            <button
              type="button"
              data-testid="global-pause-btn"
              onClick={onToggleGlobalPause}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                globalPaused
                  ? 'border-emerald-600/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-amber-600/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {globalPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>全部恢复 (全部继续)</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>全部暂停</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            data-testid="add-panel-btn"
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ 新建面板</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6">
        {panels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-12 text-center my-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400 mb-4 border border-slate-700/50">
              <LayoutGrid className="w-7 h-7" />
            </div>
            <h2 className="text-base font-semibold text-slate-200">
              暂无文字面板，点击右上角新建面板
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              创建跑马灯、提词器或便签，轻松在屏幕任何位置置顶滚动展示台词与备忘。
            </p>
            <button
              type="button"
              onClick={onAdd}
              className="mt-5 flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
            >
              <Plus className="w-4 h-4" />
              <span>立即新建面板</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {panels.map((panel) => (
              <PanelCard
                key={panel.id}
                panel={panel}
                globalPaused={globalPaused}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onToggleVisible={onToggleVisible}
                onTogglePause={onTogglePause}
                onEdit={(p) => setEditingPanel(p)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingPanel && (
        <PanelEditModal
          panel={editingPanel}
          isOpen={true}
          onSave={handleEditSave}
          onClose={handleEditClose}
        />
      )}
    </div>
  );
};
