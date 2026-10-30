# Hangbuddies — Game Design

Hangbuddies is a hangman game for 2–8 friends in a private room, with a solo mode for playing alone. Everyone races to solve the **same word at the same time**, each on their own board. Instead of a noose, every player is a little stick figure floating on a bunch of balloons. Guess wrong and a balloon pops. Lose them all and you drop to the ground with a *bonk*.

The tone is simple, silly, and cute: stick figures, bright balloons, and bouncy animations.

---

## 1. Core loop

1. One player **hosts** a game and gets a 4-letter room code.
2. Friends **join** with the code, pick a name and an avatar, and wait in the lobby.
3. The host picks a **difficulty** and starts the game.
4. The game is **5 rounds**. Each round, every player gets the same hidden word or phrase plus a hint, and guesses letters on their own board.
5. Solving faster earns more points. Failing earns nothing.
6. After round 5, the **top 3 go on a podium** and the winner is crowned.
7. The host can pick a new difficulty and **start another game** right from the results screen. Scores reset to zero.

**Solo:** the same 5-round game for one player, starting immediately, with a personal best per difficulty instead of a podium (see 2.7).

---

## 2. Screens

### 2.1 Home
- Title/logo with an idle animation (a stick figure bobbing on balloons).
- Three big buttons: **Host a game**, **Join a game** and **Play solo**.
- **Join** shows a code input (4 letters, auto-uppercased, auto-advancing boxes).
- Opening a link like `hangbuddies.app/ABCD` goes straight to joining that room.

### 2.2 Player setup (shown after Host, Play solo, or a valid Join code)
- **Name:** 1–16 characters. Leading and trailing spaces are trimmed. Names must be unique within a room (case-insensitive). On a clash we ask for a different name.
- **Avatar:** choose from a grid of **12 avatars**. Each is a stick figure with a distinct color plus one accessory (party hat, bow, cap, glasses, crown, mustache, headphones, flower, beanie, bandana, top hat, antenna). Avatars that are **already taken** in the room are greyed out, so each player looks unique.
- Name and avatar are remembered in `localStorage` for next time.
- **Solo** adds a difficulty picker here, then **Start!** goes straight into round 1. There's no lobby.

### 2.3 Lobby
- Shows the room code in large text with **Copy code** and **Copy link** buttons.
- Lists players (avatar, name, a ⭐ for the host (the crown is saved for the winner)) with a `3 / 8` count.
- **Host only:** difficulty picker (Easy / Medium / Hard; default Medium) and a **Start game** button. Start is disabled until at least **2 players** are present.
- Non-hosts see the selected difficulty and "Waiting for host to start…".
- Players can change their name or avatar while in the lobby.

### 2.4 Game (round in progress)
Layout on desktop (≥ 900px wide):

```
┌───────────────────────────────────────────────┬──────────────┐
│ Round 2 / 5          ⏱ 0:47            Medium │  SCOREBOARD  │
│                                               │ 🙂 Jack 1450 │
│            🎈🎈🎈🎈🎈 (balloons)              │ 🙂 Sam   980 │
│                 \|/                           │ 🙂 Ana   720 │
│                  o   ← your stick figure      │ ...          │
│                 /|\                           │              │
│                 / \                           │              │
│ ───────────────────────── ground ─────────    │              │
│                                               │              │
│   Hint: A sticky breakfast topping            │              │
│   _ _ _ _ _ _   _ _ _ _ _                     │              │
│                                               │              │
│   [Q][W][E][R][T][Y][U][I][O][P]              │              │
│    [A][S][D][F][G][H][J][K][L]                │              │
│      [Z][X][C][V][B][N][M]                    │              │
└───────────────────────────────────────────────┴──────────────┘
```

On narrow screens (phones) the scoreboard turns into a compact horizontal strip of avatars and scores at the top. The keyboard stays pinned to the bottom of the screen.

### 2.5 Round summary (about 6 seconds between rounds)
- Reveals the word.
- Shows each player's result for the round: ✅ solved (with time and points earned) or 💥 fell.
- Shows the updated scoreboard, then counts down to the next round.

### 2.6 Final results
- A **podium** for the top 3, with the winner in the center wearing a crown and confetti falling.
- The full ranked list below the podium.
- A **Next game** card with the difficulty picker. Everyone sees it; only the host can change it.
- **Host:** **Play again** starts the next 5 rounds immediately at the chosen difficulty, with scores reset. **Back to lobby** returns everyone to the lobby, for example to wait for more friends.
- **Others:** "Waiting for host…" and a **Leave** button.

### 2.7 Solo mode
- Uses the same game screen. In place of the scoreboard is a **solo panel**: your score, your personal best for this difficulty, and a 5-row recap that fills in as you go (word, points or 💥/⏰).
- The **game over** screen shows the final score (counting up), how many words you solved, **🎉 New personal best!** when you beat it, and the recap. It also has the same **Next game** card (difficulty + Play again) and a **Quit** button.
- Personal bests are kept per difficulty in this browser.
- Refreshing mid-round resumes the game. The round doesn't end just because you briefly disconnected.

---

## 3. Rules

