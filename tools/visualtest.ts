// Bot para la prueba visual: crea una sala, arranca la partida, construye
// torres y llama la oleada. Imprime "CODE:XXXX" y queda vivo ~30s para que un
// navegador headless se una con http://localhost:3000/?n=Probador#XXXX
import WebSocket from 'ws';

const ws = new WebSocket(`ws://localhost:${process.env.PORT ?? 3000}/ws`);

ws.on('open', () => {
  ws.send(
    JSON.stringify({
      type: 'create_room',
      name: 'Bot',
      token: 'token-visual-bot',
      settings: { mapId: 'sendero', mode: 'classic', difficulty: 'normal' },
    }),
  );
});

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.type === 'room_joined') {
    console.log('CODE:' + msg.code);
    setTimeout(() => ws.send(JSON.stringify({ type: 'start_game' })), 300);
  }
  if (msg.type === 'game_started') {
    // torres pegadas al camino del mapa "sendero" (filas de camino: 2, 5, 9)
    const towers: [string, number, number][] = [
      ['archer', 5, 3],
      ['archer', 8, 4],
      ['cannon', 10, 3],
      ['frost', 12, 4],
    ];
    towers.forEach(([type, cx, cy], i) => {
      setTimeout(
        () => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'place', towerType: type, cx, cy } })),
        400 + i * 150,
      );
    });
    setTimeout(() => ws.send(JSON.stringify({ type: 'cmd', cmd: { kind: 'call_wave' } })), 1200);
  }
});

setTimeout(() => process.exit(0), 30000);
