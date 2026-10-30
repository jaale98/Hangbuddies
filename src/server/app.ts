import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { MIN_PLAYERS, RECONNECT_GRACE_MS, ROUND_MS, SUMMARY_MS } from '../shared/constants';
import { registerHandlers } from './handlers';
import type { IO, RoomOptions } from './Room';
import { RoomManager } from './RoomManager';

export function createGameServer(overrides: Partial<RoomOptions> = {}) {
  const opts: RoomOptions = {
    roundMs: ROUND_MS,
    summaryMs: SUMMARY_MS,
    graceMs: RECONNECT_GRACE_MS,
    minPlayers: process.env.ALLOW_SOLO === '1' ? 1 : MIN_PLAYERS,
    ...overrides,
  };

  const app = express();
  app.disable('x-powered-by');
  const httpServer = createServer(app);
  const io: IO = new Server(httpServer, { pingInterval: 10_000, pingTimeout: 8_000 });
  const manager = new RoomManager(io, opts);
  registerHandlers(io, manager);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: manager.size, sockets: io.engine.clientsCount });
  });

  const clientDir = path.resolve('dist/client');
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    // SPA fallback so /ABCD join links work.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  const close = () =>
    new Promise<void>((resolve) => {
      manager.closeAll();
      io.close(() => resolve());
    });

  return { app, httpServer, io, manager, close };
}
