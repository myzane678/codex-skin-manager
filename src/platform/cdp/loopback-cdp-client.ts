import WebSocket from 'ws';
import type { CdpBrowserIdentity, CdpPageSession, CdpPort, CdpTarget } from '../../core/ports/runtime-ports';

const ALLOWED_METHODS = new Set([
  'Runtime.evaluate',
  'Runtime.callFunctionOn',
  'Page.enable',
  'Runtime.enable',
  'Page.addScriptToEvaluateOnNewDocument',
  'Page.removeScriptToEvaluateOnNewDocument',
]);

export class LoopbackCdpClient implements CdpPort {
  async isAvailable(port: number): Promise<boolean> {
    try {
      await this.readBrowserIdentity(port);
      return true;
    } catch {
      return false;
    }
  }

  async readBrowserIdentity(port: number): Promise<CdpBrowserIdentity> {
    assertPort(port);
    const value = await fetchJson(port, '/json/version');
    if (!value || typeof value !== 'object') throw new Error('CDP_RESPONSE_INVALID');
    const url = (value as Record<string, unknown>).webSocketDebuggerUrl;
    if (typeof url !== 'string') throw new Error('CDP_RESPONSE_INVALID');
    return { browserId: browserIdFromUrl(url, port) };
  }

  async listTargets(port: number, expectedBrowserId?: string): Promise<CdpTarget[]> {
    assertPort(port);
    const value = await fetchJson(port, '/json/list');
    if (!Array.isArray(value)) throw new Error('CDP_RESPONSE_INVALID');
    const targets = value.filter(isTarget).map((target) => {
      assertLoopbackWebSocket(target.webSocketDebuggerUrl, port, 'page', target.id);
      return target;
    });
    if (expectedBrowserId) await assertBrowserIdentity(port, expectedBrowserId);
    return targets;
  }

  async openPageSession(target: CdpTarget, port: number): Promise<CdpPageSession> {
    assertPort(port);
    if (target.type !== 'page') throw new Error('CDP_TARGET_INVALID');
    assertLoopbackWebSocket(target.webSocketDebuggerUrl, port, 'page', target.id);
    const session = new PersistentPageSession(target.webSocketDebuggerUrl);
    await session.open();
    return session;
  }

  async call<T>(webSocketDebuggerUrl: string, method: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = new URL(webSocketDebuggerUrl);
    const port = Number(url.port);
    assertPort(port);
    const target: CdpTarget = { id: pageIdFromUrl(webSocketDebuggerUrl), type: 'page', title: '', url: '', webSocketDebuggerUrl };
    const session = await this.openPageSession(target, port);
    try {
      return await session.call<T>(method, params);
    } finally {
      session.close();
    }
  }
}

