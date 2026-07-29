import type { CdpPageSession } from '../ports/runtime-ports';
import type { InjectionPlan } from './compiler';

export class InjectionRuntime {
  private earlyRevision = 0;

  async apply(session: CdpPageSession, plan: InjectionPlan): Promise<void> {
    await session.call('Runtime.evaluate', {
      expression: `(${APPLY_FUNCTION})(${JSON.stringify(plan)})`,
      returnByValue: true,
    });
  }

  async installEarly(session: CdpPageSession, plan: InjectionPlan): Promise<string> {
    const revision = `${plan.runId}:${++this.earlyRevision}`;
    const result = await session.call<unknown>('Page.addScriptToEvaluateOnNewDocument', {
      source: `(${EARLY_APPLY_FUNCTION})(${JSON.stringify(plan)}, ${JSON.stringify(revision)})`,
    });
    if (!result || typeof result !== 'object' || typeof (result as { identifier?: unknown }).identifier !== 'string') {
      throw new Error('CDP_EARLY_SCRIPT_UNVERIFIED');
    }
    return (result as { identifier: string }).identifier;
  }

  async isApplied(session: CdpPageSession, runId: string): Promise<boolean> {
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(runId)) throw new Error('RUN_ID_INVALID');
    const selector = `style[data-codex-skin="${runId}"]`;
    const result = await session.call<unknown>('Runtime.evaluate', {
      expression: `(() => {
        const runtime = window.__CODEX_SKIN_RUNTIME__;
        return Boolean(runtime && runtime.runId === ${JSON.stringify(runId)}
          && document.querySelector(${JSON.stringify(selector)}));
      })()`,
      returnByValue: true,
    });
    return (result as { result?: { value?: unknown } }).result?.value === true;
  }

  async removeEarly(session: CdpPageSession, identifier: string): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(identifier)) throw new Error('CDP_EARLY_SCRIPT_INVALID');
    await session.call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }

  async rollback(session: CdpPageSession, runId: string): Promise<void> {
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(runId)) throw new Error('RUN_ID_INVALID');
    await session.call('Runtime.evaluate', {
      expression: `(${ROLLBACK_FUNCTION})(${JSON.stringify(runId)})`,
      returnByValue: true,
    });
  }
}

export const APPLY_FUNCTION = `function(plan) {
  const STATE_KEY = '__CODEX_SKIN_RUNTIME__';
  const previous = window[STATE_KEY];
  if (previous && previous.runId === plan.runId && typeof previous.ensure === 'function') {
    previous.ensure();
    return true;
  }
  if (previous && typeof previous.cleanup === 'function') previous.cleanup();
  const root = document.documentElement;
  const selector = 'style[data-codex-skin="' + plan.runId + '"], .codex-skin-decoration[data-codex-skin="' + plan.runId + '"]';
  const ensure = function() {
    const shell = plan.shell;
    if (!shell) return false;
    const header = document.querySelector(shell.header);
    const nav = document.querySelector(shell.navigation);
    const sidebar = document.querySelector(shell.sidebar);
    const main = document.querySelector(shell.main);
    if (!root || !header || !nav || !sidebar || !main) return false;
    root.setAttribute('data-codex-skin', plan.runId);
    if (plan.presentation) {
      const computed = getComputedStyle(root);
      const appearance = plan.presentation.appearance === 'auto'
        ? (computed.colorScheme === 'dark' ? 'dark' : 'light')
        : plan.presentation.appearance;
      const safeArea = plan.presentation.safeArea === 'auto' ? 'center' : plan.presentation.safeArea;
      const taskMode = plan.presentation.taskMode === 'auto' ? 'ambient' : plan.presentation.taskMode;
      const routeMains = Array.from(document.querySelectorAll(shell.routeMain));
      const home = routeMains.find(function(candidate) { return Boolean(candidate.querySelector(shell.homeMarker)); }) || null;
      // 当前 Codex 首页没有旧 home-icon 或路由 main 时，保守地把语义主壳层视为首页。
      const isHome = routeMains.length === 0 || Boolean(home);
      routeMains.forEach(function(candidate) {
        candidate.classList.toggle('dream-home', candidate === home);
        candidate.classList.toggle('dream-task', candidate !== home);
      });
      main.classList.toggle('dream-home-shell', isHome);
      root.setAttribute('data-codex-skin-page', isHome ? 'home' : 'task');
      root.setAttribute('data-codex-skin-appearance', appearance);
      root.setAttribute('data-codex-skin-image', plan.presentation.imageLayout);
      root.setAttribute('data-codex-skin-safe-area', safeArea);
      root.setAttribute('data-codex-skin-task-mode', taskMode);
    }
    let style = document.querySelector('style[data-codex-skin="' + plan.runId + '"]');
    if (!style) {
      style = document.createElement('style');
      style.dataset.codexSkin = plan.runId;
      (document.head || root).appendChild(style);
    }
    if (style.textContent !== plan.styleText) style.textContent = plan.styleText;
    let decoration = null;
    if (plan.decoration) {
      decoration = document.querySelector('.codex-skin-decoration[data-codex-skin="' + plan.runId + '"]');
      if (!decoration || decoration.parentElement !== main) {
        decoration?.remove();
        decoration = document.createElement('div');
        decoration.dataset.codexSkin = plan.runId;
        decoration.className = plan.decoration.className;
        decoration.textContent = plan.decoration.text;
        decoration.setAttribute('aria-hidden', 'true');
        decoration.style.pointerEvents = 'none';
        main.appendChild(decoration);
      }
    }
    return root.getAttribute('data-codex-skin') === plan.runId
      && Boolean(document.querySelector('style[data-codex-skin="' + plan.runId + '"]'))
      && (!decoration || decoration.parentElement === main);
  };
  if (!ensure()) {
    document.querySelectorAll(selector).forEach((node) => node.remove());
    if (root && root.getAttribute('data-codex-skin') === plan.runId) root.removeAttribute('data-codex-skin');
    throw new Error('CODEX_SHELL_NOT_COMPATIBLE');
  }
  const scheduler = { timeout: null };
  const scheduleEnsure = function() {
    if (scheduler.timeout) clearTimeout(scheduler.timeout);
    scheduler.timeout = setTimeout(function() {
      scheduler.timeout = null;
      ensure();
    }, 180);
  };
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(root, { childList: true, subtree: true });
  const timer = setInterval(ensure, 5000);
  window[STATE_KEY] = {
    runId: plan.runId,
    ensure: ensure,
    observer: observer,
    timer: timer,
    scheduler: scheduler,
    cleanup: function() {
      observer.disconnect();
      clearInterval(timer);
      if (scheduler.timeout) clearTimeout(scheduler.timeout);
      document.querySelectorAll(selector).forEach((node) => node.remove());
      if (root.getAttribute('data-codex-skin') === plan.runId) root.removeAttribute('data-codex-skin');
      ['data-codex-skin-page', 'data-codex-skin-appearance', 'data-codex-skin-image', 'data-codex-skin-safe-area', 'data-codex-skin-task-mode'].forEach(function(attribute) { root.removeAttribute(attribute); });
      root.classList.remove('codex-dream-skin', 'dream-theme-light', 'dream-theme-dark', 'dream-art-wide', 'dream-art-standard', 'dream-safe-left', 'dream-safe-center', 'dream-safe-right', 'dream-task-ambient', 'dream-task-banner', 'dream-task-off');
      document.querySelectorAll('.dream-home').forEach(function(node) { node.classList.remove('dream-home'); });
      document.querySelectorAll('.dream-task').forEach(function(node) { node.classList.remove('dream-task'); });
      document.querySelectorAll('.dream-home-shell').forEach(function(node) { node.classList.remove('dream-home-shell'); });
      if (window[STATE_KEY] && window[STATE_KEY].runId === plan.runId) delete window[STATE_KEY];
      return true;
    },
  };
  return true;
}`;

