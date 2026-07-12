// Sandbox — abre el enlace y ves todas las torres disparando.
//
//  1. Crea sala, arranca partida al instante, velocidad x3
//  2. Coloca minas de oro + TODAS las torres del juego (francotirador incluido)
//  3. Llama oleadas sin parar
//  4. Tras la oleada 3 imprime el enlace
//  5. Abres el enlace → entras de ESPECTADOR directo a la partida
//
// Uso: pnpm dev (otra terminal)  &&  npx tsx tools/sandbox.ts

import WebSocket from 'ws';

const NP = Number(process.env.PORT ?? 3000);
const VP = 5173;
const ws = new WebSocket(`ws://localhost:${NP}/ws`);

let code = '', wave = 0, idx = 0, printed = false;

const TOWERS: Record<string, [number, number][]> = {
  archer: [[3,1],[6,7]], cannon: [[6,1],[10,7]], frost: [[9,1],[14,7]],
  poison: [[12,1],[18,4]], tesla: [[15,1],[16,4]], sniper: [[4,4],[18,7]],
  mortar: [[8,4]], banner: [[12,4]], trap: [[15,4]],
  alchemist: [[4,8]], boom: [[8,8]], sentry: [[12,8]],
};

const BANKS: [number, number][] = [[1,9],[3,9],[5,9],[7,9],[9,9],[11,9],[13,9],[17,9]];

// Cola de comandos para espaciar en el tiempo
const q: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const next = q.shift();
    if (next) { next(); flush(); }
  }, 80);
}

ws.on('open', () => ws.send(JSON.stringify({
  type: 'create_room', name: '🤖', token: 't',
  settings: { mapId: 'sendero', mode: 'endless', difficulty: 'easy', public: false },
})));

ws.on('message', (r: Buffer) => {
  const m = JSON.parse(String(r));

  if (m.type === 'room_joined') {
    code = m.code;
    console.log(`\n  🏰 Sala ${code} — arrancando…`);
    ws.send(JSON.stringify({ type: 'start_game' }));
    return;
  }

  if (m.type === 'game_started') {
    console.log('  🎮 Partida iniciada, velocidad x3');
    ws.send(JSON.stringify({ type: 'set_speed', speed: 3 }));
    BANKS.forEach(([cx, cy]) => q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: 'bank', cx, cy } }))));
    q.push(() => { console.log('  📢 Oleada 1'); ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } })); });
    flush();
    return;
  }

  if (m.type === 'tick') {
    const s = m.snap;
    if (!s || s.active) return;

    // Colocar 2 torres por oleada
    const towerTypes = Object.keys(TOWERS);
    for (let i = 0; i < 2 && idx < towerTypes.length; i++, idx++) {
      const t = towerTypes[idx];
      const pos = TOWERS[t][0]; // primera posición
      q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: t, cx: pos[0], cy: pos[1] } })));
    }
    if (idx >= towerTypes.length) {
      // segunda posición de las que tienen
      for (const [t, poses] of Object.entries(TOWERS)) {
        if (poses.length > 1) {
          q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: t, cx: poses[1][0], cy: poses[1][1] } })));
        }
      }
      idx = Infinity;
    }

    // Mejorar bancos cada 5 oleadas
    if (wave > 0 && wave % 5 === 0) {
      BANKS.forEach(([cx, cy]) => q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'upgrade', cx, cy } }))));
    }

    // Imprimir enlace tras oleada 3
    if (!printed && wave >= 2 && code) {
      printed = true;
      console.log('\n═══════════════════════════════════════');
      console.log('  ✅ SANDBOX LISTO');
      console.log(`  http://localhost:${VP}/?n=Esp#${code}`);
      console.log('  (entras directo como espectador)\n');
    }

    wave++;
    if (wave < 50) setTimeout(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } })), 1500);
    flush();
  }
});

setTimeout(() => process.exit(0), 10 * 60 * 1000);
