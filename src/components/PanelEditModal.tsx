import React, { useState, useEffect } from 'react';
import { PanelConfig } from '../types/panel';
import { hexToRgba } from './OverlayView';
import { X, Check } from 'lucide-react';

export interface PanelEditModalProps {
  panel: PanelConfig;
  isOpen: boolean;
  onSave: (updated: PanelConfig) => void;
  onClose: () => void;
}

export const PanelEditModal: React.FC<PanelEditModalProps> = ({
  panel,
  isOpen,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<PanelConfig>({ ...panel });

  useEffect(() => {
    setFormData({ ...panel });
  }, [panel, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const previewBg = hexToRgba(formData.style.bgColor, formData.style.bgOpacity);
  const textShadowStyle = formData.style.textShadow
    ? '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)'
    : 'none';

  return (
    <div
      data-testid="panel-edit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl my-8 text-slate-100 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold tracking-tight text-white">编辑面板属性</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* Live Preview Box */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              实时效果预览
            </span>
            <div
              data-testid="modal-live-preview"
              className="flex items-center justify-center rounded-xl border border-slate-700/60 p-4 min-h-[100px] overflow-hidden"
              style={{
                backgroundColor: previewBg,
              }}
            >
              <div
                style={{
                  fontSize: `${formData.style.fontSize}px`,
                  color: formData.style.fontColor,
                  fontWeight: formData.style.fontWeight,
                  fontStyle: formData.style.fontStyle,
                  textAlign: formData.style.textAlign,
                  textShadow: textShadowStyle,
                  width: '100%',
                  whiteSpace: formData.scroll.mode === 'horizontal' ? 'nowrap' : 'normal',
                }}
              >
                {formData.text || <span className="opacity-40 italic">（空内容）</span>}
              </div>
            </div>
          </div>

          {/* Section 1: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-medium text-slate-300">面板名称</label>
              <input
                type="text"
                data-testid="modal-input-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                placeholder="例如：提词器 1"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-medium text-slate-300">文字内容</label>
              <textarea
                data-testid="modal-input-text"
                rows={3}
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                placeholder="请输入要展示滚动的文字内容..."
              />
            </div>
          </div>

          {/* Section 2: Position & Size */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              位置与尺寸
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">X 坐标 (px)</label>
                <input
                  type="number"
                  data-testid="modal-input-pos-x"
                  value={formData.position.x}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      position: { ...formData.position, x: Number(e.target.value) },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Y 坐标 (px)</label>
                <input
                  type="number"
                  data-testid="modal-input-pos-y"
                  value={formData.position.y}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      position: { ...formData.position, y: Number(e.target.value) },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">宽度 (px)</label>
                <input
                  type="number"
                  data-testid="modal-input-width"
                  value={formData.size.width}
                  min={100}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      size: { ...formData.size, width: Number(e.target.value) },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">高度 (px)</label>
                <input
                  type="number"
                  data-testid="modal-input-height"
                  value={formData.size.height}
                  min={40}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      size: { ...formData.size, height: Number(e.target.value) },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Typography & Style */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              排版与样式
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">字号 (px)</label>
                <input
                  type="number"
                  data-testid="modal-input-fontsize"
                  value={formData.style.fontSize}
                  min={12}
                  max={200}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      style: { ...formData.style, fontSize: Number(e.target.value) },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">字体颜色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.style.fontColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style, fontColor: e.target.value },
                      })
                    }
                    className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    data-testid="modal-input-fontcolor"
                    value={formData.style.fontColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style, fontColor: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">字重</label>
                <select
                  data-testid="modal-select-fontweight"
                  value={formData.style.fontWeight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      style: {
                        ...formData.style,
                        fontWeight: e.target.value as 'normal' | 'bold',
                      },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="normal">常规 (Normal)</option>
                  <option value="bold">加粗 (Bold)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">字体样式</label>
                <select
                  data-testid="modal-select-fontstyle"
                  value={formData.style.fontStyle}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      style: {
                        ...formData.style,
                        fontStyle: e.target.value as 'normal' | 'italic',
                      },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="normal">正常 (Normal)</option>
                  <option value="italic">斜体 (Italic)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">对齐方式</label>
                <select
                  data-testid="modal-select-textalign"
                  value={formData.style.textAlign}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      style: {
                        ...formData.style,
                        textAlign: e.target.value as 'left' | 'center' | 'right',
                      },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="left">左对齐</option>
                  <option value="center">居中对齐</option>
                  <option value="right">右对齐</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">文字阴影</label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="modal-checkbox-textshadow"
                    checked={formData.style.textShadow}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style, textShadow: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-300">启用阴影高对比度</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Background */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              背景设置
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">背景颜色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    data-testid="modal-input-bgcolor"
                    value={formData.style.bgColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style, bgColor: e.target.value },
                      })
                    }
                    className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={formData.style.bgColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style, bgColor: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <label>背景不透明度</label>
                  <span>{Math.round(formData.style.bgOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  data-testid="modal-input-bgopacity"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.style.bgOpacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      style: { ...formData.style, bgOpacity: parseFloat(e.target.value) },
                    })
                  }
                  className="mt-2 w-full accent-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Scroll & Movement */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              滚动与播放
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">滚动模式</label>
                <select
                  data-testid="modal-select-mode"
                  value={formData.scroll.mode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scroll: {
                        ...formData.scroll,
                        mode: e.target.value as 'none' | 'horizontal' | 'vertical',
                      },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="horizontal">水平跑马灯 (Horizontal)</option>
                  <option value="vertical">垂直提词器 (Vertical)</option>
                  <option value="none">静态便签 (None)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">滚动速度 (px/s)</label>
                <input
                  type="number"
                  data-testid="modal-input-speed"
                  value={formData.scroll.speed}
                  min={1}
                  max={500}
                  disabled={formData.scroll.mode === 'none'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scroll: {
                        ...formData.scroll,
                        speed: Number(e.target.value),
                      },
                    })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-sm text-white disabled:opacity-50 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">循环播放</label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="modal-checkbox-loop"
                    checked={formData.scroll.loop}
                    disabled={formData.scroll.mode === 'none'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scroll: { ...formData.scroll, loop: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-xs text-slate-300">到达末尾自动循环</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              data-testid="modal-btn-cancel"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              data-testid="modal-btn-save"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
            >
              <Check className="w-4 h-4" />
              <span>保存修改</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
