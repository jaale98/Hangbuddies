# Hangbuddies — Technical Plan

This document covers how we build what [game-design.md](game-design.md) describes.

**Constraints:** the simplest possible deployment, at a scale of about **10 concurrent games** (at most about 80 players).

**Approach:** a single always-on Node server hosted on **Render**. It serves the game website, holds every player's live WebSocket connection, and keeps all rooms in memory. One small instance is far more than this scale needs.

## 1. Guiding decisions

| Decision | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | Client and server share types for the network protocol. |
| Client | **React + Vite** | Fast dev loop, simple component model for screens. The game is UI-heavy, not canvas-heavy. |
| Rendering | **SVG + CSS animations** (plus `framer-motion` where needed) | Stick figures and balloons are a few shapes each. SVG stays crisp at any size and is easy to animate. |
| Realtime | **Socket.IO** | Built-in rooms, automatic reconnection, acks, and a fallback transport. Less custom plumbing than raw `ws`. |
| Server | **Node.js**, one process serving both the WebSocket API and the built client | One deployable unit, and no CORS issues. |
| Authority | **Server-authoritative** | The server alone knows the answers and validates every guess. Clients never receive the answer until the round ends. |
| State storage | **In-memory**, no database | Rooms are short-lived and private. Losing them on a redeploy is acceptable (see §10). |
| Hosting | **Render** web service | You connect the GitHub repo and it auto-deploys. It supports WebSockets, and needs no Docker or CLI. |
| Tests | **Vitest** for unit/integration, **Playwright** for E2E | The game engine is pure logic and easy to unit test. Playwright can drive several browsers in one test. |

## 2. Repository layout

The repo is a single package with three source folders:

```
hangbuddies/
├── package.json              # scripts: dev, build, start, test, words:check
├── tsconfig.json
├── vite.config.ts            # builds src/client → dist/client
├── index.html
├── docs/
├── src/
│   ├── shared/               # imported by BOTH client and server
│   │   ├── protocol.ts       # socket event names + payload types
│   │   ├── types.ts          # PublicRoomState, PlayerView, Tile, etc.
│   │   ├── constants.ts      # MAX_PLAYERS, ROUNDS, BALLOONS, ROUND_MS...
│   │   ├── avatars.ts        # avatar ids + metadata (color, accessory)
│   │   └── validation.ts     # zod schemas for names, codes, payloads
│   ├── server/               # never imported by client code
│   │   ├── index.ts          # http server, static files, socket.io setup, /healthz
│   │   ├── RoomManager.ts    # create/find/delete rooms, codes, GC sweep
│   │   ├── Room.ts           # one room: players, host, phase, timers, emits
│   │   ├── engine.ts         # PURE game logic (no I/O): guess, score, round end
│   │   ├── handlers.ts       # socket event → Room method wiring + validation
│   │   ├── words.ts          # load + pick words per difficulty
│   │   └── data/words.json   # the word list (server-only!)
│   └── client/
│       ├── main.tsx, App.tsx       # screen chosen by phase
│       ├── net/socket.ts           # socket singleton, clock sync, session
│       ├── state/store.ts          # zustand store fed by server events
│       ├── screens/  Home, Setup, Lobby, Game, RoundSummary, Results
│       ├── components/ StickFigure, BalloonBunch, WordBoard, Keyboard,
│       │               Scoreboard, Timer, Podium, Confetti, AvatarPicker
│       └── audio/sfx.ts
├── scripts/check-words.ts
└── tests/
```

**The answer must never reach the client bundle.** The word list lives in `src/server/`. A lint rule (`no-restricted-imports`) stops `src/client` and `src/shared` from importing anything in `src/server`.

- **Build:** `npm run build` runs `vite build`, which writes the client to `dist/client`. It also bundles the server with `tsup`/esbuild to `dist/server/index.js`.
- **Start:** `npm start` runs `node dist/server/index.js`.
- **Dev:** `npm run dev` runs the Vite dev server (with `/socket.io` proxied to the server) alongside `tsx watch src/server/index.ts`.

## 3. Domain model (server)

