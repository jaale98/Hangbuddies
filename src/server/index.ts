import { createGameServer } from './app';

// `--port=N` wins (used by `npm run dev`, so a PORT meant for Vite isn't grabbed); Render sets PORT.
const portArg = process.argv.find((a) => a.startsWith('--port='))?.split('=')[1];
const port = Number(portArg ?? process.env.PORT ?? 3001);
const { httpServer, io, close } = createGameServer();

httpServer.listen(port, () => {
  console.log(`Hangbuddies server listening on http://localhost:${port}`);
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  io.emit('server:notice', {
    message: 'Hangbuddies is updating. Please rejoin in a moment!',
    kind: 'kicked',
  });
  setTimeout(() => close().then(() => process.exit(0)), 500);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
