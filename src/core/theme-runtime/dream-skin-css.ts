export const DREAM_SKIN_CSS = String.raw`html[data-codex-skin] {
  --dream-art-position: 50% 50%;
  --dream-home-sidebar: color-mix(in oklab, Canvas 84%, transparent);
  --dream-home-surface: color-mix(in oklab, Canvas 78%, transparent);
  --dream-home-header: color-mix(in oklab, Canvas 88%, transparent);
  --dream-task-sidebar: color-mix(in oklab, Canvas 88%, transparent);
  --dream-task-surface: color-mix(in oklab, Canvas 84%, transparent);
  --dream-wide-sidebar: color-mix(in oklab, Canvas 50%, transparent);
  --dream-wide-edge: color-mix(in oklab, Canvas 46%, transparent);
  --dream-wide-mid: color-mix(in oklab, Canvas 28%, transparent);
  --dream-wide-far: color-mix(in oklab, Canvas 14%, transparent);
  --dream-wide-task-sidebar: color-mix(in oklab, Canvas 72%, transparent);
  --dream-wide-task-edge: color-mix(in oklab, Canvas 86%, transparent);
  --dream-wide-task-mid: color-mix(in oklab, Canvas 78%, transparent);
  --dream-wide-task-far: color-mix(in oklab, Canvas 66%, transparent);
}

html[data-codex-skin][data-codex-skin-page="home"] body,
html[data-codex-skin][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) body {
  background-color: Canvas !important;
  background-image: var(--dream-art) !important;
  background-position: var(--dream-art-position) !important;
  background-size: cover !important;
  background-repeat: no-repeat !important;
  background-attachment: fixed !important;
}

html[data-codex-skin][data-codex-skin-page="home"] aside.app-shell-left-panel {
  background: var(--dream-home-sidebar) !important;
}

html[data-codex-skin][data-codex-skin-page="home"] main.main-surface {
  background: var(--dream-home-surface) !important;
}

html[data-codex-skin][data-codex-skin-page="home"] main.main-surface > header.app-header-tint {
  background: var(--dream-home-header) !important;
}

html[data-codex-skin][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) aside.app-shell-left-panel {
  background: var(--dream-task-sidebar) !important;
}

html[data-codex-skin][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) main.main-surface {
  background: var(--dream-task-surface) !important;
}

html[data-codex-skin][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) main.main-surface > header.app-header-tint,
html[data-codex-skin][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) main.main-surface [role="main"],
html[data-codex-skin][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) .dream-task {
  background: transparent !important;
}

html[data-codex-skin][data-codex-skin-image="wide"][data-codex-skin-page="home"] aside.app-shell-left-panel {
  background: linear-gradient(90deg, var(--dream-wide-sidebar), var(--dream-wide-edge)) !important;
}

html[data-codex-skin][data-codex-skin-image="wide"][data-codex-skin-page="home"] main.main-surface {
  background: linear-gradient(90deg, var(--dream-wide-edge), var(--dream-wide-mid) 64%, var(--dream-wide-far)) !important;
}

html[data-codex-skin][data-codex-skin-image="wide"][data-codex-skin-page="home"] main.main-surface > header.app-header-tint {
  background: transparent !important;
}

html[data-codex-skin][data-codex-skin-image="wide"][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) aside.app-shell-left-panel {
  background: linear-gradient(90deg, var(--dream-wide-task-sidebar), var(--dream-wide-task-edge)) !important;
}

html[data-codex-skin][data-codex-skin-image="wide"][data-codex-skin-page="task"]:is([data-codex-skin-task-mode="ambient"], [data-codex-skin-task-mode="banner"]) main.main-surface {
  background: linear-gradient(90deg, var(--dream-wide-task-edge), var(--dream-wide-task-mid) 64%, var(--dream-wide-task-far)) !important;
}

/* Derived from Codex Dream Skin (MIT).  These rules are restricted to the
   current version adapter's verified Codex shell surfaces. */
html[data-codex-skin] {
  --dream-canvas: color-mix(in oklab, Canvas 96%, var(--dream-accent));
  --dream-surface: color-mix(in oklab, Canvas 92%, var(--dream-accent));
  --dream-surface-raised: color-mix(in oklab, Canvas 97%, var(--dream-accent));
  --dream-line: color-mix(in oklab, CanvasText 24%, var(--dream-accent));
  --dream-line-soft: color-mix(in oklab, transparent 78%, var(--dream-accent));
  --dream-accent-soft: color-mix(in oklab, var(--dream-accent) 16%, var(--dream-surface));
  --dream-ambient-opacity: .18;
}

html[data-codex-skin][data-codex-skin-appearance="dark"] {
  --dream-canvas: color-mix(in oklab, Canvas 88%, var(--dream-accent));
  --dream-surface: color-mix(in oklab, Canvas 90%, var(--dream-accent));
  --dream-surface-raised: color-mix(in oklab, Canvas 94%, var(--dream-accent));
  --dream-ambient-opacity: .22;
}

html[data-codex-skin] aside.app-shell-left-panel {
  border-color: var(--dream-line-soft) !important;
  box-shadow: inset -1px 0 var(--dream-line-soft) !important;
}

html[data-codex-skin] aside.app-shell-left-panel button:hover,
html[data-codex-skin] aside.app-shell-left-panel [aria-current="page"] {
  background: var(--dream-accent-soft) !important;
}

html[data-codex-skin] .dream-task {
  position: relative;
  isolation: isolate;
  min-height: 100%;
}

html[data-codex-skin] .dream-task::before {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
  opacity: var(--dream-ambient-opacity);
  background-image: var(--dream-art);
  background-repeat: no-repeat;
  background-position: var(--dream-art-position);
  background-size: cover;
  mask-image: linear-gradient(to bottom, black 0, rgb(0 0 0 / .92) 38%, transparent 88%);
}

html[data-codex-skin] .dream-task > * { position: relative; z-index: 1; }
html[data-codex-skin] .dream-task [data-message-author-role],
html[data-codex-skin] .dream-task article { color: CanvasText; }

html[data-codex-skin] .composer-surface-chrome {
  border: 1px solid var(--dream-line) !important;
  border-radius: 18px !important;
  background: color-mix(in oklab, var(--dream-surface-raised) 95%, transparent) !important;
  box-shadow: 0 12px 34px color-mix(in oklab, var(--dream-accent) 8%, transparent) !important;
  backdrop-filter: blur(14px) saturate(1.06) !important;
}

html[data-codex-skin] .group\/home-suggestions button {
  border: 1px solid var(--dream-line-soft) !important;
  border-radius: 16px !important;
  background: color-mix(in oklab, var(--dream-surface-raised) 88%, transparent) !important;
  box-shadow: 0 8px 24px color-mix(in oklab, var(--dream-accent) 6%, transparent) !important;
}

html[data-codex-skin] .group\/home-suggestions button:hover {
  background: var(--dream-accent-soft) !important;
}
`;
