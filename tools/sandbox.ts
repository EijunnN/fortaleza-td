// Sandbox — arranca directo en la oleada SANDBOX_START_WAVE (ver sandbox-room.ts),
// con un EJÉRCITO MIXTO Y ALEATORIO construido y mejorado A TOPE (nivel 4 + Rango
// II) ANTES de la primera oleada, MÁS varias FUSIONES de ejemplo (para ver los
// distintos tipos de disparo: láser, proyectil físico, bomba…) — no de a poco
// mientras suben las oleadas.
//
// Mapa "laberinto" (28×16, 302 celdas libres — bastante más que las 180 de
// "sendero") para caber muchas más torres y aguantar más tiempo la oleada 70.
// Usa las funciones REALES del simulador (pathCells/blockedCells) para saber
// qué celdas son libres, en vez de reimplementar la geometría a mano (eso fue
// justo el bug de las minas: 7 de 8 quedaban sobre el camino y se rechazaban).
//
// Verificado contra el simulador real (headless, sin servidor): en "sendero" no
// entran físicamente suficientes torres para garantizar sobrevivir la oleada 71
// solas — el bot te deja la mejor base posible, pero de ahí en más la peleás vos.
//
//  1. Toma el puerto 8787 (mata el Worker de Cloudflare si existe)
//  2. Arranca su propio servidor sandbox en 8787 (Vite ya proxyza aquí)
//  3. Crea sala, arranca partida ya en oleada SANDBOX_START_WAVE
//  4. Coloca minas + ejército mixto (aleatorio) + 5 pares para fusionar
//  5. Mejora TODO a nivel 4 + Rango II, fusiona los pares, y RECIÉN AHÍ llama
//     la oleada 71 (el interludio inicial dura 25s reales — de sobra)
//  6. Imprime el enlace → abres, unes y entras como JUGADOR con 20000 🪙 propios
//
// ⚠️ Mantén esta terminal abierta — NO hagas Ctrl+C.
//
// Uso: pnpm --filter @td/client dev  &&  npx tsx tools/sandbox.ts

import { execSync, spawn } from 'node:child_process';
import WebSocket from 'ws';
import { getMap, pathCells, blockedCells, TOWER_ORDER } from '@td/shared';

// Matar proceso anterior en puerto 8787 (Worker) si existe
try { execSync('fuser -k 8787/tcp 2>/dev/null', { stdio: 'ignore' }); } catch {}
execSync('sleep 2', { stdio: 'ignore' });

// Iniciar servidor sandbox en 8787 (Vite proxyea /ws a 8787)
const SB_PORT = 8787;
const VP = 5173;
const sb = spawn('npx', ['tsx', 'apps/server/src/sandbox-server.ts'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, SB_PORT: String(SB_PORT) },
});
sb.stdout?.on('data', (d: Buffer) => process.stdout.write(d.toString()));
sb.stderr?.on('data', (d: Buffer) => process.stderr.write(d.toString()));
sb.on('exit', () => process.exit(1));

const ws = new WebSocket(`ws://localhost:${SB_PORT}/ws`);

const MAP_ID = 'laberinto'; // 28×16, mucho más grande que "sendero" (20×12)
// debe coincidir con SANDBOX_START_WAVE en apps/server/src/sandbox-room.ts
const START_WAVE = 70;
const WAVE_CAP = 40; // oleadas MÁS ALLÁ del arranque (70 → hasta 110)
const BUILD_ROUNDS_MAX = 20; // límite de seguridad de rondas de mejora antes de forzar la oleada

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- celdas libres del mapa real (nada hecho a mano) ----------
const map = getMap(MAP_ID);
const pc = pathCells(map);
const bc = blockedCells(map);
const freeSet = new Set<string>();
for (let y = 0; y < map.gridH; y++) for (let x = 0; x < map.gridW; x++) {
  const k = `${x},${y}`;
  if (pc.has(k) || bc.has(k)) continue;
  freeSet.add(k);
}
const pathCellsArr = shuffle([...pc].map((k) => k.split(',').map(Number) as [number, number]));

