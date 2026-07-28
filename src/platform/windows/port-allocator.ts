import { createServer } from 'node:net';

export async function allocateLoopbackPort(preferred = 9335, scanLimit = 100): Promise<number> {
  for (let port = preferred; port < preferred + scanLimit; port += 1) {
    if (await canBindLoopback(port)) return port;
  }
  throw new Error('CDP_PORT_UNAVAILABLE');
}

function canBindLoopback(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}
