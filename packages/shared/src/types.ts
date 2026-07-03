export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'classic' | 'endless';
export type TargetMode = 'first' | 'last' | 'strong' | 'weak' | 'near';

export type TowerTypeId =
  | 'archer'
  | 'cannon'
  | 'frost'
  | 'poison'
  | 'tesla'
  | 'sniper'
  | 'mortar'
  | 'bank';

export type EnemyTypeId =
  | 'goblin'
  | 'runner'
  | 'brute'
  | 'bat'
  | 'armored'
  | 'shaman'
  | 'larva'
  | 'troll'
  | 'slime'
  | 'slimelet'
  | 'ghost'
  | 'golem';

// Afijos de enemigos élite. Cada uno modifica el estado del enemigo (ver step.ts).
export type AffixId =
  | 'swift' // veloz
  | 'armored' // coraza
  | 'regen' // regenerador
  | 'vampiric' // vampírico (cura a los cercanos)
  | 'elusive' // escurridizo (esquiva)
  | 'frostward' // gélido (resiste el hielo)
  | 'explosive'; // explosivo (suelta crías al morir)

export interface Vec {
  x: number;
  y: number;
}

// ---------- Definiciones (balance) ----------

export interface TowerLevelDef {
  cost: number; // costo incremental de este nivel
  damage: number;
  range: number; // celdas
  cooldown: number; // segundos
  projectileSpeed?: number; // celdas/s; ausente = disparo instantáneo
  splash?: number; // radio en celdas
  slow?: { factor: number; duration: number }; // factor multiplica velocidad, duración en s
  poison?: { dps: number; duration: number };
  chain?: { targets: number; falloff: number };
  minRange?: number; // celdas (mortero)
  incomePerWave?: number; // oro al final de cada oleada (mina)
  pierceArmor?: boolean;
  // efectos exclusivos de las especializaciones (nivel 4):
  shots?: number; // dispara a varios objetivos a la vez
  execute?: number; // remata enemigos por debajo de esta fracción de vida (0..1)
  incomeToAll?: boolean; // el ingreso va a TODOS los jugadores
  slowAura?: { factor: number; radius: number }; // ralentiza pasivamente a su alrededor (no dispara)
  targetsAirOverride?: boolean; // sobrescribe si la torre alcanza aire
}

// Especialización: se elige una de dos al llegar al nivel máximo. Es un bloque
// de stats completo con identidad propia (nombre, visual y mecánica).
export interface TowerSpecDef extends TowerLevelDef {
  key: string; // id estable para el render
  name: string;
  desc: string;
}

export interface TowerDef {
  id: TowerTypeId;
  name: string;
  desc: string;
  color: string;
  hotkey: string;
  targetsAir: boolean;
  targetsGround: boolean;
  projectileKind: 'bullet' | 'shell' | 'bomb' | 'none' | 'beam' | 'snipe';
  levels: [TowerLevelDef, TowerLevelDef, TowerLevelDef];
  specs: [TowerSpecDef, TowerSpecDef]; // ramas A/B al máximo nivel
}

export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  hp: number;
  speed: number; // celdas/s
  bounty: number;
  armor: number; // reducción plana por golpe
  radius: number; // celdas
  livesCost: number;
  flying: boolean;
  color: string;
  regen?: number; // hp/s
  healAura?: { radius: number; hps: number };
  dodge?: number; // 0..1 prob. de esquivar proyectiles
  spawnOnDeath?: { type: EnemyTypeId; count: number };
  boss?: boolean;
  cost: number; // costo de presupuesto para el generador de oleadas
  minWave: number; // oleada mínima en la que puede aparecer
}

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  gridW: number;
  gridH: number;
  // cada camino es una lista de waypoints [col, fila] (esquinas), segmentos alineados a los ejes
  paths: [number, number][][];
  blocked: [number, number][]; // celdas decorativas no construibles
  theme: 'grass' | 'desert' | 'snow' | 'volcano' | 'crystal';
}

// ---------- Estado de partida (runtime, vive en el servidor) ----------

export interface EnemyState {
  id: number;
  type: EnemyTypeId;
  x: number; // celdas (centro)
  y: number;
  hp: number;
  maxHp: number;
  pathIdx: number;
  wpIdx: number; // índice del próximo waypoint
  travelled: number; // distancia recorrida en celdas
  slowFactor: number; // 1 = sin slow
  slowUntil: number; // tick
  poisonDps: number;
  poisonUntil: number; // tick
  poisonSrc: number; // towerId que aplicó el veneno
  bountyMult: number;
  // --- élite y afijos (0/1/vacío en enemigos normales) ---
  elite: boolean;
  affixes: AffixId[];
  speedMult: number; // multiplicador de velocidad (1 = normal)
  armorBonus: number; // armadura extra plana
  regenBonus: number; // regeneración extra (hp/s)
  dodgeBonus: number; // esquiva extra (0..1)
  slowResist: number; // resistencia al hielo (0 = ninguna, 1 = inmune)
  radiusMult: number; // tamaño visual y de hitbox
  auraRadius: number; // aura de curación a aliados (vampírico)
  auraHps: number;
  deathSpawn: number; // crías que suelta al morir (explosivo)
}