// ---------- 5 pares de fusión de ejemplo, REPARTIDOS por todo el mapa ----------
// NINGUNA lleva francotirador de ingrediente — a propósito, para ver el láser
// genérico sin ninguna duda de si lo que se ve es "la bala del sniper" o no.
// toxicstorm (tesla+veneno) → 'beam': LÁSER genérico.
// bigbertha  (cañón+mortero) → 'bomb': proyectil físico (bomba).
// warlord    (arquero+bandera) → 'bullet': proyectil físico.
// shredder   (arquero+cañón) → 'shell': proyectil físico.
// philostone (veneno+alquimista) → 'bullet': proyectil físico.
const FUSION_DEMOS: { a: string; b: string; name: string }[] = [
  { a: 'tesla', b: 'poison', name: 'Tormenta Tóxica (beam/láser)' },
  { a: 'cannon', b: 'mortar', name: 'Gran Bertha (bomb)' },
  { a: 'archer', b: 'banner', name: 'Señor de Guerra (bullet)' },
  { a: 'archer', b: 'cannon', name: 'Trituradora (shell)' },
  { a: 'poison', b: 'alchemist', name: 'Piedra Filosofal (bullet)' },
];
// TODOS los pares horizontales adyacentes libres del mapa, en orden ALEATORIO
// (antes: se tomaba siempre el primero que se encontraba iterando el Set en
// orden de inserción → todas las fusiones quedaban amontonadas en la misma
// esquina). Ahora se recorre el mapa entero al azar.
const allPairs = shuffle(
  [...freeSet]
    .map((k) => k.split(',').map(Number) as [number, number])
    .filter(([x, y]) => freeSet.has(`${x + 1},${y}`))
    .map(([x, y]): [[number, number], [number, number]] => [[x, y], [x + 1, y]]),
);
function reserveAdjacentPair(): [[number, number], [number, number]] | null {
  while (allPairs.length) {
    const [c1, c2] = allPairs.pop()!;
    const k1 = `${c1[0]},${c1[1]}`, k2 = `${c2[0]},${c2[1]}`;
    if (freeSet.has(k1) && freeSet.has(k2)) { freeSet.delete(k1); freeSet.delete(k2); return [c1, c2]; }
  }
  return null;
}
interface FusionPair { a: string; b: string; name: string; cellA: [number, number]; cellB: [number, number]; fused: boolean }
const fusionPairs: FusionPair[] = [];
for (const d of FUSION_DEMOS) {
  const pair = reserveAdjacentPair();
  if (!pair) continue; // mapa sin espacio (no debería pasar en "laberinto")
  fusionPairs.push({ a: d.a, b: d.b, name: d.name, cellA: pair[0], cellB: pair[1], fused: false });
}

// ---------- minas + ejército, en el resto de celdas libres ----------
const shuffledFree = shuffle([...freeSet].map((k) => k.split(',').map(Number) as [number, number]));
const BANKS = shuffledFree.slice(0, 8);
const freeCells = shuffledFree.slice(8);

// más francotiradores (perforante, anti-colosal), mezclado con lo que el
// francotirador NO cubre: cañón (asedio, anti-blindada), Balista/flak (SOLO
// aire), sentry (detecta sigilosos), frost/poison (control/DoT), tesla/arquero.
const COMPOSITION: Record<string, number> = {
  sniper: 32, cannon: 20, frost: 16, poison: 16, archer: 12, tesla: 12,
  flak: 12, mortar: 8, sentry: 6, banner: 4, alchemist: 4,
};
const PATH_TOWERS: Record<string, number> = { trap: 3, boom: 4 }; // onPathOnly: van SOBRE el camino

const pool: string[] = [];
for (const [t, n] of Object.entries(COMPOSITION)) for (let i = 0; i < n; i++) pool.push(t);
const placements: { t: string; cx: number; cy: number }[] = shuffle(pool)
  .slice(0, freeCells.length)
  .map((t, i) => ({ t, cx: freeCells[i][0], cy: freeCells[i][1] }));

