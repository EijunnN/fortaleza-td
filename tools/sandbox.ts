// Sandbox visual para probar torres: un bot crea una sala, acumula oro con
// minas, coloca TODAS las torres del juego (incluido Francotirador) y llama
// oleadas sin parar. Tú te conectas como espectador y ves las animaciones.
//
// Uso:
//   1. pnpm dev             (en otra terminal)
//   2. npx tsx tools/sandbox.ts
//   3. Abre http://localhost:5173/?n=Mir%C3%B3n#XXXX  (con el CODE impreso)
//
// Para cambiar las torres que coloca, edita la función `placeAllTowers`.

import WebSocket from 'ws';

const PORT = process.env.PORT ?? 3000;
const ws = new WebSocket(`ws://localhost:${PORT}/ws`);

// ---- qué torres colocar y dónde (coordendas (cx,cy) del mapa "sendero") ----
// Se colocan en orden, agrupadas por tipo, con espacio entre grupos.
const TOWER_PLACEMENTS: { type: string; cx: number; cy: number }[] = [
  // === Especialización A de cada torre ===
  { type: 'archer', cx: 3, cy: 1 },
  { type: 'cannon', cx: 5, cy: 1 },
  { type: 'frost', cx: 7, cy: 1 },
  { type: 'poison', cx: 9, cy: 1 },
  { type: 'tesla', cx: 11, cy: 1 },
  { type: 'sniper', cx: 13, cy: 1 },
  { type: 'mortar', cx: 15, cy: 1 },

  // === Especialización B de cada torre ===
  { type: 'archer', cx: 3, cy: 3 },
  { type: 'cannon', cx: 5, cy: 3 },
  { type: 'frost', cx: 7, cy: 3 },
  { type: 'poison', cx: 9, cy: 3 },
  { type: 'tesla', cx: 11, cy: 3 },
  { type: 'sniper', cx: 13, cy: 3 },
  { type: 'mortar', cx: 15, cy: 3 },

  // === Torres de soporte ===
  { type: 'banner', cx: 3, cy: 5 },
  { type: 'trap', cx: 5, cy: 5 },
  { type: 'alchemist', cx: 7, cy: 5 },
  { type: 'boom', cx: 9, cy: 5 },
  { type: 'sentry', cx: 11, cy: 5 },

  // === Segunda línea (más cerca del castillo) ===
  { type: 'archer', cx: 12, cy: 7 },
  { type: 'cannon', cx: 14, cy: 7 },
  { type: 'frost', cx: 16, cy: 7 },
  { type: 'sniper', cx: 18, cy: 7 },
  { type: 'mortar', cx: 6, cy: 8 },
  { type: 'tesla', cx: 8, cy: 8 },
  { type: 'poison', cx: 10, cy: 8 },
];

// Minas de oro: se colocan al inicio para generar ingresos
const BANK_POSITIONS: [number, number][] = [
  [1, 9], [3, 9], [5, 9], [7, 9],
  [9, 9], [11, 9], [13, 9], [15, 9],
  [17, 9],
];

let placedIndex = 0;
let bankIndex = 0;
let waveNum = 0;

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'create_room',
    name: 'Sandbox',
    token: 'token-sandbox',
    settings: { mapId: 'sendero', mode: 'endless', difficulty: 'easy', public: false },
  }));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));

  if (msg.type === 'room_joined') {
    console.log('\n═══════════════════════════════════════════');
    console.log(`  🏰 SANDBOX LISTO — CODE: ${msg.code}`);
    console.log('═══════════════════════════════════════════');
    console.log(`  Abre en el navegador:`);
    console.log(`  http://localhost:${PORT}/?n=Mir%C3%B3n#${msg.code}\n`);
    console.log('  El bot está acumulando oro y colocando torres…\n');

    // esperar un poco antes de arrancar para dar tiempo a unirse
    setTimeout(() => ws.send(JSON.stringify({ type: 'start_game' })), 5000);
  }

  if (msg.type === 'game_started') {
    console.log('  Partida iniciada. Colocando minas y llamando oleadas…\n');

    // Velocidad x3
    ws.send(JSON.stringify({ type: 'set_speed', speed: 3 }));

    // Colocar minas de oro con retraso escalonado
    BANK_POSITIONS.forEach(([cx, cy], i) => {
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: 'bank', cx, cy } }));
      }, 500 + i * 200);
    });

    // Tras colocar minas, llamar oleadas y colocar torres gradualmente
    setTimeout(() => callWave(), 4000);
  }

  // Escuchar los ticks para reaccionar al estado del juego
  if (msg.type === 'tick') {
    const snap = msg.snap;
    if (!snap) return;

    // Cuando termina una oleada (interludio activo), llamar la siguiente
    if (!snap.active && waveNum > 0 && waveNum < 50) {
      // Colocar más torres gradualmente entre oleadas
      placeMoreTowers();

      // Esperar un poco y llamar la siguiente oleada
      setTimeout(() => {
        callWave();
        // Subir de nivel las minas cuando tengamos oro
        if (waveNum % 5 === 0) {
          upgradeBanks();
        }
      }, 1500);
    }

    // Mostrar progreso cada 10 oleadas
    if (!snap.active && waveNum > 0 && waveNum % 10 === 0) {
      const player = snap.players?.[0];
      if (player) {
        console.log(`  Oleada ${snap.wave} completada — Oro del bot: ${Math.floor(player.gold)}`);
      }
    }
  }

  if (msg.type === 'wave_started') {
    waveNum = msg.wave ?? waveNum + 1;
  }
});

function callWave(): void {
  ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } }));
}

function placeMoreTowers(): void {
  const batch = 3; // colocar 3 torres por tanda
  for (let i = 0; i < batch && placedIndex < TOWER_PLACEMENTS.length; i++, placedIndex++) {
    const { type, cx, cy } = TOWER_PLACEMENTS[placedIndex];
    ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: type, cx, cy } }));
  }
  if (placedIndex >= TOWER_PLACEMENTS.length && placedIndex < TOWER_PLACEMENTS.length + 1) {
    console.log('  ✅ Todas las torres colocadas. Disfruta del espectáculo.\n');
  }
}

function upgradeBanks(): void {
  // Intenta mejorar las minas (select tower, upgrade)
  // El servidor maneja la mejora de la mina seleccionada más cercana
  BANK_POSITIONS.forEach(([cx, cy], i) => {
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'upgrade', cx, cy } }));
    }, i * 100);
  });
}

// Timeout de seguridad: mantener vivo ~5 min
setTimeout(() => {
  console.log('\n  ⏰ Tiempo límite alcanzado. Cerrando sandbox.');
  process.exit(0);
}, 5 * 60 * 1000);
