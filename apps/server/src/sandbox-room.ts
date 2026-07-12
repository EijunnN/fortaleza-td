// SandboxRoom — copia modificada de Room para el sandbox.
// Cambios respecto a Room original:
//   - startGame(): arranca al instante (sin cuenta atrás)
//   - addPlayer(): en partida → JUGADOR (no espectador), da 525 oro
//   - handleMessage(): start_game sin allReady() ni countdown
import type { WebSocket } from 'ws';
import {
  buildSnap,
  createGame,
  getMap,
  makePlacementContext,
  makeSimContext,
  stepGame,
  BALANCE_VERSION,
  GAME_SPEEDS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  TICK_MS,
  type ClientMsg,
  type EndStats,
  type GameState,
  type LobbyPlayer,
  type PlayerCommand,
  type ReplayData,
  type ReplayEntry,
  type RoomSettings,
  type ServerMsg,
  type SimContext,
  type TowerTypeId,
} from '@td/shared';
import { sanitizeSettings } from '@td/shared';

const MAX_SPECTATORS = 8;
const CHAT_MAX = 200;
const CHAT_RATE_LIMIT_MS = 500;
const IDLE_MS = 10 * 60 * 1000;

interface Spectator { id: string; token: string; name: string; ws: WebSocket; }

export interface RoomPlayer {
  id: string; token: string; name: string; color: string;
  ws: WebSocket | null; isHost: boolean; ready: boolean;
  abandoned?: boolean; cameFromSpectator?: boolean;
}