const pathPool: string[] = [];
for (const [t, n] of Object.entries(PATH_TOWERS)) for (let i = 0; i < n; i++) pathPool.push(t);
const pathPlacements: { t: string; cx: number; cy: number }[] = pathPool
  .map((t, i) => ({ t, cx: pathCellsArr[i][0], cy: pathCellsArr[i][1] }));

// ---------- envío ----------
// SIN throttle: el servidor agrupa TODOS los comandos que reciba antes del
// próximo tick (cada ~66ms) y los aplica juntos — no hace falta espaciarlos.
// (bug anterior: un throttle de 40ms/comando con ~180 comandos tardaba 7+
// segundos en drenarse, mientras el contador de "rondas" — que avanza por cada
// tick real del servidor — ya había dado por listo el ejército VACÍO a los
// ~1.3s y arrancado la oleada 71 sin haber construido nada todavía.)
function send(msg: unknown): void { ws.send(JSON.stringify(msg)); }
function cmd(c: unknown): void { send({ type: 'cmd', cmd: c }); }

let code = '', wave = 0, buildRounds = 0, heartbeatTicks = 0;
let armyReady = false;
const BOT_OWNER_IDX = 0; // el bot es siempre el primer jugador (crea la sala)
const NO_UPGRADE = new Set(['trap', 'boom']); // onPathOnly: no se mejoran (step.ts)
const NO_SPEC = new Set(['trap', 'boom', 'sentry']); // camino + detects: no se especializan

const totalArmy = placements.length + pathPlacements.length + fusionPairs.length * 2;

ws.on('open', () => send({
  type: 'create_room', name: '🤖', token: 't',
  settings: { mapId: MAP_ID, mode: 'endless', difficulty: 'easy', public: false },
}));

