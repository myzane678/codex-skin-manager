import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { LoopbackCdpClient } from '../../src/platform/cdp/loopback-cdp-client';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

function version(browserId: string, port: number) {
  return { webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/${browserId}` };
}

describe('LoopbackCdpClient', () => {
  it('rejects a target that redirects its websocket off loopback', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify([{ id: '1', type: 'page', title: 'Welcome', url: 'file://welcome', webSocketDebuggerUrl: 'ws://evil.test/devtools/page/1' }]));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(19444, '127.0.0.1', resolve));

    await expect(new LoopbackCdpClient().listTargets(19444)).rejects.toThrow('CDP_ENDPOINT_NOT_LOOPBACK');
  });

  it('accepts loopback targets from the requested port', async () => {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/json/version') response.end(JSON.stringify(version('browser-1', 19445)));
      else response.end(JSON.stringify([{ id: '1', type: 'page', title: 'Welcome', url: 'file://welcome', webSocketDebuggerUrl: 'ws://127.0.0.1:19445/devtools/page/1' }]));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(19445, '127.0.0.1', resolve));

    await expect(new LoopbackCdpClient().listTargets(19445, 'browser-1')).resolves.toHaveLength(1);
  });

  it('reads a browser identity only from the same loopback port', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(version('browser-verified', 19446)));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(19446, '127.0.0.1', resolve));

    await expect(new LoopbackCdpClient().readBrowserIdentity(19446)).resolves.toEqual({ browserId: 'browser-verified' });
  });

  it('reports whether a verified loopback CDP endpoint is available', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(version('browser-ready', 19448)));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(19448, '127.0.0.1', resolve));

    await expect(new LoopbackCdpClient().isAvailable(19448)).resolves.toBe(true);
    await expect(new LoopbackCdpClient().isAvailable(19449)).resolves.toBe(false);
  });

  it('rejects targets when the browser identity differs', async () => {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/json/version') response.end(JSON.stringify(version('browser-other', 19447)));
      else response.end(JSON.stringify([]));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(19447, '127.0.0.1', resolve));

    await expect(new LoopbackCdpClient().listTargets(19447, 'browser-expected')).rejects.toThrow('CDP_BROWSER_CHANGED');
  });
});
