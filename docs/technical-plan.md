# Hangbuddies — Technical Plan

This document covers how we build what [game-design.md](game-design.md) describes.

**Constraints:** the simplest possible deployment, at a scale of about **10 concurrent games** (at most about 80 players).

**Approach:** a single always-on Node server hosted on **Render**. It serves the game website, holds every player's live WebSocket connection, and keeps all rooms in memory. One small instance is far more than this scale needs.

> **Status:** v1 is built. This doc describes the code as it is. See the [README](../README.md) for running and deploying it.

## 1. Guiding decisions

| Decision | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | Client and server share types for the network protocol. |
| Client | **React + Vite** | Fast dev loop, simple component model for screens. The game is UI-heavy, not canvas-heavy. |
| Rendering | **SVG + CSS animations** (no animation library) | Stick figures and balloons are a few shapes each. SVG stays crisp at any size and is easy to animate. |
| Realtime | **Socket.IO** | Built-in rooms, automatic reconnection, acks, and a fallback transport. Less custom plumbing than raw `ws`. |
| Server | **Node.js**, one process serving both the WebSocket API and the built client | One deployable unit, and no CORS issues. |
| Authority | **Server-authoritative** | The server alone knows the answers and validates every guess. Clients never receive the answer until the round ends. |
| State storage | **In-memory**, no database | Rooms are short-lived and private. Losing them on a redeploy is acceptable (see §10). |
| Hosting | **Render** web service | You connect the GitHub repo and it auto-deploys. It supports WebSockets, and needs no Docker or CLI. |
| Tests | **Vitest** for unit and socket-level integration tests | The game engine is pure logic and easy to unit test. The integration tests play full games over real sockets. |
| Sound | **Synthesized with Web Audio** | Pops, dings and fanfares are generated in code, so there are no audio files to manage. |

## 2. Repository layout

The repo is a single package with three source folders:

```
hangbuddies/
├── package.json              # scripts: dev, build, start, test, words:check
├── tsconfig.json
├── vite.config.ts            # builds src/client → dist/client (+ Vitest config)
├── tsup.config.ts            # bundles src/server → dist/server
├── render.yaml               # Render blueprint
├── index.html
├── docs/
├── src/
│   ├── shared/               # imported by BOTH client and server
│   │   ├── protocol.ts       # socket event names + payload types
│   │   ├── types.ts          # PublicRoomState, PlayerView, Tile, etc.
│   │   ├── constants.ts      # MAX_PLAYERS, ROUNDS, BALLOONS, ROUND_MS...
│   │   ├── avatars.ts        # avatar ids + metadata (color, accessory)
│   │   ├── names.ts          # name cleanup (kept apart so the client doesn't bundle zod)
│   │   └── validation.ts     # zod schemas for names, codes, payloads (server only in practice)
│   ├── server/               # never imported by client code
│   │   ├── index.ts          # entry: listen on PORT, graceful SIGTERM
│   │   ├── app.ts            # express + socket.io setup, static files, /healthz
│   │   ├── RoomManager.ts    # create/find/delete rooms, codes, GC sweep
│   │   ├── Room.ts           # one room: players, host, phase, timers, emits
│   │   ├── engine.ts         # PURE game logic (no I/O): guess, score, round end
│   │   ├── handlers.ts       # socket event → Room method wiring, validation, rate limits
│   │   ├── words.ts          # load + pick words per difficulty
│   │   └── data/words.json   # the word list (server-only!)
│   └── client/
│       ├── main.tsx, App.tsx       # screen chosen by phase
│       ├── net/socket.ts           # socket singleton, actions, clock sync, session
│       ├── state/store.ts          # zustand store fed by server events
│       ├── hooks.ts                # countdown, count-up, FLIP reordering
│       ├── screens/  Home, Setup, Lobby, Game (round + summary), Results (podium)
│       ├── components/ StickFigure, SkyScene (balloons), WordBoard, Keyboard,
│       │               Scoreboard, AvatarPicker, PlayerForm, Confetti, Chrome
│       ├── styles.css
│       └── audio/sfx.ts
├── scripts/check-words.ts
└── tests/
```