```ts
type Difficulty = 'easy' | 'medium' | 'hard';
type Phase = 'lobby' | 'round' | 'roundSummary' | 'results';

interface WordEntry { id: string; answer: string; hint: string; difficulty: Difficulty }

interface Player {
  id: string;              // stable per session (not the socket id)
  sessionToken: string;    // secret, used to reconnect
  socketId?: string;
  name: string;
  avatarId: string;
  joinedAt: number;
  connected: boolean;
  disconnectTimer?: NodeJS.Timeout;
  score: number;
  totalSolveMs: number;    // tiebreaker
  activeFromRound: number; // late joiners start at the next round
}

interface PlayerRoundState {
  guessed: Set<string>;    // letters A–Z
  wrong: number;           // balloons popped
  status: 'playing' | 'solved' | 'fell' | 'timeout' | 'spectating';
  solvedAtMs?: number;     // ms since round start
  points: number;
}

interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;   // insertion order = seniority
  phase: Phase;
  difficulty: Difficulty;
  roundIndex: number;             // 0..4
  words: WordEntry[];             // the 5 picked for this game
  usedWordIds: Set<string>;       // avoid repeats across games in this room
  roundStartedAt: number;         // server epoch ms
  roundEndsAt: number;
  roundStates: Map<string, PlayerRoundState>;
  timers: { roundEnd?: NodeJS.Timeout; summary?: NodeJS.Timeout };
  lastActivity: number;
}
```

Node runs on a single thread, so handlers never run concurrently. No locking is needed.

### 3.1 Pure engine

`engine.ts` exports pure functions with no sockets and no timers, so they are trivial to unit test:

- `applyGuess(answer, roundState, letter, maxBalloons, elapsedMs, roundMs)` returns `{ roundState, result: 'correct'|'wrong'|'duplicate', solved, fell, points }`
- `maskAnswer(answer, guessed)` returns the tile array (see §4)
- `computePoints(elapsedMs, roundMs)` returns `100 + round(900 * max(0, roundMs - elapsedMs) / roundMs)`
- `isRoundOver(roundStates)` and `rankPlayers(players)` (score desc, then totalSolveMs asc, ties share a placement)

`Room.ts` handles orchestration: it calls the engine, manages timers, and emits events.

## 4. Network protocol

All payloads are typed in `shared/protocol.ts` and validated on the server with **zod**. Client→server messages use Socket.IO **acks**, so the caller gets `{ ok: true, ... } | { ok: false, error }`.

### 4.1 Client → Server

| Event | Payload | Notes |
|---|---|---|
| `room:create` | `{ name, avatarId }` | Returns `{ code, playerId, sessionToken }`. The creator becomes host. |
| `room:check` | `{ code }` | Returns `{ exists, full, takenAvatars, phase }`. Used before the setup screen. |
| `room:join` | `{ code, name, avatarId }` | Errors: `NOT_FOUND`, `FULL`, `NAME_TAKEN`, `AVATAR_TAKEN`. |
| `room:resume` | `{ code, sessionToken }` | Sent automatically on reconnect or page refresh. |
| `room:leave` | `{}` | |
| `player:update` | `{ name?, avatarId? }` | Lobby only. |
| `game:setDifficulty` | `{ difficulty }` | Host only, lobby only. |
| `game:start` | `{}` | Host only. Needs ≥ 2 connected players. |
| `game:guess` | `{ letter, round }` | `round` guards against stale guesses from the previous round. |
| `game:playAgain` | `{}` | Host only, from results. Returns to lobby and resets scores. |

### 4.2 Server → Client

The server pushes **full snapshots** instead of diffs. Rooms are tiny (at most 8 players, about 1–2 KB of JSON), so snapshots are simple and self-healing.

| Event | Payload |
|---|---|
| `room:state` | `PublicRoomState`, the same for everyone: code, hostId, phase, difficulty, roundIndex, roundEndsAt, hint (during a round), players[] (id, name, avatarId, score, connected, roundStatus, balloonsLeft) |
| `round:you` | `PlayerView`, **sent only to that player's socket**: tiles, wordBreaks, guessed letters with correct/wrong flags, balloonsLeft, status, pointsThisRound |
| `guess:result` | `{ letter, result, solved?, fell?, points? }`. Sent to the guesser and triggers their animations and SFX. |
| `round:summary` | `{ answer, results[] }`. The answer is revealed only here. |
| `game:results` | `{ ranking[] }` with placements |
| `server:time` | `{ now }`. Reply to a client ping, used for clock-offset sync. |