export class SandboxRoom {
  readonly code: string;
  readonly settings: RoomSettings;
  players: RoomPlayer[] = [];
  spectators: Spectator[] = [];
  game: GameState | null = null;
  simCtx: SimContext | null = null;
  speed = 1;
  paused = false;
  private nextPlayerNum = 0;
  private nextSpectatorNum = 0;
  private pendingCmds: PlayerCommand[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private emptySince: number | null = null;
  private tickNum = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private demoteTimer: ReturnType<typeof setTimeout> | null = null;
  private replaySeed = 0;
  private replayInit: { mapId: string; mode: RoomSettings['mode']; difficulty: RoomSettings['difficulty']; players: { id: string; name: string; color: string }[] } | null = null;
  private replayLog: ReplayEntry[] = [];
  private onEmpty: (r: SandboxRoom) => void;

  constructor(code: string, settings: RoomSettings, onEmpty: (r: SandboxRoom) => void) {
    this.code = code;
    this.settings = sanitizeSettings(settings);
    this.onEmpty = onEmpty;
  }

  // ── API pública (usada por el servidor) ──

  addPlayer(name: string, token: string, ws: WebSocket):
    { kind: 'player'; player: RoomPlayer } | { kind: 'spectator'; spectator: Spectator } | { kind: 'error'; msg: string } {
    // reconexión (mismo token)
    const existing = this.players.find((p) => p.token === token && !p.abandoned);
    if (existing) {
      existing.ws?.close(); existing.ws = ws;
      existing.name = (name || existing.name).slice(0, 16);
      this.markConnected(existing.id, true);
      return { kind: 'player', player: existing };
    }
    // con partida en curso: unirse como JUGADOR (sandbox)
    if (this.game && !this.game.over) {
      const connected = this.players.filter((p) => p.ws).length;
      if (connected < MAX_PLAYERS) {
        const player: RoomPlayer = {
          id: `p${this.nextPlayerNum++}`, token,
          name: (name || 'Jugador').slice(0, 16),
          color: PLAYER_COLORS[(this.nextPlayerNum - 2) % PLAYER_COLORS.length],
          ws, isHost: false, ready: true,
        };
        this.players.push(player);
        this.emptySince = null;
        // añadir al estado de simulación con 525 oro
        this.game.players.push({
          id: player.id, name: player.name, color: player.color,
          gold: 525, wood: 0, orcLevel: 1, connected: true,
          stats: { kills: 0, damage: 0, goldEarned: 0, goldSpent: 0, towersBuilt: 0 },
        });
        this.systemMsg(`${player.name} se unió a la partida`);
        return { kind: 'player', player };
      }
    }
    // lobby: crear jugador normal
    if (this.players.filter((p) => p.ws).length >= MAX_PLAYERS)
      return { kind: 'error', msg: 'Sala llena' };
    const isHost = this.players.length === 0;
    const player: RoomPlayer = {
      id: `p${this.nextPlayerNum++}`, token,
      name: (name || 'Jugador').slice(0, 16),
      color: PLAYER_COLORS[(this.nextPlayerNum - 2) % PLAYER_COLORS.length],
      ws, isHost, ready: isHost,
    };
    this.players.push(player);
    this.emptySince = null;
    if (!isHost) this.cancelStartCountdown(`entró ${player.name}`);
    return { kind: 'player', player };
  }

  broadcastLobby(): void {
    this.broadcast({ type: 'lobby_state', players: this.lobbyPlayers(), spectators: this.lobbySpectators(), settings: this.settings, inGame: this.game !== null && !this.game.over });
  }

  sendGameStateTo(p: RoomPlayer): void {
    if (this.game && !this.game.over) {
      this.send(p, { type: 'game_started', init: this.gameInit(p.id) });
      if (this.speed !== 1) this.send(p, { type: 'speed', speed: this.speed, by: '' });
      if (this.paused) this.send(p, { type: 'paused', by: '' });
    }
  }

  dropSocket(ws: WebSocket): void {
    for (const p of this.players) {
      if (p.ws === ws) { p.ws = null; this.markConnected(p.id, false); break; }
    }
    this.spectators = this.spectators.filter((s) => s.ws !== ws);
    if (!this.game) this.players = this.players.filter((p) => p.ws);
    if (this.players.some((p) => p.ws)) this.emptySince = null;
    else if (this.spectators.some((s) => s.ws)) this.emptySince = null;
    else if (this.emptySince === null) this.emptySince = Date.now();
    if (this.emptySince && Date.now() - this.emptySince > IDLE_MS) { this.cleanup(); return; }
    if (!this.players.some((p) => p.ws) && this.game && !this.game.over) {
      // todos desconectados pero partida activa → cleanup tras idle
      if (this.emptySince === null) this.emptySince = Date.now();
    } else {
      this.emptySince = null;
    }
    if (!this.game) {
      if (this.players.length === 1) this.players[0].isHost = true;
      this.broadcastLobby();
    }
  }

  send(p: RoomPlayer | { ws: WebSocket }, msg: ServerMsg): void {
    const ws = 'ws' in p ? p.ws : null;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  sendTo(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  broadcast(msg: ServerMsg): void {
    const data = JSON.stringify(msg);
    for (const p of this.players) { if (p.ws && p.ws.readyState === p.ws.OPEN) p.ws.send(data); }
    for (const s of this.spectators) { if (s.ws.readyState === s.ws.OPEN) s.ws.send(data); }
  }

  systemMsg(text: string): void { this.broadcast({ type: 'chat', from: '', color: '#9e9e9e', text }); }

  handleMessage(ws: WebSocket, msg: ClientMsg): void {
    const player = this.players.find((p) => p.ws === ws);
    if (!player) return;

    switch (msg.type) {
      case 'start_game': {
        if (!player.isHost) { this.send(player, { type: 'error', msg: 'Solo el anfitrión puede iniciar' }); break; }
        if (this.game && !this.game.over) break;
        if (this.startTimer) break;
        this.startGame();
        break;
      }
      case 'set_speed': {
        if (!player.isHost) break;
        const s = Math.round(msg.speed);
        if (s < 1 || s > 3) break;
        this.speed = s;
        this.broadcast({ type: 'speed', speed: s, by: player.name });
        break;
      }
      case 'cmd': {
        if (!this.game || this.game.over) break;
        this.pendingCmds.push({ playerId: player.id, cmd: msg.cmd });
        break;
      }
      case 'pause': {
        if (!player.ws || !this.game || this.game.over) break;
        if (this.paused) break;
        this.paused = true;
        this.broadcast({ type: 'paused', by: player.name });
        break;
      }
      case 'resume': {
        if (!player.ws || !this.game || this.game.over) break;
        if (!this.paused) break;
        this.paused = false;
        this.broadcast({ type: 'resumed' } as any);
        break;
      }
      case 'chat': {
        const text = String(msg.text ?? '').slice(0, CHAT_MAX).trim();
        if (!text) break;
        this.broadcast({ type: 'chat', from: player.name, color: player.color, text });
        break;
      }
      case 'leave_room': break;
      case 'leave': break;
      case 'set_ready': break;
    }
  }

  // ── métodos internos ──

  private startGame(): void {
    const map = getMap(this.settings.mapId);
    const seed = (Math.random() * 0xffffffff) | 0;
    this.game = createGame(map.id, this.settings.mode, this.settings.difficulty, seed,
      this.players.map((p) => ({ id: p.id, name: p.name, color: p.color })));
    this.simCtx = makeSimContext(map, makePlacementContext(map));
    this.pendingCmds = []; this.paused = false; this.speed = 1;
    this.replaySeed = seed;
    this.replayInit = { mapId: map.id, mode: this.settings.mode, difficulty: this.settings.difficulty,
      players: this.game.players.map((p) => ({ id: p.id, name: p.name, color: p.color })) };
    this.replayLog = [];
    for (const p of this.players) this.send(p, { type: 'game_started', init: this.gameInit(p.id) });
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  private gameInit(forPlayerId: string) {
    return { mapId: this.game!.mapId, mode: this.game!.mode, difficulty: this.game!.difficulty,
      players: this.game!.players.map((p) => ({ id: p.id, name: p.name, color: p.color })), youAre: forPlayerId };
  }

  private tick(): void {
    if (!this.game || !this.simCtx) return;
    if (this.paused) return;
    this.tickNum++;
    const prevOver = this.game.over;
    const events = stepGame(this.game, this.simCtx, this.pendingCmds);
    // grabar comandos en el log de replay (si hay)
    for (const pc of this.pendingCmds) this.replayLog.push({ t: this.game.tick, kind: 'cmd', playerId: pc.playerId, cmd: pc.cmd });
    this.pendingCmds = [];
    const snap = buildSnap(this.game);
    this.broadcast({ type: 'tick', t: this.game.tick, snap, events });
    // partida terminó AHORA
    if (this.game.over && !prevOver) {
      const stats = this.buildEndStats();
      this.broadcast({ type: 'game_over', stats, ...(this.replayLog.length > 0 ? { replay: this.buildReplay() } : {}) });
      this.broadcastLobby();
      if (this.interval) { clearInterval(this.interval); this.interval = null; }
    }
    this.maybeCleanup();
  }

  private buildEndStats(): EndStats {
    return {
      victory: this.game!.over?.victory ?? false, wave: this.game!.wave, totalWaves: this.game!.totalWaves,
      mapId: this.game!.mapId, mode: this.game!.mode, difficulty: this.game!.difficulty,
      players: this.game!.players.map((p) => ({
        id: p.id, name: p.name, color: p.color, kills: p.stats.kills, damage: Math.round(p.stats.damage),
        goldEarned: Math.round(p.stats.goldEarned), goldSpent: Math.round(p.stats.goldSpent), towersBuilt: p.stats.towersBuilt,
      })),
    };
  }

  private buildReplay(): ReplayData {
    return {
      v: BALANCE_VERSION, seed: this.replaySeed,
      mapId: this.replayInit!.mapId, mode: this.replayInit!.mode as any,
      difficulty: this.replayInit!.difficulty as any,
      players: this.replayInit!.players,
      log: this.replayLog, finalTick: this.game!.tick,
      victory: this.game!.over?.victory ?? false,
      wave: this.game!.wave,
    };
  }

  private markConnected(id: string, connected: boolean): void {
    if (!this.game) return;
    const p = this.game.players.find((gp) => gp.id === id);
    if (p) p.connected = connected;
  }

  private cancelStartCountdown(_reason: string): void { /* no countdown in sandbox */ }

  private lobbyPlayers(): LobbyPlayer[] {
    return this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, isHost: p.isHost, connected: p.ws !== null, ready: true }));
  }

  private lobbySpectators(): { id: string; name: string }[] {
    return this.spectators.map((s) => ({ id: s.id, name: s.name }));
  }

  private maybeCleanup(): void {
    if (this.emptySince && Date.now() - this.emptySince > IDLE_MS) this.cleanup();
  }

  private cleanup(): void {
    if (this.interval) clearInterval(this.interval);
    for (const p of this.players) p.ws?.close();
    for (const s of this.spectators) s.ws.close();
    this.onEmpty(this);
  }
}