ws.on('message', (r: Buffer) => {
  const m = JSON.parse(String(r));

  // 1. Código → imprimir enlace y arrancar al tiro
  if (m.type === 'room_joined') {
    code = m.code;
    const url = `http://localhost:${VP}/#${code}`;
    console.log('\n═══════════════════════════════════════');
    console.log('  🏰 SANDBOX — ejército mixto + fusiones de ejemplo');
    console.log(`  ${url}`);
    console.log('  Abre, pon nombre, click "Unirse"');
    console.log('  ⚠️  NO cierres esta terminal\n');
    try { execSync(`xdg-open '${url}' 2>/dev/null`, { shell: true, stdio: 'ignore', timeout: 2000 }); } catch {}
    console.log('  🚀 Arrancando partida…');
    send({ type: 'start_game' });
    return;
  }

  // 2. Partida iniciada — YA en oleada START_WAVE. Solo coloca; NO llama la
  // oleada todavía — hay que mejorar y fusionar todo primero.
  if (m.type === 'game_started') {
    console.log(`  🎮 Partida en curso (mapa ${MAP_ID}), ya en oleada ${START_WAVE} — velocidad x3`);
    send({ type: 'set_speed', speed: 3 });
    BANKS.forEach(([cx, cy]) => cmd({ kind: 'place', towerType: 'bank', cx, cy }));
    for (const p of [...placements, ...pathPlacements]) cmd({ kind: 'place', towerType: p.t, cx: p.cx, cy: p.cy });
    for (const f of fusionPairs) {
      cmd({ kind: 'place', towerType: f.a, cx: f.cellA[0], cy: f.cellA[1] });
      cmd({ kind: 'place', towerType: f.b, cx: f.cellB[0], cy: f.cellB[1] });
    }
    console.log(`  🏗️  Construyendo ${totalArmy} torres + ${BANKS.length} minas + ${fusionPairs.length} pares para fusionar…`);
    return;
  }

  // 3-4. Tick durante el interludio inicial: mejorar TODO (nivel→3, especializar,
  // Rango II) por el towerId real del snapshot, y fusionar los pares demo en
  // cuanto ambas mitades estén especializadas. Recién cuando no queda nada por
  // hacer (o se acaban las rondas) se llama la oleada 71.
  if (m.type === 'game_over') {
    console.log(`  💀 game_over: ${JSON.stringify(m.stats?.players?.[0] ?? m)}`);
    return;
  }

  if (m.type === 'tick') {
    const s = m.snap;
    if (!s) return;
    if (armyReady) {
      heartbeatTicks++;
      if (heartbeatTicks % 45 === 0) console.log(`  ❤️  vidas=${s.lives} activo=${s.active} enemigos=${s.enemies.length}`);
    }

    if (!armyReady) {
      if (s.active) return; // esperar a que termine cualquier combate en curso
      const towers = s.towers as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, ...unknown[]][];
      const mine = towers.filter((tw) => tw[5] === BOT_OWNER_IDX);
      let queued = 0;

      for (const tw of mine) {
        const [id, typeIdx, , , level] = tw;
        const type = TOWER_ORDER[typeIdx as number];
        const spec = (tw[9] as number | undefined) ?? -1;
        const fusion = (tw[13] as number | undefined) ?? -1;
        if (fusion >= 0) continue; // ya fusionada: no tocar más
        if (NO_UPGRADE.has(type)) continue;
        if (level < 3) { cmd({ kind: 'upgrade', towerId: id }); queued++; }
        else if (spec === -1 && !NO_SPEC.has(type)) { cmd({ kind: 'specialize', towerId: id, spec: Math.random() < 0.5 ? 0 : 1 }); queued++; }
        else if (spec >= 0 && level < 4) { cmd({ kind: 'upgrade', towerId: id }); queued++; }
      }

      // fusionar los pares demo apenas ambas mitades estén especializadas
      for (const f of fusionPairs) {
        if (f.fused) continue;
        const ta = mine.find((tw) => tw[2] === f.cellA[0] && tw[3] === f.cellA[1]);
        const tb = mine.find((tw) => tw[2] === f.cellB[0] && tw[3] === f.cellB[1]);
        if (!ta || !tb) continue;
        const specA = (ta[9] as number | undefined) ?? -1;
        const specB = (tb[9] as number | undefined) ?? -1;
        if (specA >= 0 && specB >= 0) {
          cmd({ kind: 'fuse', towerId: ta[0], otherId: tb[0], keepId: ta[0] });
          f.fused = true;
          console.log(`  🔮 Fusionando: ${f.name}`);
          queued++;
        }
      }

      buildRounds++;
      const allBuilt = mine.length >= totalArmy;
      if (!allBuilt) console.log(`  🏗️  ronda ${buildRounds}: ${mine.length}/${totalArmy} torres en pie`);
      if ((allBuilt && queued === 0) || buildRounds >= BUILD_ROUNDS_MAX) {
        armyReady = true;
        console.log(`  ✅ Ejército listo (${buildRounds} rondas de mejora, ${fusionPairs.filter((f) => f.fused).length}/${fusionPairs.length} fusiones)`);
        console.log(`  📢 Oleada ${START_WAVE + 1}`);
        send({ type: 'cmd', cmd: { kind: 'call_wave' } });
      }
      return;
    }

    if (s.active) return;

    wave++;
    if (wave < WAVE_CAP) {
      const nextWave = START_WAVE + wave + 1;
      setTimeout(() => { console.log(`  📢 Oleada ${nextWave}`); send({ type: 'cmd', cmd: { kind: 'call_wave' } }); }, 1500);
    } else {
      console.log(`  🏁 Tope de oleadas alcanzado (oleada ${START_WAVE + wave})`);
    }
  }
});

// 20 min de vida (llegar a oleada 70+ en endless toma más que 10 min a x3)
setTimeout(() => { console.log('\n  ⏰ Tiempo límite.'); process.exit(0); }, 20 * 60 * 1000);