### 3.1 Words and hints
- Each round uses one entry from a curated list: an **answer** (word or phrase) and a **hint** (short clue or category).
- Answers use letters A–Z and spaces. A small set of punctuation (`'`, `-`, `&`, `!`, `?`, `.`, `,`) is allowed and is **shown automatically**. It is never guessed.
- On screen, each letter is a blank tile, spaces are visible gaps, and words never break across lines.
- Every player in a room gets the same 5 words. No word repeats within a room until the whole pool for that difficulty has been used.
- Difficulty also affects the word pool (see 3.3).

### 3.2 Guessing
- Players guess **one letter at a time**, using either the on-screen keyboard or a physical keyboard (A–Z keys).
- Keys that were already guessed are disabled: **green** for a correct guess, **grey/red** for a wrong one. Guessing the same letter twice does nothing.
- **Correct letter:** every instance is revealed with a little pop-in animation.
- **Wrong letter:** one balloon pops (*pop!* sound and a burst). The stick figure sinks a bit lower.
- **All letters revealed** means the player **solved** the word. The stick figure cheers and does a happy float, and their board locks.
- **All balloons popped** means the player **fell**. The figure drops to the ground, dizzy stars circle its head, and the board locks. They score 0 for the round.
- There is no "guess the whole phrase" action. Letters only, as in classic hangman.

### 3.3 Difficulty (chosen by the host before each game: in the lobby or on the results screen)

| Difficulty | Balloons (wrong guesses allowed) | Word pool |
|---|---|---|
| Easy   | 8 | Familiar single words (WALRUS, COLANDER) with category hints |
| Medium | 7 | Phrases and longer words with playful clues |
| Hard   | 6 | Idioms, rare words and vowel-poor traps, with terse clues |

### 3.4 Round timing
- Each round has a **90-second** limit.
- A round ends when **every active player has solved or fallen**, or when the timer runs out.
- When time runs out, anyone who hasn't solved yet gets 0 for that round. Their figure gently drifts off-screen; it doesn't fall.

### 3.5 Scoring
Points reward speed. Points are only awarded for solving.

```
points = 100 + round(900 × timeRemaining / roundDuration)
```

- Solving instantly scores about **1000**. Solving with one second left scores about **110**. Not solving scores **0**.
- `timeRemaining` is measured by the server from when the round started to when the last letter was revealed.
- Leftover balloons do not affect score. Speed is the only factor, which keeps scoring easy to understand.
- **Ties** in the final standings are broken by **total solve time** across all solved rounds (lower wins). If that is also tied, players share the placement.

### 3.6 Scoreboard (always visible)
- Shows every player's avatar, name, and total score, sorted by score.
- During a round, each row also shows a live status icon: 🎈×N (balloons left), ✅ (solved), 💥 (fell), or 🔌 (disconnected).
- Other players' **letters and guesses are never shown**. That would give the answer away.
- When a player's score goes up, the row animates (number count-up, rows slide to their new order).

---

## 4. Rooms, hosts, and connections

- **Private only.** You can only enter a room with its code. There is no public room browser.
- **Room code:** 4 letters taken from an unambiguous alphabet (no `I`, `O`, `L`, etc.), for example `KQFX`.
- **Max 8 players.** A 9th person gets "Room is full".
- **Joining mid-game:** allowed. A late joiner gets a 0 score and starts at the next round. Until then they see the current round as a spectator.
- **Host leaves:** if the host clicks Leave or is removed after disconnecting, the host role passes to the connected player who has been in the room longest.
- **Disconnects:** a player who drops (for example, from refreshing or a network blip) has **60 seconds** to reconnect and resume with their score and board intact. During that time their scoreboard row shows 🔌. If they don't reconnect in time, they are removed. A player who closed their tab can rejoin under the same name to reclaim their spot.
- If everyone leaves, the room is deleted. Idle rooms expire after 30 minutes.
- Mid-game, if only one player is left, the game continues so they can finish. The lobby still requires 2 players to start.

---

## 5. Art and audio direction

- **Style:** stick figures and simple shapes on a soft pastel sky background with a few drifting clouds. Thick rounded strokes. Everything is drawn in SVG, so there are no image assets to manage.
- **Avatars:** the stick figure's body color and accessory make up the avatar. The same figure appears on the play area, the scoreboard, and the podium.
- **Balloons:** a cluster of colorful balloons tied with strings to the figure's hand. They gently bob (idle sway).
- **Key animations:**
  - Balloon pop: the balloon scales up, bursts into confetti, and its string falls.
  - Losing altitude: the figure eases down a step with each pop.
  - Falling: a quick drop, a squash on landing, then dizzy stars.
  - Solving: arms up, a little jump, sparkles.
  - Letter reveal: the tile flips or bounces in.
- **Audio:** short, cute SFX (pop, ding, bonk, fanfare, and a tick in the last 5 seconds), all synthesized in the browser. A mute toggle is always visible, and the setting is remembered. No background music in v1.
- **Accessibility:** colors aren't the only signal (correct and wrong keys also differ by icon or strikethrough), all controls are keyboard-navigable, and we honor `prefers-reduced-motion`.

---

## 6. Out of scope for v1
Public matchmaking, solo mode, accounts, chat, custom word lists, spectator-only mode, and a mobile app wrapper. All of these are reasonable later additions. Custom word lists and in-room emoji reactions are the most likely next features.
