# Hangbuddies 🎈

Hangman with balloons. Host a private room, share the 4-letter code, and race your friends (2–8 players) to guess the word before your balloons go pop. Or play solo and chase your personal best.

- **Design:** [docs/game-design.md](docs/game-design.md)
- **Tech plan:** [docs/technical-plan.md](docs/technical-plan.md)

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:5173. To play against yourself, open a second **tab** (each tab is its own player) and join with the code. Set `ALLOW_SOLO=1` to start a game with only one player:

```bash
ALLOW_SOLO=1 npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (5173) and game server (3001) with hot reload |
| `npm test` | Unit and socket integration tests |
| `npm run typecheck` | TypeScript check |
| `npm run words:check` | Validate the word list |
| `npm run build` | Build the client to `dist/client` and the server to `dist/server` |
| `npm start` | Run the production server (serves the built client too) |

## Adding words

Edit [src/server/data/words.json](src/server/data/words.json). Add `["ANSWER", "Hint"]` pairs under `easy`, `medium` or `hard`, then run `npm run words:check`.

## Deploying to Render

1. Push this repo to GitHub.
2. In [Render](https://dashboard.render.com), choose **New → Blueprint** and select the repo. [render.yaml](render.yaml) sets up a Starter web service (about $7/mo, always on). It needs no environment variables.
3. Every push to `main` redeploys. Deploys end any games in progress, because rooms live in memory, so avoid deploying mid-game.

Keep the service at **one instance**.
