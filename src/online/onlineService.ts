import type {
  ColorPreference,
  OnlineRoomSnapshot,
  PieceColor,
  TimeControl,
} from '../types/chess';

type RoomUpdateListener = (room: OnlineRoomSnapshot, assignedColor: PieceColor | null) => void;
type ErrorListener = (message: string) => void;
type ConnectionListener = (connected: boolean, reconnecting: boolean) => void;

const SESSION_ID_KEY = 'monssif_chess_player_session_v1';
const ACTIVE_ROOM_KEY = 'monssif_chess_active_room_v1';

interface SavedRoomSession {
  roomCode: string;
  playerName: string;
}

class OnlineMultiplayerClient {
  private ws: WebSocket | null = null;
  private assignedColor: PieceColor | null = null;
  private currentRoom: OnlineRoomSnapshot | null = null;
  private roomListeners = new Set<RoomUpdateListener>();
  private errorListeners = new Set<ErrorListener>();
  private connListeners = new Set<ConnectionListener>();

  private sessionIdCache: string | null = null;
  private activeRoom: SavedRoomSession | null = null;
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;

  private getSessionId(): string {
    if (this.sessionIdCache) return this.sessionIdCache;
    if (typeof window !== 'undefined') {
      try {
        const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
        if (existing) {
          this.sessionIdCache = existing;
          return existing;
        }
        const generated =
          typeof window.crypto?.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        window.sessionStorage.setItem(SESSION_ID_KEY, generated);
        this.sessionIdCache = generated;
        return generated;
      } catch {
        // Fallback when sessionStorage is unavailable
      }
    }
    this.sessionIdCache = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return this.sessionIdCache;
  }

  public getSavedRoomSession(): SavedRoomSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(ACTIVE_ROOM_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SavedRoomSession>;
      if (parsed && typeof parsed.roomCode === 'string' && typeof parsed.playerName === 'string') {
        return { roomCode: parsed.roomCode, playerName: parsed.playerName };
      }
    } catch {
      // Ignore malformed storage
    }
    return null;
  }

  private persistRoomSession(session: SavedRoomSession | null): void {
    this.activeRoom = session;
    if (typeof window === 'undefined') return;
    try {
      if (session) {
        window.sessionStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify(session));
      } else {
        window.sessionStorage.removeItem(ACTIVE_ROOM_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manualDisconnect || !this.activeRoom || this.reconnectTimer !== null) return;
    if (this.reconnectAttempts >= 10) {
      this.emitError('Connection lost. Could not reconnect to room.');
      this.emitConn(false, false);
      return;
    }

    const delayMs = Math.min(5000, 500 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    this.emitConn(false, true);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.manualDisconnect || !this.activeRoom) return;
      const { roomCode, playerName } = this.activeRoom;
      void this.joinRoom(roomCode, playerName).catch(() => {
        // onclose / onerror will continue retry backoff
      });
    }, delayMs);
  }

  private connect(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.ws);
    }

    this.clearReconnectTimer();
    this.manualDisconnect = false;

    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      old.onclose = null;
      old.onerror = null;
      old.close();
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.getWsUrl());
      this.ws = ws;

      const timeout = window.setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error('WebSocket connection timed out.'));
        }
      }, 6000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.emitConn(true, false);
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === 'room_joined') {
            this.assignedColor = data.assignedColor;
            this.currentRoom = data.room;
            const myName =
              data.assignedColor === 'w'
                ? data.room.whiteName
                : data.room.blackName;
            this.persistRoomSession({
              roomCode: data.room.roomCode,
              playerName: this.activeRoom?.playerName || myName || 'Player',
            });
            this.emitRoom(data.room, this.assignedColor);
          } else if (data.type === 'room_state') {
            this.currentRoom = data.room;
            this.emitRoom(data.room, this.assignedColor);
          } else if (data.type === 'error') {
            const message = String(data.message || 'Online match error');
            if (
              data.code === 'AUTH_REQUIRED' ||
              message.includes('Sign in required') ||
              message.includes('does not exist') ||
              message.includes('two assigned players')
            ) {
              this.persistRoomSession(null);
              this.clearReconnectTimer();
            }
            this.emitError(message);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        if (!this.activeRoom) {
          this.emitError('Unable to reach multiplayer server.');
        }
        reject(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
        }
        if (!this.manualDisconnect && this.activeRoom?.roomCode) {
          this.scheduleReconnect();
        } else {
          this.emitConn(false, false);
        }
      };
    });
  }

  public async createRoom(
    playerName: string,
    colorPref: ColorPreference,
    timeControl: TimeControl
  ): Promise<void> {
    this.manualDisconnect = false;
    this.reconnectAttempts = 0;
    this.persistRoomSession(null);
    const ws = await this.connect();
    this.activeRoom = { roomCode: '', playerName };
    ws.send(
      JSON.stringify({
        type: 'create_room',
        playerName,
        colorPref,
        timeControl,
        sessionId: this.getSessionId(),
      })
    );
  }

  public async joinRoom(roomCode: string, playerName: string): Promise<void> {
    const cleanCode = roomCode.trim().toUpperCase();
    this.manualDisconnect = false;
    this.persistRoomSession({ roomCode: cleanCode, playerName });
    const ws = await this.connect();
    ws.send(
      JSON.stringify({
        type: 'join_room',
        roomCode: cleanCode,
        playerName,
        sessionId: this.getSessionId(),
      })
    );
  }

  public sendMove(from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'make_move', from, to, promotion }));
  }

  public resign(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'resign' }));
  }

  public offerDraw(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'offer_draw' }));
  }

  public respondDraw(accept: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'respond_draw', accept }));
  }

  public requestRematch(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'rematch' }));
  }

  public disconnect(): void {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.persistRoomSession(null);
    if (this.ws) {
      const sock = this.ws;
      this.ws = null;
      sock.onclose = null;
      sock.close();
    }
    this.assignedColor = null;
    this.currentRoom = null;
    this.emitConn(false, false);
  }

  public getAssignedColor(): PieceColor | null {
    return this.assignedColor;
  }

  public getCurrentRoom(): OnlineRoomSnapshot | null {
    return this.currentRoom;
  }

  public onRoomUpdate(cb: RoomUpdateListener): () => void {
    this.roomListeners.add(cb);
    return () => this.roomListeners.delete(cb);
  }

  public onError(cb: ErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  public onConnectionChange(cb: ConnectionListener): () => void {
    this.connListeners.add(cb);
    return () => this.connListeners.delete(cb);
  }

  private emitRoom(room: OnlineRoomSnapshot, color: PieceColor | null) {
    this.roomListeners.forEach((cb) => cb(room, color));
  }

  private emitError(msg: string) {
    this.errorListeners.forEach((cb) => cb(msg));
  }

  private emitConn(connected: boolean, reconnecting: boolean) {
    this.connListeners.forEach((cb) => cb(connected, reconnecting));
  }
}

export const onlineService = new OnlineMultiplayerClient();
