import { describe, expect, it } from 'vitest';
import { TrayProxyWindow } from '../../src/core/runtime/tray-proxy-window';

const existing = [{ pid: 10, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' }];

describe('TrayProxyWindow', () => {
  it('ignores existing and repeated processes while selecting the first new candidate', () => {
    const time = 0;
    const window = new TrayProxyWindow(existing, () => time);

    expect(window.observe(existing)).toEqual({ status: 'ignored' });
    expect(window.observe([...existing, { pid: 11, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' }])).toEqual({
      status: 'candidate',
      candidate: { pid: 11, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' },
    });
    expect(window.observe([...existing, { pid: 11, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' }])).toEqual({ status: 'ignored' });
    expect(window.consumeCandidate()).toEqual({ pid: 11, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' });
  });

  it('resumes observing after a consumed candidate', () => {
    const window = new TrayProxyWindow(existing, () => 0);
    window.observe([...existing, { pid: 11, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' }]);
    window.consumeCandidate();

    expect(window.observe([...existing, { pid: 12, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' }])).toEqual({
      status: 'candidate',
      candidate: { pid: 12, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' },
    });
  });

  it('expires the candidate window without selecting later processes', () => {
    let time = 0;
    const window = new TrayProxyWindow(existing, () => time, 5_000);
    window.observe([...existing, { pid: 11, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' }]);
    time = 5_000;

    expect(window.observe([...existing, { pid: 12, executablePath: 'C:/WindowsApps/OpenAI.Codex/app/ChatGPT.exe' }])).toEqual({ status: 'expired' });
    expect(window.consumeCandidate()).toBeNull();
  });
});
