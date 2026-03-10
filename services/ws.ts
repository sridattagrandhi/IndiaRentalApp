// services/ws.ts

type WSListener = (msg: any) => void;

class WSService {
  private ws: WebSocket | null = null;
  private listeners = new Set<WSListener>();
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;

  private url: string | null = null;
  private userId: string | null = null;

  connect(url: string, userId: string) {
    this.url = url;
    this.userId = userId;

    // If already connected, do nothing
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.open();
  }

  private open() {
    if (!this.url || !this.userId) return;

    // Backend connect handler supports queryString user_id fallback.
    // IMPORTANT: must be wss://... not https://...
    const wsUrl = `${this.url}?user_id=${encodeURIComponent(this.userId)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          for (const cb of this.listeners) cb(data);
        } catch {
          // ignore non-json payloads
        }
      };

      this.ws.onerror = () => {
        // fall through to close -> reconnect
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch {
      this.ws = null;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.url || !this.userId) return;
    if (this.reconnectTimer) return;

    // exponential backoff: 0.5s, 1s, 2s, 4s, ... up to 15s
    const delay = Math.min(15000, 500 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  disconnect() {
    this.url = null;
    this.userId = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.listeners.clear();
  }

  subscribe(cb: WSListener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  send(payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }
}

export const wsService = new WSService();
