import type { ClientMsg, ServerMsg } from '@td/shared';

type Handler = (msg: ServerMsg) => void;

// Cliente WebSocket con reconexión automática y auto-reparable:
// - reintentos con backoff (máx 4s)
// - watchdog que revive la cadena de reintentos si muere por cualquier motivo
// - al volver el foco a la pestaña (móviles que congelan tabs) reconecta al instante
export class Net {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Handler[]>();
  private wantOpen = false;
  private retryMs = 500;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  onOpen: () => void = () => {};
  onDrop: () => void = () => {};

  connect(): void {
    this.wantOpen = true;
    this.open();

    // watchdog: si estamos desconectados y sin reintento pendiente, reintentar
    setInterval(() => {
      if (this.wantOpen && !this.connected && !this.connecting && !this.retryTimer) {
        this.open();
      }
    }, 3000);

    // el navegador congela pestañas en segundo plano; al volver, reconectar ya
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.wantOpen && !this.connected && !this.connecting) {
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = null;
        }
        this.retryMs = 500;
        this.open();
      }
    });
  }

  private open(): void {
    let ws: WebSocket;
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retryMs = 500;
      this.onOpen();
    };
    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(ev.data as string) as ServerMsg;
      } catch {
        return;
      }
      for (const h of this.handlers.get(msg.type) ?? []) h(msg);
    };
    ws.onclose = () => {
      this.ws = null;
      if (!this.wantOpen) return;
      this.onDrop();
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.wantOpen) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.wantOpen && !this.connected && !this.connecting) this.open();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 1.7, 4000);
  }

  send(msg: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on<T extends ServerMsg['type']>(type: T, handler: (msg: Extract<ServerMsg, { type: T }>) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as Handler);
    this.handlers.set(type, list);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING;
  }
}

export const net = new Net();
