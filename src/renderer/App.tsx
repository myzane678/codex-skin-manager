import { useEffect, useState, type DragEvent } from 'react';
import {
  Activity,
  Boxes,
  Copy,
  Import,
  ImagePlus,
  Power,
  RotateCcw,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import type { CreateImageThemeInput, ImageThemeDraft, ManagerSnapshot, ThemeIdentity } from '../shared/contracts/manager';
import { CurrentThemeStatus } from './CurrentThemeStatus';
import { ImageThemeCreator } from './ImageThemeCreator';
import { ImagePromptExamples } from './ImagePromptExamples';
import { ThemeCard } from './ThemeCard';

const initialSnapshot: ManagerSnapshot = {
  theme: 'native',
  cdp: 'disconnected',
  proxy: 'disabled',
  recovery: 'idle',
  runtimeRunId: null,
  runtimeErrorCode: null,
  runtimeAdapterId: null,
  runtimeCompatibility: null,
  themes: [],
  diagnostic: '',
};

type View = 'themes' | 'launch' | 'diagnostics';

const themeLabels: Record<ManagerSnapshot['theme'], string> = {
  native: '原生模式',
  pending: '主题待应用',
  applied: '主题已应用',
  'compatibility-degraded': '兼容性降级',
  recovering: '恢复中',
};

export function App() {
  const [view, setView] = useState<View>('themes');
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDraft, setImageDraft] = useState<ImageThemeDraft | null>(null);
  const [imageSourceSelection, setImageSourceSelection] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);

  useEffect(() => {
    void run(() => window.codexSkin.getSnapshot());
    return window.codexSkin.onSnapshotChanged((next) => setSnapshot(next));
  }, []);

  useEffect(() => {
    if (snapshot.theme === 'native' && snapshot.cdp === 'disconnected') return;
    const timer = window.setInterval(() => {
      void window.codexSkin.getRuntimeSnapshot().then((runtime) => setSnapshot((current) => ({ ...current, ...runtime })));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [snapshot.theme, snapshot.cdp]);

  async function run(action: () => Promise<ManagerSnapshot>) {
    setBusy(true);
    setError(null);
    try {
      setSnapshot(await action());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  function identity(theme: ThemeIdentity): ThemeIdentity {
    return { id: theme.id, version: theme.version };
  }

  async function toggleProxy() {
    await run(() => window.codexSkin.setProxyEnabled(snapshot.proxy === 'disabled'));
  }

  async function beginImageTheme() {
    setBusy(true);
    setError(null);
    try {
      const draft = await window.codexSkin.analyzeImageTheme();
      if (draft) setImageDraft(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function analyzeDroppedImage(file: File) {
    setBusy(true);
    setError(null);
    try {
      setImageDraft(await window.codexSkin.analyzeImageThemeFile(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  function handleImageDrag(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!busy && imageSourceSelection) setImageDragActive(true);
  }

  function handleImageDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setImageDragActive(false);
    if (busy || !imageSourceSelection) return;
    if (event.dataTransfer.files.length !== 1) {
      setError('一次只能拖入一张图片');
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) void analyzeDroppedImage(file);
  }

  async function createImageTheme(input: CreateImageThemeInput) {
    await run(async () => {
      const next = await window.codexSkin.createImageTheme(input);
      setImageDraft(null);
      return next;
    });
  }

  const activeTheme = snapshot.themes.find((theme) => theme.active);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Boxes size={19} /></div>
          <div>
            <strong>Codex Skin</strong>
            <span>主题管理器</span>
          </div>
        </div>

        <nav aria-label="主导航">
          <button className={view === 'themes' ? 'active' : ''} onClick={() => setView('themes')}>
            <Boxes size={17} />主题库
          </button>
          <button className={view === 'launch' ? 'active' : ''} onClick={() => setView('launch')}>
            <Power size={17} />启动与代理
          </button>
          <button className={view === 'diagnostics' ? 'active' : ''} onClick={() => setView('diagnostics')}>
            <Activity size={17} />恢复与诊断
          </button>
        </nav>

        <CurrentThemeStatus theme={activeTheme} runtimeTheme={snapshot.theme} cdp={snapshot.cdp} runtimeCompatibility={snapshot.runtimeCompatibility} />
      </aside>

      <main>
        {view === 'themes' && (
          <section className="workspace" aria-labelledby="themes-title">
            <header className="workspace-header">
              <div>
                <p className="eyebrow">THEME LIBRARY</p>
                <h1 id="themes-title">主题库</h1>
              </div>
              <div className="header-actions"><button className="secondary" disabled={busy} onClick={() => { setError(null); setImageSourceSelection(true); }}><ImagePlus size={17} />从图片创建主题</button><button className="primary" disabled={busy} onClick={() => void run(() => window.codexSkin.importTheme())}><Import size={17} />导入主题包</button></div>
            </header>
            {error && <div className="error-banner" role="alert">{error}</div>}
            {imageSourceSelection && !imageDraft && <section
              className={`image-source-selector image-drop-zone${imageDragActive ? ' drag-active' : ''}`}
              data-image-drop-zone
              onDragEnter={handleImageDrag}
              onDragOver={handleImageDrag}
              onDragLeave={() => setImageDragActive(false)}
              onDrop={handleImageDrop}
            >
              {imageDragActive && <div className="image-drop-prompt">松开以创建图片主题</div>}
              <ImagePlus size={28} />
              <h2>拖入图片</h2>
              <p>支持 PNG、JPEG 和 WebP，最大 20 MiB。</p>
              <div className="image-source-actions"><button className="primary" disabled={busy} onClick={() => void beginImageTheme()}><ImagePlus size={17} />选择文件</button><button className="secondary" disabled={busy} onClick={() => setImageSourceSelection(false)}>取消</button></div>
            </section>}
            {imageDraft && <ImageThemeCreator draft={imageDraft} busy={busy} onCancel={() => setImageDraft(null)} onCreate={(input) => void createImageTheme(input)} />}
            {!imageDraft && !imageSourceSelection && <div className="theme-library-layout">
              <div>
                {snapshot.themes.length === 0 && <div className="empty-state">
                  <div className="empty-icon"><Boxes size={28} /></div>
                  <h2>还没有导入主题</h2>
                  <p>导入经过验证的 .codextheme 文件后，主题会显示在这里。</p>
                </div>}
                <div className="theme-grid">
                  {snapshot.themes.map((theme) => (
                    <ThemeCard
                      key={`${theme.id}@${theme.version}`}
                      theme={theme}
                      busy={busy}
                      onEnable={() => void run(() => window.codexSkin.enableTheme(identity(theme)))}
                      onDisable={() => void run(() => window.codexSkin.disableTheme())}
                      onDelete={() => void run(() => window.codexSkin.deleteTheme(identity(theme)))}
                      onExport={() => void run(() => window.codexSkin.exportTheme(identity(theme)))}
                      onRename={(name) => void run(() => window.codexSkin.renameTheme(identity(theme), name))}
                    />
                  ))}
                </div>
              </div>
              <ImagePromptExamples />
            </div>}
          </section>
        )}

        {view === 'launch' && (
          <section className="workspace" aria-labelledby="launch-title">
            <header className="workspace-header">
              <div>
                <p className="eyebrow">RUNTIME</p>
                <h1 id="launch-title">启动与代理</h1>
              </div>
              <button className="secondary" disabled={busy} onClick={() => void window.codexSkin.createThemedShortcut()}>
                创建主题版快捷方式
              </button>
              <button
                className="primary"
                disabled={busy || !snapshot.themes.some((theme) => theme.active)}
                title={snapshot.themes.some((theme) => theme.active) ? '启动 Codex 主题版' : '请先在主题库启用一个主题'}
                onClick={() => void run(() => window.codexSkin.launchThemedCodex())}
              ><Power size={17} />启动主题版</button>
            </header>
            {error && <div className="error-banner" role="alert">{error}</div>}
            {snapshot.theme === 'applied' && snapshot.runtimeCompatibility === 'unverified' && (
              <div className="compatibility-banner" role="status">当前 Codex 版本已通过实时结构探针，但尚未正式验证。</div>
            )}
            <div className="settings-list">
              <div className="setting-row">
                <div className="setting-icon"><ShieldCheck size={19} /></div>
                <div className="setting-copy">
                  <strong>主题运行状态</strong>
                  <span>{themeLabels[snapshot.theme]}</span>
                </div>
                <span className="status-pill neutral">{snapshot.cdp}</span>
              </div>
              <div className="setting-row">
                <div className="setting-icon"><Settings2 size={19} /></div>
                <div className="setting-copy">
                  <strong>原始入口短窗口代理</strong>
                  <span>仅在身份验证通过的候选期内尝试温和接管。</span>
                </div>
                <button
                  className={`switch ${snapshot.proxy !== 'disabled' ? 'on' : ''}`}
                  role="switch"
                  aria-checked={snapshot.proxy !== 'disabled'}
                  aria-label="切换托盘代理"
                  onClick={() => void toggleProxy()}
                ><span /></button>
              </div>
            </div>
          </section>
        )}

        {view === 'diagnostics' && (
          <section className="workspace" aria-labelledby="diagnostics-title">
            <header className="workspace-header">
              <div>
                <p className="eyebrow">RECOVERY</p>
                <h1 id="diagnostics-title">恢复与诊断</h1>
              </div>
            </header>
            {error && <div className="error-banner" role="alert">{error}</div>}
            <div className="diagnostic-panel">
              <dl>
                <div><dt>主题状态</dt><dd>{themeLabels[snapshot.theme]}</dd></div>
                <div><dt>CDP 连接</dt><dd>{snapshot.cdp}</dd></div>
                <div><dt>代理状态</dt><dd>{snapshot.proxy}</dd></div>
                <div><dt>恢复状态</dt><dd>{snapshot.recovery}</dd></div>
                <div><dt>版本适配器</dt><dd>{snapshot.runtimeAdapterId ?? '无'}</dd></div>
              </dl>
              <pre className="diagnostic-text">{snapshot.diagnostic}</pre>
              <div className="diagnostic-actions">
                <button className="secondary" disabled={busy} onClick={() => void window.codexSkin.copyDiagnostic()}>
                  <Copy size={17} />复制诊断
                </button>
                <button className="danger-quiet" disabled={busy} onClick={() => void run(() => window.codexSkin.restoreDefaults())}>
                  <RotateCcw size={17} />恢复默认 Codex
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
