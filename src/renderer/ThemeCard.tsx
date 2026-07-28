import { Check, Download, Pencil, Power, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ThemeView } from '../shared/contracts/manager';

interface ThemeCardProps {
  theme: ThemeView;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onDelete: () => void;
  onExport: () => void;
  onRename: (name: string) => void;
}

export function ThemeCard({ theme, busy, onEnable, onDisable, onDelete, onExport, onRename }: ThemeCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(theme.name);
  const trimmedName = name.trim();
  const canSave = !busy && trimmedName.length > 0 && trimmedName.length <= 80;

  function cancelRename(): void {
    setName(theme.name);
    setEditing(false);
  }

  function saveRename(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSave) return;
    onRename(trimmedName);
    setEditing(false);
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') cancelRename();
  }

  return (
    <article className="theme-card">
      <img src={theme.previewDataUrl} alt="" />
      <div className="theme-card-body">
        {editing ? <form className="theme-rename-form" onSubmit={saveRename}>
          <input name="theme-name" value={name} maxLength={80} aria-label="主题名称" onChange={(event) => setName(event.target.value)} onKeyDown={handleNameKeyDown} autoFocus />
          <div className="theme-rename-actions">
            <button className="icon-action" type="submit" disabled={!canSave} title="保存名称"><Check size={15} /></button>
            <button className="icon-action" type="button" disabled={busy} title="取消重命名" onClick={cancelRename}><X size={15} /></button>
          </div>
        </form> : <div>
          <strong>{theme.name}</strong>
          <span>{theme.version} · 来源未知</span>
        </div>}
        <div className="theme-actions">
          <button className="icon-action" disabled={busy} title={theme.active ? '停用主题' : '立即切换主题'} onClick={theme.active ? onDisable : onEnable}>
            <Power size={16} />
          </button>
          <button className="icon-action" disabled={busy} title="导出主题包" onClick={onExport}>
            <Download size={16} />
          </button>
          <button className="icon-action" disabled={busy} title="重命名主题" onClick={() => { setName(theme.name); setEditing(true); }}>
            <Pencil size={16} />
          </button>
          <button className="icon-action danger" disabled={busy || theme.active} title={theme.active ? '请先停用或切换主题' : '删除主题'} onClick={onDelete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
