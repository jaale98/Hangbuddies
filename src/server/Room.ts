import { randomBytes } from 'node:crypto';
import type { Server } from 'socket.io';
import { BALLOONS, MAX_PLAYERS, ROUNDS_PER_GAME } from '../shared/constants';
import type { ClientToServer, ErrorCode, ServerToClient } from '../shared/protocol';
import type {
  Difficulty,
  GuessOutcome,
  Phase,
  PlayerView,
  PublicRoomState,
  RankingEntry,
  RoundSummary,
} from '../shared/types';
import { applyGuess, maskAnswer, newRoundState, rankPlayers, type PlayerRoundState } from './engine';
import { pickWords, type WordEntry } from './words';

export type IO = Server<ClientToServer, ServerToClient>;

export interface RoomOptions {
  roundMs: number;
  summaryMs: number;
  graceMs: number;
  minPlayers: number;
}

export interface Player {
  id: string;
  token: string;
  socketId: string | null;
  name: string;
  avatarId: string;
  joinedAt: number;
  connected: boolean;
  graceTimer: NodeJS.Timeout | null;
  score: number;
  totalSolveMs: number;
  activeFromRound: number;
}

export class GameError extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

const newId = (bytes: number) => randomBytes(bytes).toString('base64url');

export class Room {
  hostId = '';
  players = new Map<string, Player>(); // insertion order = seniority
  phase: Phase = 'lobby';
  difficulty: Difficulty = 'medium';
  roundIndex = 0;
  words: WordEntry[] = [];
  usedWordIds = new Set<string>();
  roundStartedAt = 0;
  roundEndsAt = 0;
  summaryEndsAt = 0;
  roundStates = new Map<string, PlayerRoundState>();
  summary: RoundSummary | null = null;
  history: RoundSummary[] = []; // finished rounds of the current game
  ranking: RankingEntry[] | null = null;
  lastActivity = Date.now();
  private timer: NodeJS.Timeout | null = null;
  private destroyed = false;

  constructor(
    readonly code: string,
    private io: IO,
    private opts: RoomOptions,
    private onEmpty: (room: Room) => void,
    /** Solo rooms have exactly one player and can't be joined. */
    readonly solo = false,
  ) {}

  get minPlayers() {
    return this.solo ? 1 : this.opts.minPlayers;
  }

  get maxBalloons() {
    return BALLOONS[this.difficulty];
  }

  private get word(): WordEntry | undefined {
    return this.words[this.roundIndex];
  }

  touch() {
    this.lastActivity = Date.now();
  }

  // ---------- players ----------