**Tile format** for the masked answer:

```ts
type Tile =
  | { k: 'letter', ch: string | null }  // null = still hidden
  | { k: 'space' }
  | { k: 'punct', ch: string };
```

`wordBreaks` (the tile index ranges for each word) lets the client wrap lines between words instead of mid-word.

### 4.3 Round flow (server)

```
game:start
  → pick 5 words for difficulty (exclude usedWordIds)
  → startRound(0)

startRound(i):
  phase = 'round'; roundStartedAt = now; roundEndsAt = now + 90_000
  init roundStates (late joiners whose activeFromRound > i → 'spectating')
  emit room:state to room + round:you to each player
  set roundEnd timer

on game:guess:
  validate (phase, round index, letter A–Z, player status 'playing', now < roundEndsAt)
  engine.applyGuess(...)
  emit guess:result + round:you to that player
  emit room:state to the room (scoreboard status changed)
  if isRoundOver → endRound()

endRound():
  clear timer; mark remaining 'playing' as 'timeout'
  phase = 'roundSummary'; emit round:summary + room:state
  after 5s: i < 4 ? startRound(i+1) : showResults()

showResults(): phase = 'results'; emit game:results + room:state
game:playAgain: reset scores, phase = 'lobby'
```

Scoreboard updates (`room:state`) are throttled to at most about 10 per second per room. This is in case 8 players are mashing keys at once.

## 5. Responsiveness

- **Instant local feedback:** when a key is pressed, the client marks it `pending` right away (pressed style, input disabled) and sends `game:guess`. The server replies over the already-open socket, typically in **30–80 ms**. The reply settles the key as green or red and triggers the reveal or balloon pop. The client never guesses whether a letter is correct, because it doesn't know the answer.
- **Rapid typing:** a single socket delivers messages in order, and the server handles them one at a time. Players can type as fast as they like. Keys that are pending or already guessed are ignored locally.
- **Physical keyboard:** a single `keydown` listener on `window`, active only on the Game screen while the player is `playing`. It ignores events with modifier keys and events whose target is a text input.
- **Timer:** the client computes `serverOffset` from a few `server:time` pings (taking the midpoint of each round trip), then renders `roundEndsAt - (Date.now() + offset)` with `requestAnimationFrame`. The server stays authoritative for when the round ends and for scoring.
- **Rendering:** animations use only `transform` and `opacity`. The keyboard and the word board are memoized so that a scoreboard update doesn't re-render them.
- **Region:** put the Render service in the region closest to most players (for example, Ohio or Virginia for the US).

## 6. Identity, reconnection, and abuse limits

- On create/join the server issues `playerId` + `sessionToken` (crypto-random). The client stores `{ code, sessionToken }` in `sessionStorage`, which is per tab, so two tabs can be two players while testing.
- When the socket reconnects or the page reloads, the client sends `room:resume`. The server re-binds the socket, cancels the 60 s removal timer, and pushes a fresh snapshot.
- **Host migration:** when the host leaves or is removed, `hostId` passes to the earliest-joined connected player.
- **Room codes:** 4 characters from `ABCDEFGHJKMNPQRSTUVWXYZ` (23⁴ ≈ 280k codes). We retry on collision.
- **Rate limits:** a simple in-memory token bucket allows at most 20 guesses per second per socket, and 10 create/check/join attempts per minute per IP. That makes guessing codes impractical.
- **Sanitization:** names are trimmed, internal spaces collapsed to one, and limited to 16 characters. React escapes output, and we never use `dangerouslySetInnerHTML`.
- **GC:** a sweep every minute deletes rooms that have no connected players or have been idle for more than 30 minutes.

## 7. Word list

- Stored in `src/server/data/words.json` as `WordEntry[]`. Target: **at least 450 entries** (about 150 per difficulty).
- **Easy:** 3–8 letters, very common words, mostly single words. Hints are categories ("Animal", "Food").
- **Medium:** 6–14 letters, some two-word phrases. Hints are short clues ("Something you'd find at a beach").
- **Hard:** longer or less common words, phrases, and idioms. Hints are more oblique.
- `npm run words:check` validates the list: the allowed character set, no duplicates, hint present, length within the bounds for each difficulty, and the hint doesn't contain the answer. It also runs as part of the tests.
- Answers are uppercased at load time and their letter sets are precomputed.

