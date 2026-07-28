import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { CreateImageThemeInput, ImageThemeDraft } from '../shared/contracts/manager';

interface ImageThemeCreatorProps {
  draft: ImageThemeDraft;
  busy: boolean;
  onCancel: () => void;
  onCreate: (input: CreateImageThemeInput) => void;
}

export function ImageThemeCreator({ draft, busy, onCancel, onCreate }: ImageThemeCreatorProps) {
  const [name, setName] = useState('图片主题');
  const [accent, setAccent] = useState(draft.defaultAccent);
  const [readability, setReadability] = useState(draft.readability);
  const [focusX, setFocusX] = useState<number>(draft.focusX);
  const [focusY, setFocusY] = useState<number>(draft.focusY);
  const [appearance, setAppearance] = useState<CreateImageThemeInput['appearance']>('auto');
  const [safeArea, setSafeArea] = useState<CreateImageThemeInput['safeArea']>(draft.safeArea);
  const [imageLayout, setImageLayout] = useState<CreateImageThemeInput['imageLayout']>(draft.imageLayout);
  const [taskMode, setTaskMode] = useState<CreateImageThemeInput['taskMode']>('ambient');

  return (
    <form className="image-theme-creator" onSubmit={(event) => {
      event.preventDefault();
      onCreate({ token: draft.token, name, accent, readability, focusX, focusY, appearance, safeArea, imageLayout, taskMode });
    }}>
      <img src={draft.previewDataUrl} alt="主题背景预览" />
      <div className="image-theme-fields">
        <label>主题名称<input name="name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
        <fieldset><legend>强调色</legend><div className="color-options">
          {draft.candidates.map((candidate) => <button key={candidate} type="button" data-accent={candidate} className={accent === candidate ? 'selected' : ''} style={{ backgroundColor: candidate }} title={candidate} onClick={() => setAccent(candidate)}><Check size={14} /></button>)}
          <input aria-label="自定义强调色" value={accent} pattern="^#[0-9A-Fa-f]{6}$" onChange={(event) => setAccent(event.target.value)} />
        </div></fieldset>
        <fieldset role="radiogroup"><legend>可读性</legend><label><input type="radio" checked={readability === 'dark'} onChange={() => setReadability('dark')} />深色遮罩</label><label><input type="radio" checked={readability === 'light'} onChange={() => setReadability('light')} />浅色遮罩</label></fieldset>
        <label>外观模式<select name="appearance" value={appearance} onChange={(event) => setAppearance(event.target.value as CreateImageThemeInput['appearance'])}><option value="auto">跟随 Codex</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
        <label>内容安全区<select name="safeArea" value={safeArea} onChange={(event) => setSafeArea(event.target.value as CreateImageThemeInput['safeArea'])}><option value="auto">自动</option><option value="left">左侧</option><option value="center">中间</option><option value="right">右侧</option></select></label>
        <label>图片布局<select name="imageLayout" value={imageLayout} onChange={(event) => setImageLayout(event.target.value as CreateImageThemeInput['imageLayout'])}><option value="standard">标准</option><option value="wide">宽图沉浸</option></select></label>
        <label>任务页背景<select name="taskMode" value={taskMode} onChange={(event) => setTaskMode(event.target.value as CreateImageThemeInput['taskMode'])}><option value="auto">自动</option><option value="ambient">环境层</option><option value="banner">横幅</option><option value="off">关闭</option></select></label>
        <label>背景焦点 X<input type="range" min="0" max="100" value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} /></label>
        <label>背景焦点 Y<input type="range" min="0" max="100" value={focusY} onChange={(event) => setFocusY(Number(event.target.value))} /></label>
        <div className="image-theme-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}><X size={17} />取消</button><button type="submit" className="primary" disabled={busy || !name.trim() || !/^#[0-9A-Fa-f]{6}$/.test(accent)}><Check size={17} />创建主题</button></div>
      </div>
    </form>
  );
}
