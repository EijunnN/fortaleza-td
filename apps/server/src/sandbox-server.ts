// Servidor sandbox independiente (puerto 3001) con versiones modificadas de Room
// para permitir: inicio instantáneo, unirse como jugador en partida, 525 oro inicial.
// No modifica room.ts — los cambios viven solo aquí.
import http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg } from '@td/shared';
import { RoomManager } from './roomManager.js';
import { SandboxRoom } from './sandbox-room.js';

const PORT = Number(process.env.SB_PORT ?? 3001);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

const rooms = new Map<string, SandboxRoom>();
const socketRoom = new Map<WebSocket, SandboxRoom>();
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try { msg = JSON.parse(String(raw)) as ClientMsg; } catch { return; }
    try { handle(ws, msg); } catch (err) { console.error('[sb] error', msg?.type, err); }
  });
  ws.on('close', () => {
    const r = socketRoom.get(ws);
    socketRoom.delete(ws);
    r?.dropSocket(ws);
  });
});

function handle(ws: WebSocket, msg: ClientMsg): void {
  if (msg.type === 'create_room') {
    if (socketRoom.get(ws)) return;
    let code = genCode();
    while (rooms.has(code)) { code = genCode(); }
    const room = new SandboxRoom(code, msg.settings, () => rooms.delete(code));
    const res = room.addPlayer(msg.name, msg.token, ws);
    if (res.kind === 'error') { ws.send(JSON.stringify({ type: 'error', msg: res.msg })); return; }
    rooms.set(code, room);
    socketRoom.set(ws, room);
    if (res.kind !== 'player') return;
    const p = res.player;
    room.send(p, { type: 'room_joined', code: room.code, playerId: p.id, isHost: p.isHost } as any);
    room.broadcastLobby();
    room.sendGameStateTo(p);
    return;
  }
  if (msg.type === 'join_room') {
    if (socketRoom.get(ws)) return;
    const room = rooms.get((msg.code ?? '').toUpperCase());
    if (!room) { ws.send(JSON.stringify({ type: 'error', msg: 'Sala no existe' })); return; }
    const res = room.addPlayer(msg.name, msg.token, ws);
    if (res.kind === 'error') { ws.send(JSON.stringify({ type: 'error', msg: res.msg })); return; }
    if (res.kind !== 'player') return;
    socketRoom.set(ws, room);
    const p = res.player;
    room.send(p, { type: 'room_joined', code: room.code, playerId: p.id, isHost: p.isHost } as any);
    room.broadcastLobby();
    room.sendGameStateTo(p);
    return;
  }
  const room = socketRoom.get(ws);
  if (room) room.handleMessage(ws, msg);
}

let codeIdx = 0;
function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[(codeIdx++ + Math.floor(Math.random() * 100)) % chars.length];
  return c;
}

server.listen(PORT, () => console.log(`🏖️ Sandbox server en :${PORT}`));
