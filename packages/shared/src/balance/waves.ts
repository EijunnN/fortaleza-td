import type { AffixId, Difficulty, EnemyTypeId, SpawnEntry, WaveComp } from '../types.js';
import { ENEMIES } from './enemies.js';
import { AFFIX_ORDER } from './affixes.js';
import {
  DIFF_HP_MULT,
  ELITE_MIN_WAVE,
  ELITE_TWO_AFFIX_WAVE,
  HP_PER_EXTRA_PLAYER,
  TICK_RATE,
} from '../constants.js';
import { rand, pick } from '../rng.js';

// Multiplicador de HP según oleada, dificultad y cantidad de jugadores.
export function waveHpMult(wave: number, difficulty: Difficulty, playerCount: number): number {
  const base = 1 + 0.11 * (wave - 1);
  const late = wave > 20 ? Math.pow(1.13, wave - 20) : 1;
  const players = 1 + HP_PER_EXTRA_PLAYER * (playerCount - 1);
  return base * late * DIFF_HP_MULT[difficulty] * players;
}

export function waveBountyMult(wave: number): number {
  return 1 + 0.03 * (wave - 1);
}

// Presupuesto de la oleada: cuánto "vale" en enemigos.
function waveBudget(wave: number, playerCount: number): number {
  const players = 1 + 0.3 * (playerCount - 1);
  return Math.round((18 + wave * 9 + Math.pow(wave, 1.6)) * players);
}

interface RngState {
  rng: number;
}

// Tipos disponibles según la oleada (sin jefes ni spawns derivados).
function pool(wave: number): EnemyTypeId[] {
  const all: EnemyTypeId[] = [
    'goblin',
    'runner',
    'larva',
    'bat',
    'brute',
    'armored',
    'slime',
    'shaman',
    'ghost',
    'troll',
  ];
  return all.filter((t) => ENEMIES[t].minWave <= wave);
}

export interface GeneratedWave {
  entries: SpawnEntry[];
  comp: WaveComp[];
  hasBoss: boolean;
}

// Genera la oleada `wave` para un mapa con `pathCount` caminos.
export function generateWave(
  state: RngState,
  wave: number,
  playerCount: number,
  pathCount: number,
): GeneratedWave {
  const picks: EnemyTypeId[] = [];
  let budget = waveBudget(wave, playerCount);
  const hasBoss = wave % 10 === 0;

  if (hasBoss) {
    // El jefe consume gran parte del presupuesto; el resto es escolta.
    const bosses = Math.max(1, Math.floor(wave / 30));
    for (let i = 0; i < bosses; i++) picks.push('golem');
    budget = Math.round(budget * 0.45);
  }

  let candidates = pool(wave);

  // Oleadas con sabor especial
  if (!hasBoss && wave % 7 === 0 && wave >= 7) {
    candidates = candidates.filter((t) => ENEMIES[t].flying || t === 'runner');
    if (!candidates.some((t) => ENEMIES[t].flying)) candidates.push('bat');
  } else if (!hasBoss && wave % 5 === 0 && wave >= 5) {
    // enjambre: muchos y baratos
    candidates = candidates.filter((t) => ENEMIES[t].cost <= 6);
  }

  // Sesgo hacia enemigos más caros en oleadas altas
  while (budget > 0 && picks.length < 220) {
    const affordable = candidates.filter((t) => ENEMIES[t].cost <= budget);
    if (affordable.length === 0) break;
    let choice = pick(state, affordable);
    if (rand(state) < Math.min(0.55, wave * 0.03)) {
      // reintento buscando algo más caro
      const expensive = affordable.filter((t) => ENEMIES[t].cost >= 9);
      if (expensive.length > 0) choice = pick(state, expensive);
    }
    picks.push(choice);
    budget -= ENEMIES[choice].cost;
  }

  // Ordenar: mezcla aleatoria pero con el jefe al final
  const normal = picks.filter((t) => !ENEMIES[t].boss);
  const bosses = picks.filter((t) => ENEMIES[t].boss);
  for (let i = normal.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    [normal[i], normal[j]] = [normal[j], normal[i]];
  }
  const ordered = [...normal, ...bosses];

  // Élites: unos pocos enemigos normales suben de categoría con 1-2 afijos.
  // Índices dentro de `normal` (los jefes nunca son élite).
  const eliteAffixes = new Map<number, AffixId[]>();
  if (wave >= ELITE_MIN_WAVE && normal.length > 0) {
    const count = Math.min(normal.length, 1 + Math.floor((wave - ELITE_MIN_WAVE) / 3));
    const numAffixes = wave >= ELITE_TWO_AFFIX_WAVE ? 2 : 1;
    const chosen = new Set<number>();
    for (let n = 0; n < count; n++) {
      // buscar un índice libre (los enjambres de larvas no valen la pena)
      let idx = -1;
      for (let tries = 0; tries < 8; tries++) {
        const cand = Math.floor(rand(state) * normal.length);
        if (!chosen.has(cand) && normal[cand] !== 'larva') {
          idx = cand;
          break;
        }
      }
      if (idx < 0) break;
      chosen.add(idx);
      const affixes: AffixId[] = [];
      const pool = [...AFFIX_ORDER];
      for (let a = 0; a < numAffixes && pool.length > 0; a++) {
        const pickIdx = Math.floor(rand(state) * pool.length);
        affixes.push(pool.splice(pickIdx, 1)[0]);
      }
      eliteAffixes.set(idx, affixes);
    }
  }

  // Espaciado entre spawns: más denso en oleadas altas
  const baseGap = Math.max(0.28, 0.85 - wave * 0.018); // segundos
  const entries: SpawnEntry[] = ordered.map((type, i) => {
    const gap = ENEMIES[type].boss ? 1.5 : baseGap * (0.75 + rand(state) * 0.5);
    const affixes = eliteAffixes.get(i);
    return {
      type,
      delay: Math.max(2, Math.round(gap * TICK_RATE)),
      pathIdx: pathCount > 1 ? (i % pathCount) : 0,
      ...(affixes ? { elite: true, affixes } : {}),
    };
  });

  // Resumen para la vista previa
  const counts = new Map<EnemyTypeId, number>();
  for (const t of ordered) counts.set(t, (counts.get(t) ?? 0) + 1);
  const comp: WaveComp[] = [...counts.entries()].map(([type, count]) => ({ type, count }));
  comp.sort((a, b) => ENEMIES[b.type].cost - ENEMIES[a.type].cost);

  return { entries, comp, hasBoss };
}
