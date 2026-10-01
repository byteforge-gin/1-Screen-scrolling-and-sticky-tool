import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainDashboard } from './MainDashboard';
import { createDefaultPanel } from '../store/panelStore';
import { AppState } from '../types/panel';

// Mock Tauri invoke if used in components
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe('MainDashboard', () => {
  it('renders empty prompt when no panels exist', () => {
    render(
      <MainDashboard
        panels={[]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText(/暂无文字面板/i)).toBeInTheDocument();
  });

  it('renders panel cards when panels exist', () => {
    const p = createDefaultPanel('台词 1');
    p.text = '这是第一段台词内容';
    render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('台词 1')).toBeInTheDocument();
    expect(screen.getByText('这是第一段台词内容')).toBeInTheDocument();
  });

  it('renders mode badges correctly for different scroll modes', () => {
    const p1 = createDefaultPanel('跑马灯面板');
    p1.scroll.mode = 'horizontal';

    const p2 = createDefaultPanel('提词器面板');
    p2.scroll.mode = 'vertical';

    const p3 = createDefaultPanel('便签面板');
    p3.scroll.mode = 'none';

    render(
      <MainDashboard
        panels={[p1, p2, p3]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('水平跑马灯')).toBeInTheDocument();
    expect(screen.getByText('垂直提词器')).toBeInTheDocument();
    expect(screen.getByText('静态便签')).toBeInTheDocument();
  });

  it('calls onAdd when "+ 新建面板" button in header is clicked', () => {
    const onAdd = vi.fn();
    render(
      <MainDashboard
        panels={[]}
        onAdd={onAdd}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const addBtn = screen.getByTestId('add-panel-btn');
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('handles state prop object and displays global pause button toggle', () => {
    const p = createDefaultPanel('状态测试');
    const onToggleGlobalPause = vi.fn();

    const state: AppState = {
      panels: [p],
      globalPaused: false,
      hotkey: 'Ctrl+Alt+Space',
    };

    const { rerender } = render(
      <MainDashboard
        state={state}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onToggleGlobalPause={onToggleGlobalPause}
      />
    );

    const pauseToggleBtn = screen.getByTestId('global-pause-btn');
    expect(pauseToggleBtn).toHaveTextContent(/全部暂停/);

    fireEvent.click(pauseToggleBtn);
    expect(onToggleGlobalPause).toHaveBeenCalledTimes(1);

    // Rerender with globalPaused = true
    rerender(
      <MainDashboard
        state={{ ...state, globalPaused: true }}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onToggleGlobalPause={onToggleGlobalPause}
      />
    );

    expect(screen.getByTestId('global-pause-btn')).toHaveTextContent(/全部继续|全部恢复/);
  });

  it('toggles visibility and invokes onToggleVisible callback', () => {
    const p = createDefaultPanel('显示面板');
    p.visible = false;
    p.position = { x: 150, y: 250 };
    p.size = { width: 500, height: 160 };
    const onToggleVisible = vi.fn();

    const { rerender } = render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onToggleVisible={onToggleVisible}
      />
    );

    const toggleVisBtn = screen.getByTestId(`toggle-visible-${p.id}`);
    fireEvent.click(toggleVisBtn);

    expect(onToggleVisible).toHaveBeenCalledWith(p.id);

    // When toggling from visible to hidden
    p.visible = true;
    rerender(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onToggleVisible={onToggleVisible}
      />
    );

    const toggleVisBtn2 = screen.getByTestId(`toggle-visible-${p.id}`);
    fireEvent.click(toggleVisBtn2);

    expect(onToggleVisible).toHaveBeenCalledTimes(2);
    expect(onToggleVisible).toHaveBeenLastCalledWith(p.id);
  });

  it('toggles pause on single panel when pause button is clicked', () => {
    const p = createDefaultPanel('滚动面板');
    p.scroll.paused = false;
    const onTogglePause = vi.fn();

    render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onTogglePause={onTogglePause}
      />
    );

    const pauseBtn = screen.getByTestId(`toggle-pause-${p.id}`);
    fireEvent.click(pauseBtn);

    expect(onTogglePause).toHaveBeenCalledWith(p.id);
  });

  it('deletes panel when delete button is clicked and confirmed', () => {
    const p = createDefaultPanel('待删除面板');
    const onDelete = vi.fn();

    // Mock confirm dialog
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />
    );

    const deleteBtn = screen.getByTestId(`delete-panel-${p.id}`);
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith(p.id);

    vi.restoreAllMocks();
  });

  it('does not delete panel when confirmation is canceled', () => {
    const p = createDefaultPanel('保留面板');
    const onDelete = vi.fn();

    vi.spyOn(window, 'confirm').mockImplementation(() => false);

    render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />
    );

    const deleteBtn = screen.getByTestId(`delete-panel-${p.id}`);
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('opens PanelEditModal on clicking edit, updates fields, and saves', () => {
    const p = createDefaultPanel('编辑测试面板');
    p.text = '原始内容';
    const onUpdate = vi.fn();

    render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTestId('panel-edit-modal')).not.toBeInTheDocument();

    // Open modal
    const editBtn = screen.getByTestId(`edit-panel-${p.id}`);
    fireEvent.click(editBtn);

    expect(screen.getByTestId('panel-edit-modal')).toBeInTheDocument();

    // Change panel name
    const nameInput = screen.getByTestId('modal-input-name');
    fireEvent.change(nameInput, { target: { value: '修改后的名称' } });

    // Change panel text
    const textInput = screen.getByTestId('modal-input-text');
    fireEvent.change(textInput, { target: { value: '修改后的文本内容' } });

    // Change scroll mode
    const modeSelect = screen.getByTestId('modal-select-mode');
    fireEvent.change(modeSelect, { target: { value: 'vertical' } });

    // Change scroll speed
    const speedInput = screen.getByTestId('modal-input-speed');
    fireEvent.change(speedInput, { target: { value: '80' } });

    // Change font size
    const fontSizeInput = screen.getByTestId('modal-input-fontsize');
    fireEvent.change(fontSizeInput, { target: { value: '32' } });

    // Change font color
    const fontColorInput = screen.getByTestId('modal-input-fontcolor');
    fireEvent.change(fontColorInput, { target: { value: '#ff0000' } });

    // Change text shadow
    const shadowCheckbox = screen.getByTestId('modal-checkbox-textshadow');
    fireEvent.click(shadowCheckbox);

    // Change position and size
    fireEvent.change(screen.getByTestId('modal-input-pos-x'), { target: { value: '250' } });
    fireEvent.change(screen.getByTestId('modal-input-pos-y'), { target: { value: '350' } });
    fireEvent.change(screen.getByTestId('modal-input-width'), { target: { value: '600' } });
    fireEvent.change(screen.getByTestId('modal-input-height'), { target: { value: '200' } });

    // Change style typography & background
    fireEvent.change(screen.getByTestId('modal-select-fontweight'), { target: { value: 'bold' } });
    fireEvent.change(screen.getByTestId('modal-select-fontstyle'), { target: { value: 'italic' } });
    fireEvent.change(screen.getByTestId('modal-select-textalign'), { target: { value: 'center' } });
    fireEvent.change(screen.getByTestId('modal-input-bgcolor'), { target: { value: '#222222' } });
    fireEvent.change(screen.getByTestId('modal-input-bgopacity'), { target: { value: '0.8' } });

    // Verify live preview updates
    const previewBox = screen.getByTestId('modal-live-preview');
    expect(previewBox).toHaveTextContent('修改后的文本内容');

    // Click Save
    const saveBtn = screen.getByTestId('modal-btn-save');
    fireEvent.click(saveBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: p.id,
        name: '修改后的名称',
        text: '修改后的文本内容',
        position: { x: 250, y: 350 },
        size: { width: 600, height: 200 },
        scroll: expect.objectContaining({
          mode: 'vertical',
          speed: 80,
        }),
        style: expect.objectContaining({
          fontSize: 32,
          fontColor: '#ff0000',
          fontWeight: 'bold',
          fontStyle: 'italic',
          textAlign: 'center',
          bgColor: '#222222',
          bgOpacity: 0.8,
          textShadow: true,
        }),
      })
    );

    // Modal should close
    expect(screen.queryByTestId('panel-edit-modal')).not.toBeInTheDocument();
  });

  it('closes PanelEditModal without saving when Cancel is clicked', () => {
    const p = createDefaultPanel('取消测试');
    const onUpdate = vi.fn();

    render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId(`edit-panel-${p.id}`));
    expect(screen.getByTestId('panel-edit-modal')).toBeInTheDocument();

    const nameInput = screen.getByTestId('modal-input-name');
    fireEvent.change(nameInput, { target: { value: '不会被保存的名称' } });

    const cancelBtn = screen.getByTestId('modal-btn-cancel');
    fireEvent.click(cancelBtn);

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('panel-edit-modal')).not.toBeInTheDocument();
  });

  it('clamps numeric inputs to valid ranges on save in PanelEditModal', () => {
    const p = createDefaultPanel('数值校验面板');
    const onUpdate = vi.fn();

    render(
      <MainDashboard
        panels={[p]}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId(`edit-panel-${p.id}`));

    // Enter out-of-range values: width: 50 (< 100), height: 10 (< 40), fontSize: 500 (> 200), speed: 999 (> 500)
    fireEvent.change(screen.getByTestId('modal-input-width'), { target: { value: '50' } });
    fireEvent.change(screen.getByTestId('modal-input-height'), { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('modal-input-fontsize'), { target: { value: '500' } });
    fireEvent.change(screen.getByTestId('modal-input-speed'), { target: { value: '999' } });

    fireEvent.click(screen.getByTestId('modal-btn-save'));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        size: { width: 100, height: 40 },
        style: expect.objectContaining({
          fontSize: 200,
        }),
        scroll: expect.objectContaining({
          speed: 500,
        }),
      })
    );
  });
});
