import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Chess, type Square } from 'chess.js';
import { AuthPersistenceStore, computeUserStats } from './server/authStore.ts';
import { SlidingWindowRateLimiter } from './server/rateLimiter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type PieceColor = 'w' | 'b';

interface TimeControlPayload {
  id: string;
  label: string;
  category: 'Bullet' | 'Blitz' | 'Rapid' | 'Classical' | 'Untimed';
  initialMs: number;
  incrementMs: number;
}

interface MoveRecordPayload {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: PieceColor;
  piece: string;
  captured?: string;
  promotion?: string;
  fenAfter: string;
}

interface RoomResultPayload {
  winner: PieceColor | 'draw';
  termination: string;
  reasonLabel: string;
  totalPlies: number;
  pgn: string;
  finalFen: string;
  whiteName: string;
  blackName: string;
  mode: 'online';
  timestamp: number;
}

interface RoomState {
  roomCode: string;
  status: 'waiting' | 'playing' | 'finished';
  chess: Chess;
  moves: MoveRecordPayload[];
  whiteSocket: WebSocket | null;
  blackSocket: WebSocket | null;
  whiteSessionId: string | null;
  blackSessionId: string | null;
  whiteName: string;
  blackName: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  timeControl: TimeControlPayload;
  drawOfferFrom: PieceColor | null;
  result: RoomResultPayload | null;
  lastMoveAt: number | null;
  clockInterval: NodeJS.Timeout | null;
}

const rooms = new Map<string, RoomState>();
const socketMeta = new WeakMap<WebSocket, { roomCode: string; color: PieceColor }>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function serializeRoom(room: RoomState) {
  return {
    roomCode: room.roomCode,
    status: room.status,
    fen: room.chess.fen(),
    pgn: room.chess.pgn(),
    turn: room.chess.turn(),
    moves: room.moves,
    whiteConnected: Boolean(room.whiteSocket && room.whiteSocket.readyState === WebSocket.OPEN),
    blackConnected: Boolean(room.blackSocket && room.blackSocket.readyState === WebSocket.OPEN),
    whiteName: room.whiteName,
    blackName: room.blackName,
    whiteTimeMs: room.whiteTimeMs,
    blackTimeMs: room.blackTimeMs,
    timeControl: room.timeControl,
    drawOfferFrom: room.drawOfferFrom,
    result: room.result,
    lastMoveAt: room.lastMoveAt,
  };
}

function broadcastRoom(room: RoomState, type = 'room_state') {
  const payload = JSON.stringify({ type, room: serializeRoom(room) });
  if (room.whiteSocket && room.whiteSocket.readyState === WebSocket.OPEN) {
    room.whiteSocket.send(payload);
  }
  if (room.blackSocket && room.blackSocket.readyState === WebSocket.OPEN) {
    room.blackSocket.send(payload);
  }
}

function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'error', message }));
  }
}

function finishRoom(room: RoomState, winner: PieceColor | 'draw', termination: string, reasonLabel: string) {
  room.status = 'finished';
  room.drawOfferFrom = null;
  if (room.clockInterval) {
    clearInterval(room.clockInterval);
    room.clockInterval = null;
  }
  room.result = {
    winner,
    termination,
    reasonLabel,
    totalPlies: room.moves.length,
    pgn: room.chess.pgn(),
    finalFen: room.chess.fen(),
    whiteName: room.whiteName,
    blackName: room.blackName,
    mode: 'online',
    timestamp: Date.now(),
  };
  broadcastRoom(room);
}

function ensureClockLoop(room: RoomState) {
  if (room.timeControl.initialMs <= 0 || room.clockInterval) return;
  room.lastMoveAt = Date.now();
  room.clockInterval = setInterval(() => {
    if (room.status !== 'playing' || !room.lastMoveAt || room.moves.length === 0) {
      room.lastMoveAt = Date.now();
      return;
    }
    const now = Date.now();
    const delta = now - room.lastMoveAt;
    room.lastMoveAt = now;
    const activeTurn = room.chess.turn();
    if (activeTurn === 'w') {
      room.whiteTimeMs = Math.max(0, room.whiteTimeMs - delta);
      if (room.whiteTimeMs <= 0) {
        finishRoom(room, 'b', 'timeout', 'White Flagged · Time Out');
      }
    } else {
      room.blackTimeMs = Math.max(0, room.blackTimeMs - delta);
      if (room.blackTimeMs <= 0) {
        finishRoom(room, 'w', 'timeout', 'Black Flagged · Time Out');
      }
    }
  }, 500);
}

