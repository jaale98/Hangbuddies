import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGameServer } from '../src/server/app';
import type { ClientToServer, ServerToClient } from '../src/shared/protocol';
import type { PlayerView, PublicRoomState } from '../src/shared/types';
import { LETTERS } from '../src/shared/constants';

type Client = Socket<ServerToClient, ClientToServer> & {
  state?: PublicRoomState;
  view?: PlayerView | null;
  log: string[];
};

let server: ReturnType<typeof createGameServer>;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  server = createGameServer({ roundMs: 2000, summaryMs: 1000, graceMs: 200, minPlayers: 2 });
  await new Promise<void>((r) => server.httpServer.listen(0, r));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server.close();
});

async function client(): Promise<Client> {
  const c = connect(url, { transports: ['websocket'], forceNew: true }) as Client;
  c.log = [];
  c.onAny((event, payload) => c.log.push(JSON.stringify([event, payload])));
  c.on('room:state', (s) => (c.state = s));
  c.on('round:you', (v) => (c.view = v));
  clients.push(c);
  await new Promise((r) => c.on('connect', () => r(null)));
  return c;
}

const call = <E extends keyof ClientToServer>(c: Client, event: E, payload: Parameters<ClientToServer[E]>[0]) =>
  new Promise<any>((resolve) => (c.emit as any)(event, payload, resolve));

