import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { CodexIdentityPort, CodexInstallation, CodexProcess } from '../../core/ports/runtime-ports';

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = 'OpenAI.Codex';
const PACKAGE_FAMILY = 'OpenAI.Codex_2p2nqsd0c76g0';
const PUBLISHER = 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B';

export class WindowsCodexIdentity implements CodexIdentityPort {
  async findInstallation(): Promise<CodexInstallation | null> {
    const script = [
      `$pkg = Get-AppxPackage -Name '${PACKAGE_NAME}'`,
      `if (-not $pkg -or $pkg.PackageFamilyName -ne '${PACKAGE_FAMILY}' -or $pkg.Publisher -ne '${PUBLISHER}') { exit 3 }`,
      '$manifest = Get-AppxPackageManifest -Package $pkg',
      "$app = $manifest.Package.Applications.Application | Where-Object { $_.Id -eq 'App' } | Select-Object -First 1",
      "if (-not $app -or $app.Executable -ne 'app/ChatGPT.exe') { exit 4 }",
      '[PSCustomObject]@{ packageName=$pkg.Name; packageFamilyName=$pkg.PackageFamilyName; publisher=$pkg.Publisher; version=$pkg.Version.ToString(); installLocation=$pkg.InstallLocation; executablePath=(Join-Path $pkg.InstallLocation $app.Executable) } | ConvertTo-Json -Compress',
    ].join('; ');
    try {
      const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
      return parseInstallation(stdout);
    } catch (error) {
      if ((error as NodeJS.ErrnoException & { code?: number }).code === 3) return null;
      throw new Error('CODEX_IDENTITY_QUERY_FAILED', { cause: error });
    }
  }

  async closeOwnedProcess(installation: CodexInstallation, pid: number): Promise<boolean> {
    assertInstallation(installation);
    if (!Number.isInteger(pid) || pid < 1) throw new Error('CODEX_PROCESS_INVALID');
    const script = [
      `$root = '${escapePowerShell(installation.installLocation)}'`,
      `$process = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"`,
      "if (-not $process -or -not $process.ExecutablePath -or -not $process.ExecutablePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { 'false'; exit 0 }",
      '$target = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue',
      "if (-not $target) { 'true'; exit 0 }",
      "if ($target.CloseMainWindow()) { 'true' } else { 'false' }",
    ].join('; ');
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    return stdout.trim() === 'true';
  }

  async listOwnedProcesses(installation: CodexInstallation): Promise<CodexProcess[]> {
    assertInstallation(installation);
    const script = [
      '$items = Get-CimInstance Win32_Process',
      `$root = '${escapePowerShell(installation.installLocation)}'`,
      "$owned = $items | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { [PSCustomObject]@{ pid=[int]$_.ProcessId; executablePath=$_.ExecutablePath } }",
      '@($owned) | ConvertTo-Json -Compress',
    ].join('; ');
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
    const value: unknown = JSON.parse(stdout || '[]');
    const candidates = Array.isArray(value) ? value : [value];
    return candidates.filter(isProcess).map((item) => ({ pid: item.pid, executablePath: item.executablePath }));
  }
}

function parseInstallation(text: string): CodexInstallation {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object') throw new Error('CODEX_IDENTITY_INVALID');
  const item = value as Record<string, unknown>;
  const installation: CodexInstallation = {
    packageName: requireString(item.packageName),
    packageFamilyName: requireString(item.packageFamilyName),
    publisher: requireString(item.publisher),
    version: requireString(item.version),
    installLocation: requireString(item.installLocation),
    executablePath: requireString(item.executablePath),
  };
  assertInstallation(installation);
  return installation;
}

function assertInstallation(value: CodexInstallation): void {
  if (value.packageName !== PACKAGE_NAME || value.packageFamilyName !== PACKAGE_FAMILY || value.publisher !== PUBLISHER) {
    throw new Error('CODEX_IDENTITY_INVALID');
  }
  const relative = path.relative(value.installLocation, value.executablePath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.replaceAll('\\', '/').toLowerCase() !== 'app/chatgpt.exe') {
    throw new Error('CODEX_IDENTITY_INVALID');
  }
}

function requireString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('CODEX_IDENTITY_INVALID');
  return value;
}

function isProcess(value: unknown): value is { pid: number; executablePath: string } {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return Number.isInteger(item.pid) && typeof item.executablePath === 'string';
}

function escapePowerShell(value: string): string {
  return value.replaceAll("'", "''");
}
