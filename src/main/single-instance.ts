export interface SingleInstanceApp {
  requestSingleInstanceLock(): boolean;
  quit(): void;
}

export interface ManagerWindow {
  isMinimized(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

export function acquireSingleInstanceLock(app: SingleInstanceApp): boolean {
  if (app.requestSingleInstanceLock()) return true;
  app.quit();
  return false;
}

export function revealManagerWindow(window: ManagerWindow | null): void {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