const until = async (cond: () => boolean, ms = 4000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('a full game', () => {
  it('plays 5 rounds without leaking answers, then ranks players', { timeout: 20_000 }, async () => {
    const host = await client();
    const guest = await client();

    const created = await call(host, 'room:create', { name: 'Hosty', avatarId: 'party' });
    expect(created.ok).toBe(true);
    const code = created.session.code;

    expect((await call(guest, 'room:join', { code, name: 'hosty', avatarId: 'cap' })).error).toBe('NAME_TAKEN');
    expect((await call(guest, 'room:join', { code, name: 'Guest', avatarId: 'party' })).error).toBe('AVATAR_TAKEN');
    expect((await call(guest, 'room:join', { code, name: 'Guest', avatarId: 'cap' })).ok).toBe(true);
    expect((await call(guest, 'game:start', {})).error).toBe('NOT_HOST');

    await until(() => host.state?.players.length === 2);
    expect((await call(host, 'game:setDifficulty', { difficulty: 'hard' })).ok).toBe(true);
    expect((await call(host, 'game:start', {})).ok).toBe(true);

    const answers: string[] = [];
    for (let round = 0; round < 5; round++) {
      await until(() => host.view?.roundIndex === round && host.state?.phase === 'round');

      // Host guesses every letter in alphabet order; guest just falls with wrong guesses.
      let solved = false;
      for (const letter of LETTERS) {
        const res = await call(host, 'game:guess', { letter, round });
        if (!res.ok) break;
        if (res.outcome.fell) break;
        if (res.outcome.solved) {
          solved = true;
          break;
        }
      }
      // Hard = 6 balloons; it might fall before solving, which is fine.
      await until(() => guest.state?.phase === 'round' || guest.state?.phase === 'roundSummary');
      if (guest.state?.phase === 'round') {
        for (const letter of LETTERS) {
          const res = await call(guest, 'game:guess', { letter, round });
          if (!res.ok || res.outcome.fell || res.outcome.solved) break;
        }
      }

      await until(() => host.state?.phase === 'roundSummary' || (round === 4 && host.state?.phase === 'results'));
      const summary = host.state!.summary ?? null;
      if (summary) {
        answers.push(summary.answer);
        expect(summary.results.find((r) => r.playerId === created.session.playerId)!.status).toBe(
          solved ? 'solved' : 'fell',
        );
      }
    }

    await until(() => host.state?.phase === 'results');
    const ranking = host.state!.ranking!;
    expect(ranking).toHaveLength(2);
    expect(ranking[0].place).toBe(1);

    // No message before a round's summary may contain that round's answer.
    for (const c of [host, guest]) {
      for (const line of c.log) {
        const [event, payload] = JSON.parse(line);
        if (event === 'room:state' && payload.phase === 'round') {
          // The live round's answer must never be sent (finished rounds in `history` are fine).
          expect(JSON.stringify(payload)).not.toContain(`"${answers[payload.roundIndex]}"`);
        }
        if (event === 'round:you' && payload?.status === 'playing') {
          const hidden = payload.words.flat().some((t: { ch: string | null }) => t.ch === null);
          expect(hidden).toBe(true);
        }
      }
    }

    expect((await call(host, 'game:playAgain', {})).ok).toBe(true);
    await until(() => guest.state?.phase === 'lobby');
    expect(guest.state!.players.every((p) => p.score === 0)).toBe(true);
  });

  it('lets a player resume after disconnecting, and migrates host when they leave', async () => {
    const host = await client();
    const guest = await client();
    const { session } = await call(host, 'room:create', { name: 'A', avatarId: 'party' });
    await call(guest, 'room:join', { code: session.code, name: 'B', avatarId: 'cap' });

    host.disconnect();
    await until(() => guest.state?.players.find((p) => p.id === session.playerId)?.connected === false);

    const again = await client();
    const resumed = await call(again, 'room:resume', { code: session.code, token: session.token });
    expect(resumed.ok).toBe(true);
    await until(() => guest.state?.players.find((p) => p.id === session.playerId)?.connected === true);

    await call(again, 'room:leave', {});
    await until(() => guest.state?.players.length === 1);
    expect(guest.state!.hostId).not.toBe(session.playerId);
  });

  it('lets a disconnected player reclaim their spot by rejoining with the same name', async () => {
    const host = await client();
    const guest = await client();
    const { session } = await call(host, 'room:create', { name: 'A', avatarId: 'party' });
    const joined = await call(guest, 'room:join', { code: session.code, name: 'Bea', avatarId: 'cap' });
    guest.disconnect();
    await until(() => host.state?.players.find((p) => p.name === 'Bea')?.connected === false);
    const again = await client();
    const rejoined = await call(again, 'room:join', { code: session.code, name: 'bea', avatarId: 'halo' });
    expect(rejoined.session.playerId).toBe(joined.session.playerId);
    await until(() => host.state?.players.find((p) => p.name === 'Bea')?.connected === true);
    expect(host.state!.players).toHaveLength(2);
  });

  it('removes players whose grace period runs out', async () => {
    const host = await client();
    const guest = await client();
    const { session } = await call(host, 'room:create', { name: 'A', avatarId: 'party' });
    await call(guest, 'room:join', { code: session.code, name: 'B', avatarId: 'cap' });
    guest.disconnect();
    await until(() => host.state?.players.length === 1, 2000);
  });

  it('starts a solo game immediately and hides it from joiners', async () => {
    const me = await client();
    const res = await call(me, 'room:createSolo', { name: 'Solo', avatarId: 'cap', difficulty: 'hard' });
    expect(res.ok).toBe(true);
    await until(() => me.state?.phase === 'round' && !!me.view);
    expect(me.state!.solo).toBe(true);
    expect(me.state!.difficulty).toBe('hard');
    expect(me.view!.maxBalloons).toBe(6);

    const other = await client();
    expect((await call(other, 'room:check', { code: res.session.code })).exists).toBe(false);
    expect((await call(other, 'room:join', { code: res.session.code, name: 'X', avatarId: 'bow' })).error).toBe('NOT_FOUND');
  });

  it('keeps a solo round going while the player refreshes', async () => {
    const me = await client();
    const { session } = await call(me, 'room:createSolo', { name: 'Solo', avatarId: 'cap', difficulty: 'easy' });
    await until(() => me.view?.status === 'playing');
    me.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    const again = await client();
    expect((await call(again, 'room:resume', { code: session.code, token: session.token })).ok).toBe(true);
    await until(() => again.state?.phase === 'round' && again.view?.status === 'playing');
  });

  it('lets the host change difficulty on the results screen and start the next game directly', async () => {
    const me = await client();
    const { session } = await call(me, 'room:createSolo', { name: 'Solo', avatarId: 'cap', difficulty: 'easy' });
    // Burn through 5 rounds by falling each time.
    for (let round = 0; round < 5; round++) {
      await until(() => me.state?.phase === 'round' && me.view?.roundIndex === round && me.view?.status === 'playing');
      for (const letter of LETTERS) {
        const r = await call(me, 'game:guess', { letter, round });
        if (!r.ok || r.outcome.fell || r.outcome.solved) break;
      }
    }
    await until(() => me.state?.phase === 'results');
    expect(me.state!.history).toHaveLength(5);
    expect(me.state!.history.every((h) => h.answer.length > 0)).toBe(true);

    expect((await call(me, 'game:setDifficulty', { difficulty: 'hard' })).ok).toBe(true);
    expect((await call(me, 'game:start', {})).ok).toBe(true);
    await until(() => me.state?.phase === 'round' && me.view?.roundIndex === 0);
    expect(me.state!.difficulty).toBe('hard');
    expect(me.state!.history).toHaveLength(0);
    expect(me.state!.players[0].score).toBe(0);
    void session;
  }, 30_000);

  it('rejects unknown codes and bad input', async () => {
    const c = await client();
    expect((await call(c, 'room:join', { code: 'ZZZZ', name: 'X', avatarId: 'cap' })).error).toBe('NOT_FOUND');
    expect((await call(c, 'room:create', { name: '   ', avatarId: 'cap' })).error).toBe('BAD_INPUT');
    expect((await call(c, 'room:create', { name: 'X', avatarId: 'nope' })).error).toBe('BAD_INPUT');
  });
});