**The answer must never reach the client bundle.** The word list lives in `src/server/`. A test (`tests/boundaries.test.ts`) fails if `src/client` or `src/shared` imports anything from `src/server`.

- **Build:** `npm run build` runs `vite build`, which writes the client to `dist/client`. It also bundles the server with `tsup`/esbuild to `dist/server/index.js`.
- **Start:** `npm start` runs `node dist/server/index.js`.
- **Dev:** `npm run dev` runs the Vite dev server on port 5173 (with `/socket.io` proxied to the server) alongside `tsx watch src/server/index.ts --port=3001`. The `--port` flag takes priority over `PORT`, so a `PORT` meant for Vite can't be grabbed by the game server.

## 3. Domain model (server)

`Room.ts` holds everything for one room. The key fields are:

- `players: Map<id, Player>`. Insertion order is seniority. Each `Player` has a secret `token` for resuming, `socketId`, `connected`, a `graceTimer`, `score`, `totalSolveMs` (the tiebreaker), and `activeFromRound` (late joiners start at the next round).
- `phase` (`lobby | round | roundSummary | results`), `difficulty`, `roundIndex`, and the 5 picked `words`. `usedWordIds` prevents repeats across games in the room.
- `roundStartedAt`, `roundEndsAt`, `summaryEndsAt`, and one `timer` for whichever phase is running.
- `roundStates: Map<id, PlayerRoundState>`. Each entry has `guessed[]`, `wrong`, `status` (`playing | solved | fell | timeout | spectating`), `solvedAtMs`, and `points`.
- `summary` (during `roundSummary`), `history` (finished rounds this game), and `ranking` (during `results`).
- `solo`: solo rooms have `minPlayers = 1` and a capacity of 1. `RoomManager.getJoinable()` hides them from `room:check`/`room:join`, so their code can only be used to resume.

Node runs on a single thread, so handlers never run concurrently. No locking is needed. Scores are added the moment a player solves, so the scoreboard updates live.

### 3.1 Pure engine

`engine.ts` contains no sockets, timers or randomness:

- `applyGuess(state, answer, letter, maxBalloons, elapsedMs, roundMs)` mutates the player's round state. It returns `ignored` (for a duplicate or a finished board) or `{ correct, solved, fell, points }`.
- `maskAnswer(answer, guessed, revealAll?)` returns `Tile[][]`, one array per word (see §4).
- `computePoints(elapsedMs, roundMs)` returns `100 + round(900 * remaining / roundMs)`.
- `rankPlayers(players)` sorts by score desc, then `totalSolveMs` asc. Exact ties share a place.

## 4. Network protocol

All payloads are typed in `shared/protocol.ts` and validated on the server with **zod**. Every client→server message uses a Socket.IO **ack**, so the caller gets `{ ok: true, ... } | { ok: false, error: ErrorCode }`.

### 4.1 Client → Server

| Event | Payload | Returns / notes |
|---|---|---|
| `room:create` | `{ name, avatarId }` | `{ session: { code, playerId, token } }`. The creator becomes host. |
| `room:createSolo` | `{ name, avatarId, difficulty }` | `{ session }`. Creates a hidden one-player room and starts the game immediately. |
| `room:check` | `{ code }` | `{ exists, full, phase, takenAvatars, takenNames }`. Used before the setup screen. `takenNames` only lists connected players. |
| `room:join` | `{ code, name, avatarId }` | `{ session }`. Errors: `NOT_FOUND`, `FULL`, `NAME_TAKEN`, `AVATAR_TAKEN`. Joining with the name of a **disconnected** player reclaims that player's spot and score. |
| `room:resume` | `{ code, token }` | Sent automatically on (re)connect when the tab has a saved session. |
| `room:leave` | `{}` | |
| `player:update` | `{ name?, avatarId? }` | Lobby or results only. |
| `game:setDifficulty` | `{ difficulty }` | Host only. Lobby or results (between games). |
| `game:start` | `{}` | Host only. From the lobby **or straight from results** ("Play again"). Needs `minPlayers` connected players (1 in solo). |
| `game:guess` | `{ letter, round }` | Returns `{ outcome, view }`. `round` guards against stale guesses. The guesser's new board comes straight back in the ack, so no extra event is needed. |
| `game:playAgain` | `{}` | Host only, from results. **Back to the lobby** with scores reset. (The UI calls this "Back to lobby".) |
| `time:ping` | `{}` | Returns `{ now }` for clock-offset sync. |