export const EARLY_APPLY_FUNCTION = `function(plan, revision) {
  const generationKey = '__CODEX_SKIN_EARLY_GENERATION__';
  const generation = revision || plan.runId;
  window[generationKey] = generation;
  let bootstrapTimer = null;
  let timeout = null;
  const stop = function() {
    if (bootstrapTimer) clearInterval(bootstrapTimer);
    bootstrapTimer = null;
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };
  const install = function() {
    if (window[generationKey] !== generation) {
      stop();
      return true;
    }
    const root = document.documentElement;
    const shell = plan.shell;
    if (!root || !shell || !document.querySelector(shell.header) || !document.querySelector(shell.navigation) || !document.querySelector(shell.sidebar) || !document.querySelector(shell.main)) return false;
    stop();
    (${APPLY_FUNCTION})(plan);
    return true;
  };
  if (install()) return true;
  document.addEventListener?.('DOMContentLoaded', install, { once: true });
  bootstrapTimer = setInterval(install, 250);
  timeout = setTimeout(stop, 10000);
  return false;
}`;

export const ROLLBACK_FUNCTION = `function(runId) {
  const state = window.__CODEX_SKIN_RUNTIME__;
  if (state && state.runId === runId && typeof state.cleanup === 'function') return state.cleanup();
  const selector = 'style[data-codex-skin="' + runId + '"], .codex-skin-decoration[data-codex-skin="' + runId + '"]';
  document.querySelectorAll(selector).forEach((node) => node.remove());
  if (document.documentElement.getAttribute('data-codex-skin') === runId) {
    document.documentElement.removeAttribute('data-codex-skin');
  }
  ['data-codex-skin-page', 'data-codex-skin-appearance', 'data-codex-skin-image', 'data-codex-skin-safe-area', 'data-codex-skin-task-mode'].forEach(function(attribute) { document.documentElement.removeAttribute(attribute); });
  document.documentElement.classList.remove('codex-dream-skin', 'dream-theme-light', 'dream-theme-dark', 'dream-art-wide', 'dream-art-standard', 'dream-safe-left', 'dream-safe-center', 'dream-safe-right', 'dream-task-ambient', 'dream-task-banner', 'dream-task-off');
  document.querySelectorAll('.dream-home').forEach(function(node) { node.classList.remove('dream-home'); });
  document.querySelectorAll('.dream-task').forEach(function(node) { node.classList.remove('dream-task'); });
  document.querySelectorAll('.dream-home-shell').forEach(function(node) { node.classList.remove('dream-home-shell'); });
  return true;
}`;
