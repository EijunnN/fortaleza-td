// Sandbox visual interactivo para probar torres.
//
//  1. Crea una sala en easy/endless e imprime el enlace
//  2. Espera a que entres como JUGADOR (tienes 30 s)
//  3. Arranca la partida, coloca minas de oro y llama oleadas
//  4. TÚ colocas las torres que quieras con tu propio oro
//  5. El bot también coloca todas las torres del juego gradualmente
//
// Uso:
//   1. pnpm dev                        (en otra terminal)
//   2. npx tsx tools/sandbox.ts
//   3. Abre el enlace en el navegador  (entras automáticamente)
//   4. Pon nombre, espera a que arranque, y ¡a probar torres!
//
// Para cambiar qué torres coloca el bot, edita TOWER_PLACEMENTS.

import WebSocket from 'ws';

const NODE_PORT = Number(process.env.PORT ?? 3000);
const VITE_PORT = 5173;
const ws = new WebSocket(`ws://localhost:${NODE_PORT}/ws`);

let userJoined = false;
let gameStarted = false;
let waveNum = 0;
let placedIdx = 0;

// Todas las torres que el bot colocará entre oleadas.
// (cx, cy) son coordenadas del mapa "sendero" — junto al camino (filas 2,5,9)
const ALL_TOWERS: { type: string; cx: number; cy: number }[] = [
  // Fila superior (junto al path en fila 2)
  { type: 'archer', cx: 3, cy: 1 },
  { type: 'cannon', cx: 6, cy: 1 },
  { type: 'frost', cx: 9, cy: 1 },
  { type: 'poison', cx: 12, cy: 1 },
  { type: 'tesla', cx: 15, cy: 1 },
  // Fila media (junto al path en fila 5)
  { type: 'sniper', cx: 4, cy: 4 },
  { type: 'mortar', cx: 8, cy: 4 },
  { type: 'banner', cx: 12, cy: 4 },
  { type: 'trap', cx: 15, cy: 4 },
  // Fila inferior (junto al path en fila 9)
  { type: 'alchemist', cx: 4, cy: 8 },
  { type: 'boom', cx: 8, cy: 8 },
  { type: 'sentry', cx: 12, cy: 8 },
  // Repes para llenar
  { type: 'archer', cx: 6, cy: 7 },
  { type: 'cannon', cx: 10, cy: 7 },
  { type: 'frost', cx: 14, cy: 7 },
  { type: 'sniper', cx: 18, cy: 7 },
  { type: 'tesla', cx: 16, cy: 4 },
];

// Minas de oro para generar ingresos a todo el equipo
const BANKS: [number, number][] = [
  [1, 9], [3, 9], [5, 9], [7, 9],
  [9, 9], [11, 9], [13, 9], [17, 9],
];

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'create_room',
    name: '✨ Sandbox',
    token: 'token-sandbox',
    settings: { mapId: 'sendero', mode: 'endless', difficulty: 'easy', public: false },
  }));
});

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));

  // Recibimos el código de sala
  if (msg.type === 'room_joined') {
    console.log('\n═══════════════════════════════════════════');
    console.log(`  🏰 SANDBOX — CODE: ${msg.code}`);
    console.log('═══════════════════════════════════════════');
    console.log(`  📌 Abre este enlace en el navegador:`);
    console.log(`  http://localhost:${VITE_PORT}/?n=Tester#${msg.code}`);
    console.log('\n  ⏳ Entras automáticamente al lobby.');
    console.log('  Espera ~5 s y el bot arranca la partida.\n');
  }

  // El lobby cambia → detectamos si el usuario ya entró
  if (msg.type === 'lobby_state') {
    const players = msg.players ?? [];
    // Si hay más de 1 jugador (bot + tú) y aún no empezamos
    if (players.length > 1 && !gameStarted) {
      userJoined = true;
      console.log('  ✅ Jugador detectado. Arrancando partida en 3 seg…\n');
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'start_game' }));
      }, 3000);
    }
  }

  // Partida iniciada
  if (msg.type === 'game_started') {
    gameStarted = true;
    console.log('  🎮 Partida iniciada. Poniendo velocidad x3 y minas…\n');

    // Velocidad x3
    ws.send(JSON.stringify({ type: 'set_speed', speed: 3 }));

    // Colocar minas de oro escalonadamente
    BANKS.forEach(([cx, cy], i) => {
      setTimeout(() => {
        ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: 'bank', cx, cy } }));
      }, 500 + i * 200);
    });

    // Llamar la primera oleada tras colocar las minas
    setTimeout(() => {
      console.log('  📢 Llamando oleada 1…');
      ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } }));
    }, 4000);
  }

  // Tick de simulación — reaccionamos a los interludios
  if (msg.type === 'tick') {
    const snap = msg.snap;
    if (!snap) return;

    // Cuando termina una oleada (en interludio): llamar la siguiente
    if (!snap.active && waveNum > 0 && waveNum < 50) {
      // Colocar algunas torres del bot
      placeBatch();

      // Mejorar bancos cada 5 oleadas
      if (waveNum % 5 === 0) upgradeBanks();

      // Llamar siguiente oleada tras una pausa
      setTimeout(() => {
        waveNum++;
        ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } }));
      }, 2000);
    }

    // Info periódica
    if (!snap.active && waveNum > 0 && waveNum % 10 === 0) {
      const p = snap.players?.[0];
      if (p) console.log(`  📊 Oleada ${snap.wave} — Oro del bot: ${Math.floor(p.gold)} 🪙`);
    }
  }
});

// Timeout por si nadie se une
setTimeout(() => {
  if (!userJoined) {
    console.log('\n  ⏰ Nadie se unió en 30 s. Cerrando.');
    process.exit(0);
  }
}, 30_000);

// Mantener vivo 10 min
setTimeout(() => {
  console.log('\n  ⏰ Tiempo límite. Cerrando sandbox.');
  process.exit(0);
}, 10 * 60 * 1000);

// ---------- helpers ----------

function placeBatch(): void {
  const n = 2;
  for (let i = 0; i < n && placedIdx < ALL_TOWERS.length; i++, placedIdx++) {
    const { type, cx, cy } = ALL_TOWERS[placedIdx];
    ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: type, cx, cy } }));
  }
  if (placedIdx >= ALL_TOWERS.length) {
    console.log('  ✅ El bot ya colocó todas sus torres.');
    placedIdx = Infinity; // no repetir mensaje
  }
}

function upgradeBanks(): void {
  BANKS.forEach(([cx, cy], i) => {
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'upgrade', cx, cy } }));
    }, i * 100);
  });
}