### 4.2 Server → Client

The server pushes **full snapshots** instead of diffs. Rooms are tiny (at most 8 players, a few KB of JSON), so snapshots are simple and self-healing.

| Event | Payload |
|---|---|
| `room:state` | `PublicRoomState`, the same for everyone: code, hostId, phase, difficulty, minPlayers, roundIndex, roundEndsAt, summaryEndsAt, maxBalloons, hint (during a round), players[] (id, name, avatarId, score, connected, roundStatus, balloonsLeft, pointsThisRound). It also includes **`summary`** (answer + per-player results) only during `roundSummary`, and **`ranking`** only during `results`. `solo` flags solo rooms. `history` lists the finished rounds of the current game (answers included, since those rounds are over) and drives the solo recap. |
| `round:you` | `PlayerView \| null`, **sent only to that player's socket** at round start, at round end, and on resume: hint, `words: Tile[][]`, guessed letters with correct flags, balloonsLeft, maxBalloons, status, points. During `roundSummary` the words are fully revealed. |
| `server:notice` | `{ message, kind? }`. Toasts, plus `kicked` for idle-room cleanup, redeploys, and "you joined from another tab". |

**Tile format.** The answer is split into words, and each word is an array of tiles. The client renders each word as an unbreakable group, so lines only wrap between words.

```ts
interface Tile { ch: string | null; punct?: boolean }  // ch null = hidden letter
```

### 4.3 Round flow (server)

```
game:start
  → pick 5 words for difficulty (exclude usedWordIds; reset when the pool runs dry)
  → startRound(0)

startRound(i):
  phase = 'round'; roundEndsAt = now + 90s
  roundStates: 'playing', or 'spectating' for late joiners (activeFromRound > i)
  emit room:state to room + round:you to each player; set timer → endRound

on game:guess:
  validate (phase, round index, letter A–Z, now ≤ roundEndsAt)
  engine.applyGuess(...); on solve add points to score right away
  ack { outcome, view } to the guesser; emit room:state to the room
  if no connected player is still 'playing' → endRound()

endRound():
  remaining 'playing' → 'timeout'; build summary (answer + results)
  phase = 'roundSummary' (6s); emit room:state + round:you (fully revealed board)
  then: i < 4 ? startRound(i+1) : showResults()

showResults(): phase = 'results'; ranking in room:state
game:playAgain: reset scores, phase = 'lobby'
```

Disconnecting also re-checks whether the round is over, so one player who has gone away can't stall a round. If **nobody** is connected (for example a solo player refreshing), the round keeps going until they're back or the timer runs out. There's no scoreboard throttling: at 8 players, one small broadcast per guess is nothing.

## 5. Responsiveness

