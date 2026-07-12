// Sandbox — el BOT arranca la partida AL INSTANTE, colocas minas y oleadas.
// Tú entras como JUGADOR (aunque la partida ya esté en curso) con 525 🪙
// y COLOCAS TUS torres — francotirador, lo que quieras.
//
//  1. Toma el puerto 3000 (mata el servidor Node anterior si existe)
//  2. Arranca su propio servidor sandbox (room.ts intacto)
//  3. Crea sala, arranca partida al tiro, velocidad x3
//  4. Coloca minas de oro + TODAS las torres entre oleadas
//  5. Imprime el enlace → abres, unes y entras como JUGADOR
//
// ⚠️ Mantén esta terminal abiertA — NO hagas Ctrl+C.
//
// Uso: pnpm dev (otra terminal)  &&  npx tsx tools/sandbox.ts

import { execSync, spawn } from 'node:child_process';
import WebSocket from 'ws';

// Matar proceso anterior en puerto 3000 si existe
try { execSync('fuser -k 3000/tcp 2>/dev/null', { stdio: 'ignore' }); } catch {}
execSync('sleep 2', { stdio: 'ignore' });

// Iniciar servidor sandbox en 3000 (Vite proxyea /ws a 3000)
const SB_PORT = 3000;
const VP = 5173;
const sb = spawn('npx', ['tsx', 'apps/server/src/sandbox-server.ts'], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, SB_PORT: String(SB_PORT) },
});
sb.stdout?.on('data', (d: Buffer) => process.stdout.write(d.toString()));
sb.stderr?.on('data', (d: Buffer) => process.stderr.write(d.toString()));
sb.on('exit', () => process.exit(1));

const NP = SB_PORT;
const ws = new WebSocket(`ws://localhost:${NP}/ws`);

let code = '', wave = 0, idx = 0;

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

  // 1. Código → imprimir enlace y arrancar al tiro
  if (m.type === 'room_joined') {
    code = m.code;
    const url = `http://localhost:${VP}/#${code}`;
    console.log('\n═══════════════════════════════════════');
    console.log('  🏰 SANDBOX');
    console.log(`  ${url}`);
    console.log('  Abre, pon nombre, click "Unirse"');
    console.log('  ⚠️  NO cierres esta terminal\n');
    try { execSync(`xdg-open '${url}' 2>/dev/null`, { shell: true, stdio: 'ignore', timeout: 2000 }); } catch {}
    console.log('  🚀 Arrancando partida…');
    ws.send(JSON.stringify({ type: 'start_game' }));
    return;
  }

  // 2. Partida iniciada
  if (m.type === 'game_started') {
    console.log('  🎮 Partida en curso — velocidad x3');
    ws.send(JSON.stringify({ type: 'set_speed', speed: 3 }));
    BANKS.forEach(([cx, cy]) => q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: 'bank', cx, cy } }))));
    q.push(() => { console.log('  📢 Oleada 1'); ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } })); });
    flush();
    return;
  }

  // 4. Tick → colocar torres del bot entre oleadas
  if (m.type === 'tick') {
    const s = m.snap;
    if (!s || s.active) return;

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
      console.log('  ✅ Bot colocó todas sus torres — tú colocas las tuyas');
      idx = 999;
    }

    // Mejorar minas cada 5 oleadas
    if (wave > 0 && wave % 5 === 0) BANKS.forEach(([cx, cy]) => q.push(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'upgrade', cx, cy } }))));

    wave++;
    if (wave < 50) setTimeout(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } })), 1500);
    flush();
  }
});

// 10 min de vida (suficiente para varias oleadas)
setTimeout(() => { console.log('\n  ⏰ Tiempo límite.'); process.exit(0); }, 10 * 60 * 1000);
