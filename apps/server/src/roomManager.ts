import type { RoomSettings } from '@td/shared';
import { Room } from './room.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin I/O para evitar confusiones
const ROOM_IDLE_MS = 5 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor() {
    setInterval(() => {
      for (const room of this.rooms.values()) room.maybeCleanup(ROOM_IDLE_MS);
    }, 30_000);
  }

  private genCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
  }

  create(settings: RoomSettings): Room {
    const room = new Room(this.genCode(), settings, (r) => this.rooms.delete(r.code));
    this.rooms.set(room.code, room);
    console.log(`[sala ${room.code}] creada (${settings.mapId}, ${settings.mode}, ${settings.difficulty})`);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  count(): number {
    return this.rooms.size;
  }
}