- **Instant local feedback:** when a key is pressed, the client marks it `pending` right away (pressed style) and sends `game:guess`. The ack comes back over the already-open socket, typically in **30–80 ms**. It settles the key as green or red and triggers the reveal or balloon pop. The client never guesses whether a letter is correct, because it doesn't know the answer.
- **Rapid typing:** a single socket delivers messages in order, and the server handles them one at a time. Players can type as fast as they like. Keys that are pending or already guessed are ignored locally.
- **On-screen keys fire on `pointerdown`**, not on click, which makes touch input snappier. Keyboard activation (Enter/Space on a focused key) still works through click.
- **Physical keyboard:** a single `keydown` listener on `window`, active only on the Game screen while the player is `playing`. It ignores events with modifier keys, key repeats, and events whose target is a text input.
- **Timer:** the client computes `serverOffset` from 3 `time:ping` acks (keeping the one with the lowest round trip), then renders `roundEndsAt - (Date.now() + offset)`. The server stays authoritative for when the round ends and for scoring.
- **Rendering:** animations use only `transform` and `opacity`. The keyboard is memoized.
- **Sizing:** on screens 1100px and wider, the layout grows: a bigger stage, tiles and keys, and a 17–18px root font. Heights are tied to `vh`, so a full round (stage, word, keyboard) fits without scrolling from about 1366×650 up to 1920×1080.
- **Region:** put the Render service in the region closest to most players (for example, Ohio or Virginia for the US).

## 6. Identity, reconnection, and abuse limits

- On create/join the server issues `playerId` + `token` (crypto-random). The client stores the session in `sessionStorage`, which is per tab, so two tabs can be two players while testing. Name and avatar are remembered in `localStorage`.
- When the socket reconnects or the page reloads, the client sends `room:resume`. The server re-binds the socket, cancels the 60 s removal timer, and pushes a fresh snapshot and view. If the same player resumes from a second tab, the old tab is told and detached.
- **Closed the tab?** Joining again with the same name reclaims your disconnected spot and score (see `room:join`).
- **Host migration:** when the host leaves or is removed, `hostId` passes to the earliest-joined connected player.
- **Room codes:** 4 characters from `ABCDEFGHJKMNPQRSTUVWXYZ` (23⁴ ≈ 280k codes). We retry on collision.
- **Rate limits** (sliding window, in memory): at most 30 guesses per second per socket, which is more than the whole alphabet, and 60 create/check/join/resume calls per minute per IP. A household on one Wi‑Fi shares an IP. These limits still make guessing codes impractical.
- **Sanitization:** names are trimmed, internal spaces collapsed to one, and limited to 16 characters. React escapes output, and we never use `dangerouslySetInnerHTML`.
- **GC:** players are removed 60 s after disconnecting, and the room is deleted when the last one goes. A sweep every minute also closes rooms idle for more than 30 minutes.

## 7. Word list

- Stored in `src/server/data/words.json` as `{ easy: [[answer, hint], ...], medium: [...], hard: [...] }`. IDs are derived at load time. There are currently **550 entries** (184 easy, 171 medium, 195 hard). To add words, just append pairs.
- **Easy:** 4–10 letters, single words that are familiar but not trivial (WALRUS, COLANDER, BADMINTON). Hints are broad categories ("Animal", "Kitchen tool").
- **Medium:** 5–18 characters, lots of two- and three-word phrases. Hints are playful clues rather than definitions ("Sundae served in a boat").
- **Hard:** idioms, long and rare words (SYZYGY, SPHYGMOMANOMETER), and short vowel-poor words like RHYTHM, FJORD and CRYPT, which are nasty in hangman. Hints are terse and oblique ("Hardly ever", "Scram").
- `npm run words:check` validates the list: the allowed characters (A–Z, space, and `' - & ! ? . ,`), no duplicates, length bounds for each difficulty, single words in easy, and a hint that doesn't contain any 4+ letter word of the answer. A unit test runs the same check.

## 8. Client architecture

