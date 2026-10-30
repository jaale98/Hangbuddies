import { randomInt } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH, ROOM_IDLE_MS } from '../shared/constants';
import { Room, type IO, type RoomOptions } from './Room';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private sweeper: NodeJS.Timeout;

  constructor(
    private io: IO,
    private opts: RoomOptions,
  ) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  get size() {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** Rooms other people can find by code (solo rooms are hidden). */
  getJoinable(code: string): Room | undefined {
    const room = this.get(code);
    return room && !room.solo ? room : undefined;
  }

  create(solo = false): Room {
    let code: string;
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.io, this.opts, (r) => this.rooms.delete(r.code), solo);
    this.rooms.set(code, room);
    return room;
  }

  /** Delete rooms nobody has touched in a while. */
  sweep(now = Date.now()) {
    for (const room of this.rooms.values()) {
      if (now - room.lastActivity > ROOM_IDLE_MS) {
        this.io.to(room.code).emit('server:notice', { message: 'This room closed after being idle.', kind: 'kicked' });
        this.io.in(room.code).socketsLeave(room.code);
        room.destroy();
        this.rooms.delete(room.code);
      }
    }
  }

  closeAll() {
    clearInterval(this.sweeper);
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
  }
}