const SESSION_COOKIE_NAME = 'monssif_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const maxAgeSec = 7 * 24 * 60 * 60;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function sanitizeTimeControl(raw: unknown): TimeControlPayload {
  const fallback: TimeControlPayload = {
    id: 'rapid-10-0',
    label: '10 + 0',
    category: 'Rapid',
    initialMs: 600_000,
    incrementMs: 0,
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const initialMsRaw = Number(obj.initialMs);
  const incMsRaw = Number(obj.incrementMs);
  const initialMs = Number.isFinite(initialMsRaw) ? Math.max(0, Math.min(7_200_000, Math.round(initialMsRaw))) : fallback.initialMs;
  const incrementMs = Number.isFinite(incMsRaw) ? Math.max(0, Math.min(120_000, Math.round(incMsRaw))) : 0;
  const validCategories = new Set(['Bullet', 'Blitz', 'Rapid', 'Classical', 'Untimed']);
  const category = validCategories.has(String(obj.category))
    ? (String(obj.category) as TimeControlPayload['category'])
    : fallback.category;
  return {
    id: String(obj.id || fallback.id).slice(0, 32),
    label: String(obj.label || fallback.label).slice(0, 24),
    category,
    initialMs,
    incrementMs,
  };
}

function isSameOriginUrl(candidateUrl: string, req: express.Request): boolean {
  try {
    const parsed = new URL(candidateUrl);
    const reqHost = req.get('host')?.toLowerCase();
    if (reqHost && parsed.host.toLowerCase() === reqHost) {
      return true;
    }
    if (process.env.APP_URL) {
      try {
        const configured = new URL(process.env.APP_URL);
        if (parsed.origin === configured.origin) return true;
      } catch {
        // Ignore malformed APP_URL
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Defensive security headers (iframe-compatible for AI Studio preview)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Same-origin CSRF check on mutating API routes
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    const origin = req.get('origin');
    if (origin) {
      if (!isSameOriginUrl(origin, req)) {
        res.status(403).json({ error: 'Cross-origin request blocked.' });
        return;
      }
    } else {
      const referer = req.get('referer');
      if (referer && !isSameOriginUrl(referer, req)) {
        res.status(403).json({ error: 'Cross-origin request blocked.' });
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  const authStore = new AuthPersistenceStore();
  const authRateLimiter = new SlidingWindowRateLimiter({
    maxRequests: 15,
    windowMs: 60_000,
  });
  const wsRoomRateLimiter = new SlidingWindowRateLimiter({
    maxRequests: 15,
    windowMs: 60_000,
  });

  const requireAuthRateLimit: express.RequestHandler = (req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const check = authRateLimiter.consume(clientIp);
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      res.status(429).json({
        error: `Too many authentication attempts. Please wait ${check.retryAfterSec}s and try again.`,
      });
      return;
    }
    next();
  };

  const getAuthenticatedUserId = (req: express.Request): string | null => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE_NAME];
    return authStore.verifySessionToken(token);
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/auth/me', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.json({ user: null, matches: [], stats: computeUserStats([]) });
      return;
    }
    const user = authStore.getUserById(userId);
    if (!user) {
      clearSessionCookie(req, res);
      res.json({ user: null, matches: [], stats: computeUserStats([]) });
      return;
    }
    const matches = authStore.getUserMatches(user.id);
    res.json({ user, matches, stats: computeUserStats(matches) });
  });

  app.post('/api/auth/register', requireAuthRateLimit, (req, res) => {
    const result = authStore.registerUser({
      email: String(req.body?.email || ''),
      username: String(req.body?.username || ''),
      displayName: req.body?.displayName ? String(req.body.displayName) : undefined,
      password: String(req.body?.password || ''),
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const token = authStore.createSessionToken(result.user.id);
    setSessionCookie(req, res, token);
    res.status(201).json({
      user: result.user,
      matches: [],
      stats: computeUserStats([]),
    });
  });

  app.post('/api/auth/login', requireAuthRateLimit, (req, res) => {
    const result = authStore.authenticateUser({
      identifier: String(req.body?.identifier || ''),
      password: String(req.body?.password || ''),
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const token = authStore.createSessionToken(result.user.id);
    setSessionCookie(req, res, token);
    const matches = authStore.getUserMatches(result.user.id);
    res.json({
      user: result.user,
      matches,
      stats: computeUserStats(matches),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (userId) {
      authStore.revokeUserSessions(userId);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.patch('/api/profile', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const result = authStore.updateProfile(userId, {
      displayName: req.body?.displayName,
      bio: req.body?.bio,
      preferredSide: req.body?.preferredSide,
      titleBadge: req.body?.titleBadge,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  app.patch('/api/settings', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const passwordChanged =
      typeof req.body?.newPassword === 'string' && req.body.newPassword.length > 0;
    const result = authStore.updateSettings(userId, {
      defaultTimeId: req.body?.defaultTimeId,
      soundEnabled: req.body?.soundEnabled,
      autoFlipLocal: req.body?.autoFlipLocal,
      showCoordinates: req.body?.showCoordinates,
      animatePieces: req.body?.animatePieces,
      currentPassword: req.body?.currentPassword,
      newPassword: req.body?.newPassword,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    if (passwordChanged) {
      // Rotate session cookie to new tokenVersion so current session continues cleanly while old tokens are revoked
      const freshToken = authStore.createSessionToken(result.user.id);
      setSessionCookie(req, res, freshToken);
    }
    res.json({ user: result.user });
  });

  app.get('/api/matches', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const matches = authStore.getUserMatches(userId);
    res.json({ matches, stats: computeUserStats(matches) });
  });

  app.post('/api/matches', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const result = authStore.saveUserMatch(userId, req.body || {});
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json({
      match: result.match,
      matches: result.matches,
      stats: result.stats,
    });
  });

  app.delete('/api/matches', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    authStore.clearUserMatches(userId);
    res.json({ matches: [], stats: computeUserStats([]) });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json({ room: serializeRoom(room) });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 32 * 1024,
  });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const cookies = parseCookies(req.headers.cookie);
    const wsUserId = authStore.verifySessionToken(cookies[SESSION_COOKIE_NAME]);
    const wsUser = wsUserId ? authStore.getUserById(wsUserId) : null;

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendError(ws, 'Invalid message format');
        return;
      }

      if (!wsUser) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'AUTH_REQUIRED',
              message: 'Sign in required for online multiplayer.',
            })
          );
        }
        return;
      }

      const type = String(msg.type || '');

      if (type === 'create_room') {
        const roomCheck = wsRoomRateLimiter.consume(clientIp);
        if (!roomCheck.allowed) {
          sendError(ws, `Too many rooms created. Please wait ${roomCheck.retryAfterSec}s.`);
          return;
        }
        const playerName =
          String(msg.playerName || wsUser.displayName || 'Player 1').trim().slice(0, 24) ||
          wsUser.displayName;
        const sessionId = String(msg.sessionId || '').trim().slice(0, 64) || generateRoomCode();
        const colorPref = msg.colorPref === 'b' ? 'b' : msg.colorPref === 'w' ? 'w' : Math.random() < 0.5 ? 'w' : 'b';
        const tc = sanitizeTimeControl(msg.timeControl);

        const roomCode = generateRoomCode();
        const room: RoomState = {
          roomCode,
          status: 'waiting',
          chess: new Chess(),
          moves: [],
          whiteSocket: colorPref === 'w' ? ws : null,
          blackSocket: colorPref === 'b' ? ws : null,
          whiteSessionId: colorPref === 'w' ? sessionId : null,
          blackSessionId: colorPref === 'b' ? sessionId : null,
          whiteName: colorPref === 'w' ? playerName : 'Awaiting Opponent',
          blackName: colorPref === 'b' ? playerName : 'Awaiting Opponent',
          whiteTimeMs: tc.initialMs,
          blackTimeMs: tc.initialMs,
          timeControl: tc,
          drawOfferFrom: null,
          result: null,
          lastMoveAt: null,
          clockInterval: null,
        };
        rooms.set(roomCode, room);
        socketMeta.set(ws, { roomCode, color: colorPref });
        ws.send(JSON.stringify({ type: 'room_joined', assignedColor: colorPref, room: serializeRoom(room) }));
        return;
      }

      if (type === 'join_room') {
        const code = String(msg.roomCode || '').trim().toUpperCase();
        const playerName = String(msg.playerName || 'Opponent').trim().slice(0, 24) || 'Opponent';
        const sessionId = String(msg.sessionId || '').trim().slice(0, 64);
        const room = rooms.get(code);
        if (!room) {
          sendError(ws, `Room "${code}" does not exist.`);
          return;
        }

        let assignedColor: PieceColor | null = null;

        // 1. Returning session always reclaims its exact original seat
        if (sessionId && room.whiteSessionId === sessionId) {
          assignedColor = 'w';
          if (room.whiteSocket && room.whiteSocket !== ws && room.whiteSocket.readyState === WebSocket.OPEN) {
            room.whiteSocket.close();
          }
          room.whiteSocket = ws;
        } else if (sessionId && room.blackSessionId === sessionId) {
          assignedColor = 'b';
          if (room.blackSocket && room.blackSocket !== ws && room.blackSocket.readyState === WebSocket.OPEN) {
            room.blackSocket.close();
          }
          room.blackSocket = ws;
        } else if (room.whiteSessionId === null) {
          // 2. Unclaimed seat only — never let a new player steal a disconnected opponent's seat
          assignedColor = 'w';
          room.whiteSessionId = sessionId || generateRoomCode();
          room.whiteSocket = ws;
          room.whiteName = playerName;
        } else if (room.blackSessionId === null) {
          assignedColor = 'b';
          room.blackSessionId = sessionId || generateRoomCode();
          room.blackSocket = ws;
          room.blackName = playerName;
        } else {
          sendError(ws, 'This room already has two assigned players.');
          return;
        }

        socketMeta.set(ws, { roomCode: code, color: assignedColor });
        if (room.whiteSessionId && room.blackSessionId && room.status === 'waiting') {
          room.status = 'playing';
        }
        if (room.status === 'playing') {
          ensureClockLoop(room);
        }

        ws.send(JSON.stringify({ type: 'room_joined', assignedColor, room: serializeRoom(room) }));
        broadcastRoom(room);
        return;
      }

      const meta = socketMeta.get(ws);
      if (!meta) {
        sendError(ws, 'You are not connected to a match room.');
        return;
      }
      const room = rooms.get(meta.roomCode);
      if (!room) {
        sendError(ws, 'Match room expired.');
        return;
      }

      if (type === 'make_move') {
        if (room.status !== 'playing') {
          sendError(ws, 'Game is not currently active.');
          return;
        }
        if (room.chess.turn() !== meta.color) {
          sendError(ws, 'It is not your turn.');
          return;
        }

        const from = String(msg.from || '') as Square;
        const to = String(msg.to || '') as Square;
        const promotion =
          msg.promotion === 'q' || msg.promotion === 'r' || msg.promotion === 'b' || msg.promotion === 'n'
            ? msg.promotion
            : undefined;

        const now = Date.now();
        if (room.timeControl.initialMs > 0 && room.moves.length > 0 && room.lastMoveAt) {
          const elapsed = now - room.lastMoveAt;
          if (meta.color === 'w') {
            room.whiteTimeMs = Math.max(0, room.whiteTimeMs - elapsed);
            if (room.whiteTimeMs <= 0) {
              finishRoom(room, 'b', 'timeout', 'White Flagged · Time Out');
              return;
            }
          } else {
            room.blackTimeMs = Math.max(0, room.blackTimeMs - elapsed);
            if (room.blackTimeMs <= 0) {
              finishRoom(room, 'w', 'timeout', 'Black Flagged · Time Out');
              return;
            }
          }
        }

        let moveResult;
        try {
          moveResult = room.chess.move({ from, to, promotion });
        } catch {
          sendError(ws, 'Illegal move.');
          return;
        }
        if (!moveResult) {
          sendError(ws, 'Illegal move.');
          return;
        }

        if (room.timeControl.initialMs > 0) {
          if (meta.color === 'w') {
            room.whiteTimeMs += room.timeControl.incrementMs;
          } else {
            room.blackTimeMs += room.timeControl.incrementMs;
          }
          room.lastMoveAt = now;
        }

        room.drawOfferFrom = null;
        room.moves.push({
          ply: room.moves.length + 1,
          san: moveResult.san,
          from: moveResult.from,
          to: moveResult.to,
          color: moveResult.color,
          piece: moveResult.piece,
          captured: moveResult.captured,
          promotion: moveResult.promotion,
          fenAfter: room.chess.fen(),
        });

        if (room.chess.isGameOver()) {
          if (room.chess.isCheckmate()) {
            finishRoom(room, meta.color, 'checkmate', 'Checkmate');
          } else if (room.chess.isStalemate()) {
            finishRoom(room, 'draw', 'stalemate', 'Draw by Stalemate');
          } else if (room.chess.isThreefoldRepetition()) {
            finishRoom(room, 'draw', 'threefold_repetition', 'Draw by Threefold Repetition');
          } else if (room.chess.isInsufficientMaterial()) {
            finishRoom(room, 'draw', 'insufficient_material', 'Draw by Insufficient Material');
          } else {
            finishRoom(room, 'draw', 'fifty_move_rule', 'Draw by 50-Move Rule');
          }
          return;
        }

        broadcastRoom(room);
        return;
      }

      if (type === 'resign' && room.status === 'playing') {
        const winner: PieceColor = meta.color === 'w' ? 'b' : 'w';
        finishRoom(
          room,
          winner,
          'resignation',
          `${meta.color === 'w' ? 'White' : 'Black'} Resigned`
        );
        return;
      }

      if (type === 'offer_draw' && room.status === 'playing') {
        room.drawOfferFrom = meta.color;
        broadcastRoom(room);
        return;
      }

      if (type === 'respond_draw' && room.status === 'playing') {
        const accept = Boolean(msg.accept);
        if (room.drawOfferFrom && room.drawOfferFrom !== meta.color) {
          if (accept) {
            finishRoom(room, 'draw', 'draw_agreement', 'Draw by Mutual Agreement');
          } else {
            room.drawOfferFrom = null;
            broadcastRoom(room);
          }
        }
        return;
      }

      if (type === 'rematch' && room.status === 'finished') {
        const prevWhite = room.whiteSocket;
        const prevBlack = room.blackSocket;
        const prevWhiteSession = room.whiteSessionId;
        const prevBlackSession = room.blackSessionId;
        const prevWhiteName = room.whiteName;
        const prevBlackName = room.blackName;
        room.chess = new Chess();
        room.moves = [];
        room.whiteSocket = prevBlack;
        room.blackSocket = prevWhite;
        room.whiteSessionId = prevBlackSession;
        room.blackSessionId = prevWhiteSession;
        room.whiteName = prevBlackName;
        room.blackName = prevWhiteName;
        if (room.whiteSocket) socketMeta.set(room.whiteSocket, { roomCode: room.roomCode, color: 'w' });
        if (room.blackSocket) socketMeta.set(room.blackSocket, { roomCode: room.roomCode, color: 'b' });
        room.whiteTimeMs = room.timeControl.initialMs;
        room.blackTimeMs = room.timeControl.initialMs;
        room.drawOfferFrom = null;
        room.result = null;
        room.status = room.whiteSessionId && room.blackSessionId ? 'playing' : 'waiting';
        room.lastMoveAt = null;
        if (room.status === 'playing') {
          ensureClockLoop(room);
        }
        if (room.whiteSocket && room.whiteSocket.readyState === WebSocket.OPEN) {
          room.whiteSocket.send(
            JSON.stringify({ type: 'room_joined', assignedColor: 'w', room: serializeRoom(room) })
          );
        }
        if (room.blackSocket && room.blackSocket.readyState === WebSocket.OPEN) {
          room.blackSocket.send(
            JSON.stringify({ type: 'room_joined', assignedColor: 'b', room: serializeRoom(room) })
          );
        }
        broadcastRoom(room);
      }
    });

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (!meta) return;
      const room = rooms.get(meta.roomCode);
      if (!room) return;
      if (meta.color === 'w' && room.whiteSocket === ws) {
        room.whiteSocket = null;
      }
      if (meta.color === 'b' && room.blackSocket === ws) {
        room.blackSocket = null;
      }
      broadcastRoom(room);

      if (!room.whiteSocket && !room.blackSocket) {
        if (room.clockInterval) {
          clearInterval(room.clockInterval);
          room.clockInterval = null;
        }
        setTimeout(() => {
          const current = rooms.get(room.roomCode);
          if (current && !current.whiteSocket && !current.blackSocket) {
            rooms.delete(room.roomCode);
          }
        }, 60_000);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Sanitized Express error handler (never expose internal stack traces)
  app.use(
    (
      err: Error & { status?: number; type?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err?.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'Invalid JSON request payload.' });
        return;
      }
      const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
      res.status(status).json({
        error: status < 500 ? err.message || 'Bad request.' : 'Internal server error.',
      });
    }
  );

  const port = Number(process.env.PORT || 3000);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`MONSSIF CHESS server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MONSSIF CHESS server:', err);
  process.exit(1);
});