export interface TowerState {
  id: number;
  type: TowerTypeId;
  cx: number; // celda (entera)
  cy: number;
  level: number; // 1..3
  spec: number; // -1 sin especializar, 0/1 rama elegida al máximo nivel
  owner: string; // playerId
  cooldownLeft: number; // ticks
  targetMode: TargetMode;
  invested: number; // oro total gastado (para venta)
  kills: number;
  damage: number;
}

export interface ProjectileState {
  id: number;
  kind: 'bullet' | 'shell' | 'bomb';
  x: number;
  y: number;
  targetId: number; // enemigo perseguido (bomb: 0, va a punto fijo)
  tx: number;
  ty: number;
  speed: number; // celdas/tick
  towerId: number;
  owner: string;
  damage: number;
  splash: number;
  slow?: { factor: number; durationTicks: number };
  poison?: { dps: number; durationTicks: number };
  pierceArmor: boolean;
  execute: number; // remata por debajo de esta fracción de vida (0 = nunca)
  color: string;
  groundOnly: boolean;
}

export interface PlayerStats {
  kills: number;
  damage: number;
  goldEarned: number;
  goldSpent: number;
  towersBuilt: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  gold: number;
  connected: boolean;
  stats: PlayerStats;
}

export interface SpawnEntry {
  type: EnemyTypeId;
  delay: number; // ticks después del spawn anterior
  pathIdx: number;
  elite?: boolean;
  affixes?: AffixId[];
}

export interface WaveComp {
  type: EnemyTypeId;
  count: number;
}

export interface GameState {
  tick: number;
  mapId: string;
  mode: GameMode;
  difficulty: Difficulty;
  rng: number; // estado del RNG (mulberry32)
  lives: number;
  maxLives: number;
  wave: number; // oleada actual (0 = aún no empieza la primera)
  totalWaves: number; // 0 = infinito
  waveState: 'interlude' | 'active';
  interludeLeft: number; // ticks
  nextWaveComp: WaveComp[]; // vista previa de la próxima oleada
  pendingWave: SpawnEntry[] | null; // oleada ya generada, esperando el fin del interludio
  pendingBoss: boolean;
  spawnQueue: SpawnEntry[];
  spawnCooldown: number; // ticks hasta el próximo spawn
  enemies: EnemyState[];
  towers: TowerState[];
  projectiles: ProjectileState[];
  players: PlayerState[];
  nextId: number;
  over: null | { victory: boolean };
}

// ---------- Comandos (cliente -> sim) ----------

export type Command =
  | { kind: 'place'; towerType: TowerTypeId; cx: number; cy: number }
  | { kind: 'upgrade'; towerId: number }
  | { kind: 'specialize'; towerId: number; spec: number }
  | { kind: 'sell'; towerId: number }
  | { kind: 'target'; towerId: number; mode: TargetMode }
  | { kind: 'call_wave' };

export interface PlayerCommand {
  playerId: string;
  cmd: Command;
}

// ---------- Eventos (sim -> clientes, efímeros por tick) ----------

export type GameEvent =
  | { e: 'shot'; x: number; y: number; tx: number; ty: number; kind: 'beam' | 'snipe'; color: string }
  | { e: 'chain'; pts: [number, number][]; color: string }
  | { e: 'hit'; x: number; y: number; r: number; kind: 'splash' | 'impact' | 'poison' | 'frost' }
  | { e: 'death'; x: number; y: number; type: EnemyTypeId; bounty: number; killer: string; elite: boolean }
  | { e: 'miss'; x: number; y: number }
  | { e: 'leak'; lives: number; type: EnemyTypeId }
  | { e: 'wave_start'; wave: number; comp: WaveComp[] }
  | { e: 'wave_end'; wave: number; bonus: number }
  | { e: 'income'; playerId: string; amount: number; x: number; y: number }
  | { e: 'place'; x: number; y: number; towerType: TowerTypeId }
  | { e: 'upgrade'; x: number; y: number; level: number }
  | { e: 'specialize'; x: number; y: number; towerType: TowerTypeId; spec: number; name: string }
  | { e: 'sell'; x: number; y: number; refund: number }
  | { e: 'reject'; playerId: string; reason: string }
  | { e: 'boss'; name: string }
  | { e: 'gameover'; victory: boolean }
  | { e: 'sys'; msg: string };
