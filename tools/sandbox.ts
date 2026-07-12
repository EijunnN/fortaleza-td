// Sandbox — el BOT juega solo, colocas todas las torres y llamas oleadas.
// Abres el enlace y ENTRAS DIRECTO como espectador a mitad de partida.
//
//  1. Crea sala, arranca partida AL INSTANTE (sin esperar a nadie)
//  2. Velocidad x3, coloca minas de oro, oleada tras oleada
//  3. Coloca TODAS las torres del juego (francotirador incluido) entre oleadas
//  4. Tras la oleada 3, imprime el enlace → entras y ves todo funcionando
//
// ⚠️ Mantén esta terminal abierta — NO hagas Ctrl+C.
//
// Uso: pnpm dev (otra terminal)  &&  npx tsx tools/sandbox.ts

import { execSync } from 'node:child_process';
import WebSocket from 'ws';

const NP = Number(process.env.PORT ?? 3000);
const VP = 5173;
const ws = new WebSocket(`ws://localhost:${NP}/ws`);

let code = '', wave = 0, idx = 0, linkPrinted = false;

const TOWERS: Record<string, [number, number][]> = {
  archer: [[3,1],[6,7]], cannon: [[6,1],[10,7]], frost: [[9,1],[14,7]],
  poison: [[12,1],[18,4]], tesla: [[15,1],[16,4]], sniper: [[4,4],[18,7]],
  mortar: [[8,4]], banner: [[12,4]], trap: [[15,4]],
  alchemist: [[4,8]], boom: [[8,8]], sentry: [[12,8]],
};

const BANKS: [number, number][] = [[1,9],[3,9],[5,9],[7,9],[9,9],[11,9],[13,9],[17,9]];

const q: (() => void)[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; const n = q.shift(); if (n) { n(); flush(); } }, 80);
}

ws.on('open', () => ws.send(JSON.stringify({
  type: 'create_room', name: '🤖', token: 't',
  settings: { mapId: 'sendero', mode: 'endless', difficulty: 'easy', public: false },
})));

ws.on('message', (r: Buffer) => {
  const m = JSON.parse(String(r));

  // 1. Recibimos código → ARRANCAR PARTIDA AL TIRO
  if (m.type === 'room_joined') {
    code = m.code;
    console.log(`\n  🏰 Sala ${code} — arrancando partida…`);
    ws.send(JSON.stringify({ type: 'start_game' }));
    return;
  }

  // 2. Partida iniciada → velocidad x3, minas, oleada 1
  if (m.type === 'game_started') {
    console.log('  🎮 Velocidad x3 — colocando minas…');
    ws.send(JSON.stringify({ type: 'set_speed', speed: 3 }));
    BANKS.forEach(([cx, cy]) => q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: 'bank', cx, cy } }))));
    q.push(() => { console.log('  📢 Oleada 1'); ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } })); });
    flush();
    return;
  }

  // 3. Tick → en interludio: colocar torres, mejorar minas, llamar siguiente
  if (m.type === 'tick') {
    const s = m.snap;
    if (!s || s.active) return;

    // Colocar 2 torres del bot por oleada
    const types = Object.keys(TOWERS);
    for (let i = 0; i < 2 && idx < types.length; i++, idx++) {
      const t = types[idx];
      const pos = TOWERS[t][0];
      q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: t, cx: pos[0], cy: pos[1] } })));
    }
    if (idx >= types.length && idx < 999) {
      for (const [t, poses] of Object.entries(TOWERS)) {
        if (poses.length > 1) q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: t, cx: poses[1][0], cy: poses[1][1] } })));
      }
      console.log('  ✅ Todas las torres colocadas');
      idx = 999;
    }

    // Mejorar minas cada 5 oleadas
    if (wave > 0 && wave % 5 === 0) BANKS.forEach(([cx, cy]) => q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'upgrade', cx, cy } }))));

    // Imprimir enlace tras oleada 3
    if (!linkPrinted && wave >= 2 && code) {
      linkPrinted = true;
      const url = `http://localhost:${VP}/#${code}`;
      console.log('\n═══════════════════════════════════════');
      console.log('  ✅ SANDBOX LISTO');
      console.log(`  ${url}`);
      console.log('  (abres y entras al juego directo como espectador)\n');
      try { execSync(`xdg-open '${url}' 2>/dev/null`, { shell: true, stdio: 'ignore', timeout: 2000 }); } catch {}
    }

    wave++;
    if (wave < 50) setTimeout(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } })), 1500);
    flush();
  }
});

// 10 min de vida (suficiente para varias oleadas)
setTimeout(() => { console.log('\n  ⏰ Tiempo límite.'); process.exit(0); }, 10 * 60 * 1000);