## 8. Client architecture

- **Routing by phase, not by URL:** `/` is home and `/:code` is a join deep-link (the server falls back to `index.html`). After joining, `App` renders a screen based on `room.phase`.
- **State:** a small `zustand` store holds `{ connection, me, room, view, lastGuessEvent, summary, results, settings }`. Socket handlers simply overwrite slices of the store.
- **Components:**
  - `StickFigure({ avatarId, pose: 'idle'|'cheer'|'fall'|'dizzy', size })` is reused on the play area, scoreboard, podium, and avatar picker.
  - `BalloonBunch({ total, remaining, lastPoppedIndex })` renders N balloons in a fan shape and animates whichever one just popped.
  - `WordBoard({ tiles, wordBreaks })` lays out tiles in flex-wrapped word groups.
  - `Keyboard({ states, onKey })` is a QWERTY layout with 44 px minimum touch targets.
  - `Scoreboard` shows sorted rows and uses FLIP animations for reordering.
- **Audio:** a few small SFX files played through Web Audio, unlocked on the first user gesture. The mute setting is saved in `localStorage`.

## 9. Testing strategy

- **Unit (Vitest):** engine (guessing, duplicates, solving, falling, scoring curve, auto-revealed punctuation, ranking and ties), word-list validator, code generator.
- **Server integration (Vitest):** start the server in-process on a random port and connect 2–3 `socket.io-client` instances. Script a full 5-round game using fake timers, and verify that no message before `round:summary` ever contains the answer.
- **E2E (Playwright):** two browser contexts. One hosts, the other joins by code, and both play a round. Also covers reconnecting after a reload.
- **Manual:** test on phone sizes (iOS Safari, Android Chrome) to check the keyboard layout and touch.

## 10. Deployment (Render)

**One-time setup:**
1. Push the repo to GitHub.
2. In Render, create a **New → Web Service** from the repo:
   - Runtime: **Node**
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`
   - Health check path: `/healthz`
   - Instance type: **Starter** (about $7/mo, always on). Avoid the free tier, which sleeps after 15 minutes idle and takes 30–60 s to wake up.
3. You don't need any environment variables. The server reads `PORT` from Render automatically.

**Day to day:**
- Every push to `main` auto-deploys. Optionally, a `render.yaml` in the repo records the settings above as code.
- The server listens on `process.env.PORT`, serves `dist/client` statically with an SPA fallback, and attaches Socket.IO to the same HTTP server.

**Redeploys and in-memory state:** a deploy starts a new instance and stops the old one, so any games in progress are lost. At this scale we accept that and simply avoid deploying while friends are playing. On `SIGTERM` the server broadcasts a "Hangbuddies is updating, please rejoin in a moment" message before it exits.

**Scaling:** one Starter instance easily handles about 10 games and 80 sockets. Because everything is in memory, the service must run **exactly one instance**, so autoscaling stays off. If we ever outgrow that, we could move room state to Redis with the Socket.IO Redis adapter. Not needed now.

## 11. Milestones

1. **Skeleton:** project setup, shared types, a server that serves the client, socket connects. Home → Host/Join → Lobby with a live player list. First deploy to Render.
2. **Core game:** engine with unit tests, a starter word list of about 60 words, round flow, keyboard input (on-screen and physical), masked board, timer, scoring, scoreboard.
3. **Game lifecycle:** round summary, results and podium, play again, host migration, reconnect/resume, late join, room GC.
4. **Look and feel:** stick figure and avatar art, balloon and fall animations, confetti, SFX, mobile layout, reduced-motion support.
5. **Content and polish:** full 450+ word list with the validator, rate limits, E2E tests.

## 12. Open questions (defaults chosen, easy to change)

- **Round length is 90 s for every difficulty.** We could make Hard 120 s if long phrases feel rushed.
- **Minimum of 2 players to start.** A dev-only env flag `ALLOW_SOLO=1` lets you test with one player.
- **Late joiners** wait for the next round instead of being blocked until the game ends.
- **Visibility of other players:** they can see each other's balloon counts and solved/fell status, but not their letters.
