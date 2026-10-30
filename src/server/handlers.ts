import type { Socket } from 'socket.io';
import type { ZodType } from 'zod';
import type { Ack, ClientToServer, ErrorCode, ServerToClient, Session } from '../shared/protocol';
import { schemas } from '../shared/validation';
import { GameError, type IO, type Player, type Room } from './Room';
import type { RoomManager } from './RoomManager';

interface SocketData {
  code?: string;
  playerId?: string;
}
type GameSocket = Socket<ClientToServer, ServerToClient, {}, SocketData>;

/** Simple sliding-window limiter: at most `limit` hits per `windowMs` per key. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.hits.clear(); // crude memory cap
    return true;
  }
}

const clientIp = (socket: GameSocket) =>
  String(socket.handshake.headers['x-forwarded-for'] ?? socket.handshake.address).split(',')[0].trim();

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new GameError('BAD_INPUT');
  return r.data;
}

/** Run a handler and turn its result or GameError into an ack. */
function handle<T extends object>(cb: unknown, fn: () => T) {
  const ack = (typeof cb === 'function' ? cb : () => {}) as (res: Ack<T>) => void;
  try {
    ack({ ok: true, ...fn() });
  } catch (err) {
    if (err instanceof GameError) return ack({ ok: false, error: err.code });
    console.error(err);
    ack({ ok: false, error: 'SERVER_ERROR' as ErrorCode });
  }
}

export function registerHandlers(io: IO, manager: RoomManager) {
  const roomLimiter = new RateLimiter(60, 60_000); // create/check/join/resume per IP (households share one)
  const guessLimiter = new RateLimiter(30, 1_000); // guesses per socket (more than the alphabet)

  io.on('connection', (raw) => {
    const socket = raw as GameSocket;
    const ip = clientIp(socket);

    const limitRooms = () => {
      if (!roomLimiter.allow(ip)) throw new GameError('RATE_LIMITED');
    };

    const current = (): { room: Room; player: Player } => {
      const { code, playerId } = socket.data;
      const room = code ? manager.get(code) : undefined;
      const player = playerId ? room?.players.get(playerId) : undefined;
      if (!room || !player) throw new GameError('NOT_IN_ROOM');
      return { room, player };
    };

    const leaveCurrent = () => {
      const { code, playerId } = socket.data;
      if (!code) return;
      socket.leave(code);
      socket.data = {};
      if (playerId) manager.get(code)?.removePlayer(playerId);
    };

    const bind = (room: Room, player: Player): { session: Session } => {
      if (socket.data.code && (socket.data.code !== room.code || socket.data.playerId !== player.id)) leaveCurrent();
      const replaced = room.attachSocket(player, socket.id);
      if (replaced) {
        // Same player opened elsewhere: retire the old socket quietly.
        const old = io.sockets.sockets.get(replaced) as GameSocket | undefined;
        if (old) {
          old.data = {};
          old.leave(room.code);
          old.emit('server:notice', { message: 'You joined from another tab.', kind: 'kicked' });
        }
      }
      socket.data = { code: room.code, playerId: player.id };
      socket.join(room.code);
      // Defer so the ack reaches the client before the state push.
      setImmediate(() => {
        room.broadcast();
        room.sendView(player);
      });
      return { session: { code: room.code, playerId: player.id, token: player.token } };
    };

    socket.on('time:ping', (_p, cb) => typeof cb === 'function' && cb({ now: Date.now() }));

    socket.on('room:create', (p, cb) =>
      handle(cb, () => {
        limitRooms();
        const { name, avatarId } = parse(schemas.create, p);
        const room = manager.create();
        return bind(room, room.addPlayer(name, avatarId));
      }),
    );

    socket.on('room:createSolo', (p, cb) =>
      handle(cb, () => {
        limitRooms();
        const { name, avatarId, difficulty } = parse(schemas.createSolo, p);
        const room = manager.create(true);
        const player = room.addPlayer(name, avatarId);
        const result = bind(room, player);
        room.setDifficulty(player.id, difficulty);
        room.startGame(player.id);
        return result;
      }),
    );

    socket.on('room:check', (p, cb) =>
      handle(cb, () => {
        limitRooms();
        const { code } = parse(schemas.check, p);
        const room = manager.getJoinable(code);
        if (!room) return { exists: false, full: false, phase: null, takenAvatars: [], takenNames: [] };
        const players = [...room.players.values()];
        return {
          exists: true,
          full: players.length >= room.publicState().maxPlayers,
          phase: room.phase,
          takenAvatars: players.map((pl) => pl.avatarId),
          takenNames: players.filter((pl) => pl.connected).map((pl) => pl.name), // others can be reclaimed
        };
      }),
    );

    socket.on('room:join', (p, cb) =>
      handle(cb, () => {
        limitRooms();
        const { code, name, avatarId } = parse(schemas.join, p);
        const room = manager.getJoinable(code);
        if (!room) throw new GameError('NOT_FOUND');
        // Rejoining under your old name (e.g. after closing the tab) reclaims your spot and score.
        const ghost = [...room.players.values()].find((pl) => !pl.connected && pl.name.toLowerCase() === name.toLowerCase());
        if (ghost) return bind(room, ghost);
        return bind(room, room.addPlayer(name, avatarId));
      }),
    );

    socket.on('room:resume', (p, cb) =>
      handle(cb, () => {
        limitRooms();
        const { code, token } = parse(schemas.resume, p);
        const room = manager.get(code);
        const player = room?.findByToken(token);
        if (!room || !player) throw new GameError('SESSION_EXPIRED');
        return bind(room, player);
      }),
    );

    socket.on('room:leave', (_p, cb) =>
      handle(cb, () => {
        leaveCurrent();
        return {};
      }),
    );

    socket.on('player:update', (p, cb) =>
      handle(cb, () => {
        const { room, player } = current();
        room.updatePlayer(player.id, parse(schemas.update, p));
        return {};
      }),
    );

    socket.on('game:setDifficulty', (p, cb) =>
      handle(cb, () => {
        const { room, player } = current();
        room.setDifficulty(player.id, parse(schemas.difficulty, p).difficulty);
        return {};
      }),
    );

    socket.on('game:start', (_p, cb) =>
      handle(cb, () => {
        const { room, player } = current();
        room.startGame(player.id);
        return {};
      }),
    );

    socket.on('game:guess', (p, cb) =>
      handle(cb, () => {
        if (!guessLimiter.allow(socket.id)) throw new GameError('RATE_LIMITED');
        const { room, player } = current();
        const { letter, round } = parse(schemas.guess, p);
        return room.guess(player.id, letter, round);
      }),
    );

    socket.on('game:playAgain', (_p, cb) =>
      handle(cb, () => {
        const { room, player } = current();
        room.playAgain(player.id);
        return {};
      }),
    );

    socket.on('disconnect', () => {
      const { code, playerId } = socket.data;
      const room = code ? manager.get(code) : undefined;
      const player = playerId ? room?.players.get(playerId) : undefined;
      if (room && player && player.socketId === socket.id) room.detachSocket(player);
    });
  });
}