class PersistentPageSession implements CdpPageSession {
  private readonly socket: WebSocket;
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timeout: NodeJS.Timeout }>();
  private readonly loadListeners = new Set<() => void>();
  private readonly disconnectListeners = new Set<() => void>();
  private nextId = 1;
  private openState = false;
  private disconnected = false;

  constructor(url: string) {
    this.socket = new WebSocket(url, { handshakeTimeout: 3_000, followRedirects: false });
  }

  async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.socket.terminate();
        reject(new Error('CDP_CONNECTION_FAILED'));
      }, 3_000);
      this.socket.once('open', () => {
        clearTimeout(timeout);
        this.openState = true;
        resolve();
      });
      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`CDP_CONNECTION_FAILED:${error.message}`));
      });
    });
    this.socket.on('message', (data) => this.handleMessage(data));
    this.socket.once('close', () => this.disconnect());
    this.socket.once('error', () => this.disconnect());
  }

  call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    assertMethod(method);
    if (!this.isOpen()) return Promise.reject(new Error('CDP_SESSION_CLOSED'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        this.socket.terminate();
        this.disconnect();
        reject(new Error('CDP_CALL_TIMEOUT'));
      }, 5_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }), (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(id);
        this.disconnect();
        reject(new Error(`CDP_CONNECTION_FAILED:${error.message}`));
      });
    });
  }

  onLoad(listener: () => void): () => void {
    this.loadListeners.add(listener);
    return () => this.loadListeners.delete(listener);
  }

  onDisconnect(listener: () => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  isOpen(): boolean {
    return this.openState && !this.disconnected && this.socket.readyState === WebSocket.OPEN;
  }

  close(): void {
    if (this.disconnected) return;
    this.socket.terminate();
    this.disconnect();
  }

  private handleMessage(data: WebSocket.RawData): void {
    let message: unknown;
    try {
      message = JSON.parse(typeof data === 'string' ? data : Buffer.from(data as ArrayBuffer).toString('utf8'));
    } catch {
      this.close();
      return;
    }
    if (!message || typeof message !== 'object') return;
    const record = message as Record<string, unknown>;
    if (typeof record.id === 'number') {
      const pending = this.pending.get(record.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(record.id);
      if ('error' in record) {
        pending.reject(new Error('CDP_CALL_FAILED'));
        return;
      }
      const result = record.result;
      if (result && typeof result === 'object' && 'exceptionDetails' in result) {
        pending.reject(new Error('CDP_EVALUATION_FAILED'));
        return;
      }
      pending.resolve(result);
      return;
    }
    if (record.method === 'Page.loadEventFired') {
      for (const listener of this.loadListeners) listener();
    }
  }

  private disconnect(): void {
    if (this.disconnected) return;
    this.disconnected = true;
    this.openState = false;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('CDP_SESSION_CLOSED'));
    }
    this.pending.clear();
    for (const listener of this.disconnectListeners) listener();
    this.loadListeners.clear();
    this.disconnectListeners.clear();
  }
}

async function fetchJson(port: number, resource: string): Promise<unknown> {
  const response = await fetch(`http://127.0.0.1:${port}${resource}`, { redirect: 'error', signal: AbortSignal.timeout(3_000) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('CDP_LIST_FAILED');
  }
  return response.json();
}

async function assertBrowserIdentity(port: number, expectedBrowserId: string): Promise<void> {
  const identity = await new LoopbackCdpClient().readBrowserIdentity(port);
  if (identity.browserId !== expectedBrowserId) throw new Error('CDP_BROWSER_CHANGED');
}

function browserIdFromUrl(value: string, port: number): string {
  const url = new URL(value);
  if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || Number(url.port) !== port || url.username || url.password || url.search || url.hash) throw new Error('CDP_ENDPOINT_NOT_LOOPBACK');
  const match = url.pathname.match(/^\/devtools\/browser\/([A-Za-z0-9._-]{1,200})$/);
  if (!match?.[1]) throw new Error('CDP_RESPONSE_INVALID');
  return match[1];
}

function pageIdFromUrl(value: string): string {
  const url = new URL(value);
  const match = url.pathname.match(/^\/devtools\/page\/([A-Za-z0-9._-]{1,200})$/);
  if (!match?.[1]) throw new Error('CDP_TARGET_INVALID');
  return match[1];
}

function assertPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('CDP_PORT_INVALID');
}

function assertLoopbackWebSocket(value: string, expectedPort: number, kind: 'page', expectedId: string): void {
  const url = new URL(value);
  if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || Number(url.port) !== expectedPort || url.username || url.password || url.search || url.hash || url.pathname !== `/devtools/${kind}/${expectedId}`) throw new Error('CDP_ENDPOINT_NOT_LOOPBACK');
}

function assertMethod(method: string): void {
  if (!ALLOWED_METHODS.has(method)) throw new Error('CDP_METHOD_NOT_ALLOWED');
}

function isTarget(value: unknown): value is CdpTarget {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.type === 'string' && typeof item.title === 'string' && typeof item.url === 'string' && typeof item.webSocketDebuggerUrl === 'string';
}
