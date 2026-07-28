import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { allocateLoopbackPort } from '../../src/platform/windows/port-allocator';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

describe('allocateLoopbackPort', () => {
  it('uses the preferred loopback port when available', async () => {
    const port = await allocateLoopbackPort(19335, 2);
    expect(port).toBe(19335);
  });

  it('scans when the preferred port is occupied', async () => {
    const server = createServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(19345, '127.0.0.1', resolve));

    expect(await allocateLoopbackPort(19345, 3)).toBe(19346);
  });
});