  checkNameAndAvatar(name: string, avatarId: string, exceptId?: string) {
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue;
      if (p.name.toLowerCase() === name.toLowerCase()) throw new GameError('NAME_TAKEN');
      if (p.avatarId === avatarId) throw new GameError('AVATAR_TAKEN');
    }
  }

  addPlayer(name: string, avatarId: string): Player {
    if (this.players.size >= (this.solo ? 1 : MAX_PLAYERS)) throw new GameError('FULL');
    this.checkNameAndAvatar(name, avatarId);
    const midGame = this.phase === 'round' || this.phase === 'roundSummary';
    const player: Player = {
      id: newId(9),
      token: newId(24),
      socketId: null,
      name,
      avatarId,
      joinedAt: Date.now(),
      connected: false,
      graceTimer: null,
      score: 0,
      totalSolveMs: 0,
      activeFromRound: midGame ? this.roundIndex + 1 : 0,
    };
    this.players.set(player.id, player);
    if (this.phase === 'round') this.roundStates.set(player.id, newRoundState('spectating'));
    if (!this.hostId) this.hostId = player.id;
    this.touch();
    return player;
  }

  findByToken(token: string): Player | undefined {
    for (const p of this.players.values()) if (p.token === token) return p;
    return undefined;
  }

  /** Bind a socket to a player. Returns the socket id it replaced, if any. */
  attachSocket(player: Player, socketId: string): string | null {
    const previous = player.socketId !== socketId ? player.socketId : null;
    player.socketId = socketId;
    player.connected = true;
    if (player.graceTimer) clearTimeout(player.graceTimer);
    player.graceTimer = null;
    this.touch();
    return previous;
  }

  detachSocket(player: Player) {
    player.connected = false;
    player.socketId = null;
    if (player.graceTimer) clearTimeout(player.graceTimer);
    player.graceTimer = setTimeout(() => this.removePlayer(player.id), this.opts.graceMs);
    this.broadcast();
    this.maybeEndRound();
  }

  removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;
    if (player.graceTimer) clearTimeout(player.graceTimer);
    this.players.delete(playerId);
    this.roundStates.delete(playerId);
    if (this.players.size === 0) {
      this.destroy();
      this.onEmpty(this);
      return;
    }
    if (this.hostId === playerId) {
      const all = [...this.players.values()];
      this.hostId = (all.find((p) => p.connected) ?? all[0]).id;
    }
    this.touch();
    this.broadcast();
    this.maybeEndRound();
  }

  updatePlayer(playerId: string, changes: { name?: string; avatarId?: string }) {
    const player = this.mustGet(playerId);
    if (this.phase !== 'lobby' && this.phase !== 'results') throw new GameError('BAD_PHASE');
    const name = changes.name ?? player.name;
    const avatarId = changes.avatarId ?? player.avatarId;
    this.checkNameAndAvatar(name, avatarId, playerId);
    player.name = name;
    player.avatarId = avatarId;
    this.touch();
    this.broadcast();
  }

  private mustGet(playerId: string): Player {
    const p = this.players.get(playerId);
    if (!p) throw new GameError('NOT_IN_ROOM');
    return p;
  }

  private mustBeHost(playerId: string) {
    if (playerId !== this.hostId) throw new GameError('NOT_HOST');
  }

  // ---------- game flow ----------

  /** Allowed before a game and between games (on the results screen). */
  setDifficulty(playerId: string, difficulty: Difficulty) {
    this.mustBeHost(playerId);
    if (this.phase !== 'lobby' && this.phase !== 'results') throw new GameError('BAD_PHASE');
    this.difficulty = difficulty;
    this.touch();
    this.broadcast();
  }

  /** Start a game from the lobby, or straight from the results screen ("Play again"). */
  startGame(playerId: string) {
    this.mustBeHost(playerId);
    if (this.phase !== 'lobby' && this.phase !== 'results') throw new GameError('BAD_PHASE');
    const connected = [...this.players.values()].filter((p) => p.connected).length;
    if (connected < this.minPlayers) throw new GameError('NOT_ENOUGH_PLAYERS');
    for (const p of this.players.values()) {
      p.score = 0;
      p.totalSolveMs = 0;
      p.activeFromRound = 0;
    }
    this.words = pickWords(this.difficulty, ROUNDS_PER_GAME, this.usedWordIds);
    this.ranking = null;
    this.history = [];
    this.touch();
    this.startRound(0);
  }

  private startRound(index: number) {
    this.clearTimer();
    this.phase = 'round';
    this.roundIndex = index;
    this.summary = null;
    this.roundStartedAt = Date.now();
    this.roundEndsAt = this.roundStartedAt + this.opts.roundMs;
    this.roundStates.clear();
    for (const p of this.players.values()) {
      this.roundStates.set(p.id, newRoundState(p.activeFromRound <= index ? 'playing' : 'spectating'));
    }
    this.timer = setTimeout(() => this.endRound(), this.opts.roundMs);
    this.broadcast();
    this.sendAllViews();
  }

  guess(playerId: string, letter: string, round: number): { outcome: GuessOutcome; view: PlayerView } {
    const player = this.mustGet(playerId);
    const state = this.roundStates.get(playerId);
    const word = this.word;
    const now = Date.now();
    if (this.phase !== 'round' || round !== this.roundIndex || !state || !word || now > this.roundEndsAt) {
      throw new GameError('BAD_PHASE');
    }
    const result = applyGuess(state, word.answer, letter, this.maxBalloons, now - this.roundStartedAt, this.opts.roundMs);
    const outcome: GuessOutcome =
      result.kind === 'ignored'
        ? { letter, correct: word.answer.includes(letter), solved: false, fell: false, points: 0 }
        : { letter, correct: result.correct, solved: result.solved, fell: result.fell, points: result.points };
    if (result.kind === 'guessed') {
      if (result.solved) {
        player.score += result.points;
        player.totalSolveMs += state.solvedAtMs ?? 0;
      }
      this.touch();
      this.broadcast();
      this.maybeEndRound();
    }
    return { outcome, view: this.viewFor(playerId)! };
  }

  private maybeEndRound() {
    if (this.phase !== 'round') return;
    const players = [...this.players.values()];
    // If everyone dropped (e.g. a solo player refreshing), wait for them or the timer.
    if (!players.some((p) => p.connected)) return;
    for (const [id, s] of this.roundStates) {
      if (s.status === 'playing' && this.players.get(id)?.connected) return;
    }
    this.endRound();
  }

  private endRound() {
    if (this.phase !== 'round' || !this.word) return;
    this.clearTimer();
    for (const s of this.roundStates.values()) if (s.status === 'playing') s.status = 'timeout';
    this.summary = {
      roundIndex: this.roundIndex,
      answer: this.word.answer,
      hint: this.word.hint,
      results: [...this.roundStates].map(([playerId, s]) => ({
        playerId,
        status: s.status,
        points: s.points,
        solveMs: s.solvedAtMs,
      })),
    };
    this.history.push(this.summary);
    this.phase = 'roundSummary';
    this.summaryEndsAt = Date.now() + this.opts.summaryMs;
    this.timer = setTimeout(() => this.afterSummary(), this.opts.summaryMs);
    this.broadcast();
    this.sendAllViews();
  }

  private afterSummary() {
    if (this.roundIndex + 1 < ROUNDS_PER_GAME) this.startRound(this.roundIndex + 1);
    else this.showResults();
  }

  private showResults() {
    this.clearTimer();
    this.phase = 'results';
    this.summary = null;
    this.roundStates.clear();
    this.ranking = rankPlayers([...this.players.values()]).map((p) => ({
      playerId: p.id,
      name: p.name,
      avatarId: p.avatarId,
      score: p.score,
      place: p.place,
    }));
    this.broadcast();
    this.sendAllViews();
  }

  playAgain(playerId: string) {
    this.mustBeHost(playerId);
    if (this.phase !== 'results') throw new GameError('BAD_PHASE');
    this.phase = 'lobby';
    this.ranking = null;
    this.history = [];
    this.roundIndex = 0;
    for (const p of this.players.values()) {
      p.score = 0;
      p.totalSolveMs = 0;
      p.activeFromRound = 0;
    }
    this.touch();
    this.broadcast();
  }

  // ---------- views ----------

  publicState(): PublicRoomState {
    const inRound = this.phase === 'round' || this.phase === 'roundSummary';
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      difficulty: this.difficulty,
      solo: this.solo,
      minPlayers: this.minPlayers,
      maxPlayers: MAX_PLAYERS,
      totalRounds: ROUNDS_PER_GAME,
      roundIndex: this.roundIndex,
      roundEndsAt: this.roundEndsAt,
      summaryEndsAt: this.summaryEndsAt,
      maxBalloons: this.maxBalloons,
      hint: inRound ? (this.word?.hint ?? null) : null,
      players: [...this.players.values()].map((p) => {
        const s = inRound ? this.roundStates.get(p.id) : undefined;
        return {
          id: p.id,
          name: p.name,
          avatarId: p.avatarId,
          score: p.score,
          connected: p.connected,
          roundStatus: s?.status ?? null,
          balloonsLeft: s ? this.maxBalloons - s.wrong : null,
          pointsThisRound: s?.points ?? 0,
        };
      }),
      summary: this.summary,
      history: this.history,
      ranking: this.ranking,
    };
  }

  /** The player's private board. Only reveals the full answer once the round is over. */
  viewFor(playerId: string): PlayerView | null {
    const word = this.word;
    if ((this.phase !== 'round' && this.phase !== 'roundSummary') || !word) return null;
    const s = this.roundStates.get(playerId) ?? newRoundState('spectating');
    const guessed: Record<string, boolean> = {};
    for (const l of s.guessed) guessed[l] = word.answer.includes(l);
    return {
      roundIndex: this.roundIndex,
      hint: word.hint,
      words: maskAnswer(word.answer, s.guessed, this.phase === 'roundSummary'),
      guessed,
      balloonsLeft: this.maxBalloons - s.wrong,
      maxBalloons: this.maxBalloons,
      status: s.status,
      points: s.points,
    };
  }

  broadcast() {
    if (this.destroyed) return;
    this.io.to(this.code).emit('room:state', this.publicState());
  }

  sendView(player: Player) {
    if (player.socketId) this.io.to(player.socketId).emit('round:you', this.viewFor(player.id));
  }

  private sendAllViews() {
    for (const p of this.players.values()) this.sendView(p);
  }

  // ---------- lifecycle ----------

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  destroy() {
    this.destroyed = true;
    this.clearTimer();
    for (const p of this.players.values()) if (p.graceTimer) clearTimeout(p.graceTimer);
  }
}
