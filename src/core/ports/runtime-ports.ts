export interface CodexInstallation {
  packageName: string;
  packageFamilyName: string;
  publisher: string;
  version: string;
  installLocation: string;
  executablePath: string;
}

export interface CodexProcess {
  pid: number;
  executablePath: string;
}

export interface CodexIdentityPort {
  findInstallation(): Promise<CodexInstallation | null>;
  listOwnedProcesses(installation: CodexInstallation): Promise<CodexProcess[]>;
  closeOwnedProcess(installation: CodexInstallation, pid: number): Promise<boolean>;
}

export interface CdpTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export interface CdpBrowserIdentity {
  browserId: string;
}

export interface CdpPageSession {
  call<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  onLoad(listener: () => void): () => void;
  onDisconnect(listener: () => void): () => void;
  isOpen(): boolean;
  close(): void;
}

export interface CdpPort {
  readBrowserIdentity(port: number): Promise<CdpBrowserIdentity>;
  listTargets(port: number, expectedBrowserId?: string): Promise<CdpTarget[]>;
  openPageSession(target: CdpTarget, port: number): Promise<CdpPageSession>;
  call<T>(webSocketDebuggerUrl: string, method: string, params?: Record<string, unknown>): Promise<T>;
}