- **Routing by phase, not by URL:** `/` is home and `/:code` is a join deep-link (the server falls back to `index.html`). After joining, the URL becomes `/CODE`, and `App` renders a screen based on `room.phase`.
- **State:** a `zustand` store holds `{ connected, session, room, view, pending, lastOutcome, notice, serverOffset, muted, setup }`. Socket handlers overwrite slices of it.
- **Components:**
  - `StickFigure({ avatarId, pose, crowned, embedded })` draws an SVG figure with poses `stand | wave | hold | cheer | fall | dizzy | sad` and one of 12 accessories. It's reused everywhere.
  - `SkyScene` shows the clouds, the ground, and your buddy hanging from N balloons. Altitude tracks balloons left. The highest altitude is computed from the balloon cluster's height so the top balloon never leaves the frame. Popped balloons burst. Falling drops the buddy (with gravity easing) onto a flat strip of ground. The dizzy pose, dust puff and ground thud start on `transitionend`, the moment the feet touch down. Timing out floats the buddy away. Status banners sit at the top of the sky so they never cover the landing.
  - `WordBoard` shows word groups of tiles, sized by phrase length. Missed letters turn red on reveal, and a wrong guess shakes the board.
  - `Keyboard` is a QWERTY layout with green, grey-strikethrough and pending states.
  - `Scoreboard` shows rows sorted by score, with FLIP reorder animation, count-up scores, and live status chips. On narrow screens it collapses into a top strip.
- **Audio:** sounds are synthesized with Web Audio oscillators and noise (pop, ding, solve jingle, fall + bonk, start, fanfare, last-5-seconds tick), so there are no audio files. The mute toggle is saved in `localStorage`.

## 9. Testing strategy

**Visual preview (dev only):** `/?preview=round|summary|results|lobby` renders any screen with fake data, without a server game. Options include `status`, `balloons`, `diff`, `answer`, `guessed`, `players`, `then`/`after` to watch a transition, and `still` to skip animations for screenshots. The code is tree-shaken out of production builds.


`npm test` runs all of these:

- **Unit:** engine (masking, scoring curve, solving, falling, duplicates, ranking and ties) and word-list validation.
- **Socket integration:** starts the server in-process with short timers and drives real `socket.io-client`s. It covers:
  - a full 5-round game, checking that no in-round message leaks an answer
  - name and avatar clashes, host-only actions
  - resume after disconnect, host migration
  - reclaiming a spot by name, grace-period removal
  - bad input
- **Boundary:** client and shared code never import server code.
- **Not yet:** a Playwright E2E suite. Manual two-tab play in the browser covered the flows for v1.

## 10. Deployment (Render)

**One-time setup:**
1. Push the repo to GitHub.
2. In Render choose **New → Blueprint** and pick the repo. `render.yaml` configures everything. (Or create a **Web Service** by hand with the same settings:)
   - Runtime: **Node 22**
   - Build command: `npm ci --include=dev && npm run build`. The build tools are dev dependencies, so this makes sure they're installed.
   - Start command: `npm start`
   - Health check path: `/healthz`
   - Instance type: **Starter** (about $7/mo, always on). Avoid the free tier, which sleeps after 15 minutes idle and takes 30–60 s to wake up.
3. You don't need any environment variables. The server reads `PORT` from Render automatically.

**Day to day:**
- Every push to `main` auto-deploys.
- The server listens on `PORT`, serves `dist/client` statically with an SPA fallback, and attaches Socket.IO to the same HTTP server.

**Redeploys and in-memory state:** a deploy starts a new instance and stops the old one, so any games in progress are lost. At this scale we accept that and simply avoid deploying while friends are playing. On `SIGTERM` the server tells everyone "Hangbuddies is updating, please rejoin in a moment" before it exits.

**Scaling:** one Starter instance easily handles about 10 games and 80 sockets. Because everything is in memory, the service must run **exactly one instance**, so autoscaling stays off. If we ever outgrow that, we could move room state to Redis with the Socket.IO Redis adapter. Not needed now.

## 11. Ideas for later

- Playwright E2E tests, plus a test that the built client bundle contains no answers (checked by hand for v1).
- Emoji reactions, custom word lists, a "change difficulty" option between games without returning to the lobby, and round-length settings.

## 12. Open questions (defaults chosen, easy to change)

- **Round length is 90 s for every difficulty.** We could make Hard 120 s if long phrases feel rushed.
- **Minimum of 2 players to start.** Setting the env var `ALLOW_SOLO=1` lets you test with one player.
- **Late joiners** wait for the next round instead of being blocked until the game ends.
- **Visibility of other players:** they can see each other's balloon counts and solved/fell status, but not their letters.
