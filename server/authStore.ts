import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type PreferredSide = 'w' | 'b' | 'random';

export interface UserSettings {
  defaultTimeId: string;
  soundEnabled: boolean;
  autoFlipLocal: boolean;
  showCoordinates: boolean;
  animatePieces: boolean;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  preferredSide: PreferredSide;
  titleBadge: string;
  createdAt: number;
  settings: UserSettings;
}

export interface StoredUserRecord extends PublicUser {
  passwordHash: string;
  tokenVersion?: number;
}

export interface StoredMatchRecord {
  id: string;
  userId: string;
  timestamp: number;
  mode: 'ai' | 'local' | 'online';
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  whiteName: string;
  blackName: string;
  playerColor?: 'w' | 'b';
  winner: 'w' | 'b' | 'draw';
  termination: string;
  reasonLabel: string;
  totalPlies: number;
  timeControlLabel: string;
  pgn: string;
  finalFen: string;
}

export interface UserStats {
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  winRatePct: number;
  avgMoves: number;
  favoriteMode: 'ai' | 'local' | 'online' | null;
}

interface PersistedDatabase {
  version: 1;
  users: StoredUserRecord[];
  matches: StoredMatchRecord[];
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultTimeId: 'rapid-10-0',
  soundEnabled: true,
  autoFlipLocal: false,
  showCoordinates: true,
  animatePieces: true,
};

const VALID_TIME_IDS = new Set([
  'bullet-1-0',
  'blitz-3-2',
  'blitz-5-0',
  'rapid-10-0',
  'classical-15-10',
  'untimed',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const MAX_PASSWORD_LENGTH = 128;
const DUMMY_PASSWORD_HASH =
  '00112233445566778899aabbccddeeff:' +
  '0'.repeat(128);

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export function sanitizePublicUser(record: StoredUserRecord): PublicUser {
  return {
    id: record.id,
    email: record.email,
    username: record.username,
    displayName: record.displayName,
    bio: record.bio,
    preferredSide: record.preferredSide,
    titleBadge: record.titleBadge,
    createdAt: record.createdAt,
    settings: { ...record.settings },
  };
}

export function computeUserStats(matches: StoredMatchRecord[]): UserStats {
  if (matches.length === 0) {
    return {
      totalGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRatePct: 0,
      avgMoves: 0,
      favoriteMode: null,
    };
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalFullMoves = 0;
  const modeCounts: Record<'ai' | 'local' | 'online', number> = {
    ai: 0,
    local: 0,
    online: 0,
  };

  for (const m of matches) {
    modeCounts[m.mode] = (modeCounts[m.mode] || 0) + 1;
    totalFullMoves += Math.ceil((m.totalPlies || 0) / 2);

    if (m.winner === 'draw') {
      draws += 1;
    } else if (m.playerColor === 'w' || m.playerColor === 'b') {
      if (m.winner === m.playerColor) wins += 1;
      else losses += 1;
    } else {
      // Local pass-and-play without single-side assignment counts toward played total; treat White perspective cleanly only when assigned
      if (m.winner === 'w') wins += 1;
      else losses += 1;
    }
  }

  const totalGames = matches.length;
  const winRatePct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const avgMoves = Math.round(totalFullMoves / totalGames);

  let favoriteMode: 'ai' | 'local' | 'online' | null = null;
  let maxCount = 0;
  for (const mode of ['ai', 'online', 'local'] as const) {
    if (modeCounts[mode] > maxCount) {
      maxCount = modeCounts[mode];
      favoriteMode = mode;
    }
  }

  return {
    totalGames,
    wins,
    draws,
    losses,
    winRatePct,
    avgMoves,
    favoriteMode,
  };
}

export class AuthPersistenceStore {
  private readonly dataDir: string;
  private readonly storePath: string;
  private readonly secret: string;
  private db: PersistedDatabase;

  constructor(options?: { dataDir?: string; secret?: string }) {
    this.dataDir = path.resolve(
      options?.dataDir || process.env.DATA_DIR || path.join(process.cwd(), 'data')
    );
    this.storePath = path.join(this.dataDir, 'monssif-store.json');
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.secret = this.loadOrCreateSecret(options?.secret || process.env.AUTH_SECRET);
    this.db = this.loadDatabase();
  }

  private loadOrCreateSecret(explicit?: string): string {
    if (explicit && explicit.trim().length >= 16) {
      return explicit.trim();
    }
    const secretFile = path.join(this.dataDir, '.auth-secret');
    try {
      if (fs.existsSync(secretFile)) {
        const existing = fs.readFileSync(secretFile, 'utf8').trim();
        if (existing.length >= 32) return existing;
      }
    } catch {
      // Fall through to generate a new secret
    }
    const generated = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    } catch {
      // Non-fatal in read-only edge cases
    }
    return generated;
  }

  private loadDatabase(): PersistedDatabase {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.matches)) {
          return {
            version: 1,
            users: parsed.users,
            matches: parsed.matches,
          };
        }
      }
    } catch {
      // Corrupted or missing file falls back cleanly
    }
    return { version: 1, users: [], matches: [] };
  }

  private persist(): void {
    const tmpPath = `${this.storePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.db, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, this.storePath);
  }

  public createSessionToken(userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000): string {
    const user = this.db.users.find((u) => u.id === userId);
    const tokenVersion = user?.tokenVersion ?? 1;
    const exp = Date.now() + ttlMs;
    const payload = Buffer.from(
      JSON.stringify({ uid: userId, tv: tokenVersion, exp }),
      'utf8'
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  public verifySessionToken(token: string | undefined | null): string | null {
    if (!token || typeof token !== 'string') return null;
    const dotIdx = token.indexOf('.');
    if (dotIdx <= 0) return null;
    const payload = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    if (!payload || !sig) return null;

    const expectedSig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        uid?: string;
        tv?: number;
        exp?: number;
      };
      if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
        return null;
      }
      const user = this.db.users.find((u) => u.id === parsed.uid);
      if (!user) return null;
      const currentVersion = user.tokenVersion ?? 1;
      const tokenVersion = typeof parsed.tv === 'number' ? parsed.tv : 1;
      if (tokenVersion !== currentVersion) {
        return null;
      }
      return parsed.uid;
    } catch {
      return null;
    }
  }

  public revokeUserSessions(userId: string): void {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return;
    user.tokenVersion = (user.tokenVersion ?? 1) + 1;
    this.persist();
  }

  public registerUser(input: {
    email: string;
    username: string;
    displayName?: string;
    password: string;
  }): { ok: true; user: PublicUser } | { ok: false; status: number; error: string } {
    const email = String(input.email || '').trim().toLowerCase();
    const username = String(input.username || '').trim();
    const displayName = String(input.displayName || username).trim().slice(0, 32) || username;
    const password = String(input.password || '');

    if (!EMAIL_RE.test(email)) {
      return { ok: false, status: 400, error: 'Please enter a valid email address.' };
    }
    if (!USERNAME_RE.test(username)) {
      return {
        ok: false,
        status: 400,
        error: 'Username must be 3–20 characters (letters, numbers, or underscores).',
      };
    }
    if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
      return {
        ok: false,
        status: 400,
        error: `Password must be 8–${MAX_PASSWORD_LENGTH} characters long.`,
      };
    }

    const emailExists = this.db.users.some((u) => u.email === email);
    if (emailExists) {
      return { ok: false, status: 409, error: 'An account with this email already exists.' };
    }
    const usernameExists = this.db.users.some(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (usernameExists) {
      return { ok: false, status: 409, error: 'This username is already taken.' };
    }

    const record: StoredUserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      email,
      username,
      displayName,
      bio: '',
      preferredSide: 'random',
      titleBadge: 'Club Player',
      createdAt: Date.now(),
      settings: { ...DEFAULT_USER_SETTINGS },
      passwordHash: hashPassword(password),
      tokenVersion: 1,
    };

    this.db.users.push(record);
    this.persist();
    return { ok: true, user: sanitizePublicUser(record) };
  }

  public authenticateUser(input: {
    identifier: string;
    password: string;
  }): { ok: true; user: PublicUser } | { ok: false; status: number; error: string } {
    const identifier = String(input.identifier || '').trim().toLowerCase();
    const password = String(input.password || '');

    if (!identifier || !password) {
      return { ok: false, status: 400, error: 'Email/username and password are required.' };
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return { ok: false, status: 401, error: 'Invalid credentials. Please check your details.' };
    }

    const found = this.db.users.find(
      (u) => u.email === identifier || u.username.toLowerCase() === identifier
    );
    // Always run scrypt verify to keep response timing uniform whether account exists or not
    const valid = verifyPassword(password, found ? found.passwordHash : DUMMY_PASSWORD_HASH);
    if (!found || !valid) {
      return { ok: false, status: 401, error: 'Invalid credentials. Please check your details.' };
    }

    return { ok: true, user: sanitizePublicUser(found) };
  }

  public getUserById(userId: string): PublicUser | null {
    const found = this.db.users.find((u) => u.id === userId);
    return found ? sanitizePublicUser(found) : null;
  }

  public updateProfile(
    userId: string,
    patch: {
      displayName?: string;
      bio?: string;
      preferredSide?: PreferredSide;
      titleBadge?: string;
    }
  ): { ok: true; user: PublicUser } | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return { ok: false, status: 404, error: 'Account not found.' };

    if (patch.displayName !== undefined) {
      const cleanName = String(patch.displayName).trim().slice(0, 32);
      if (cleanName.length < 2) {
        return { ok: false, status: 400, error: 'Display name must be at least 2 characters.' };
      }
      user.displayName = cleanName;
    }

    if (patch.bio !== undefined) {
      user.bio = String(patch.bio).trim().slice(0, 180);
    }

    if (patch.preferredSide !== undefined) {
      if (
        patch.preferredSide === 'w' ||
        patch.preferredSide === 'b' ||
        patch.preferredSide === 'random'
      ) {
        user.preferredSide = patch.preferredSide;
      }
    }

    if (patch.titleBadge !== undefined) {
      user.titleBadge = String(patch.titleBadge).trim().slice(0, 24) || 'Club Player';
    }

    this.persist();
    return { ok: true, user: sanitizePublicUser(user) };
  }

  public updateSettings(
    userId: string,
    patch: Partial<UserSettings> & { currentPassword?: string; newPassword?: string }
  ): { ok: true; user: PublicUser } | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return { ok: false, status: 404, error: 'Account not found.' };

    if (patch.newPassword !== undefined && patch.newPassword !== '') {
      if (
        !patch.currentPassword ||
        patch.currentPassword.length > MAX_PASSWORD_LENGTH ||
        !verifyPassword(patch.currentPassword, user.passwordHash)
      ) {
        return { ok: false, status: 400, error: 'Current password is incorrect.' };
      }
      if (patch.newPassword.length < 8 || patch.newPassword.length > MAX_PASSWORD_LENGTH) {
        return {
          ok: false,
          status: 400,
          error: `New password must be 8–${MAX_PASSWORD_LENGTH} characters.`,
        };
      }
      user.passwordHash = hashPassword(patch.newPassword);
      user.tokenVersion = (user.tokenVersion ?? 1) + 1;
    }

    if (patch.defaultTimeId !== undefined && VALID_TIME_IDS.has(patch.defaultTimeId)) {
      user.settings.defaultTimeId = patch.defaultTimeId;
    }
    if (typeof patch.soundEnabled === 'boolean') {
      user.settings.soundEnabled = patch.soundEnabled;
    }
    if (typeof patch.autoFlipLocal === 'boolean') {
      user.settings.autoFlipLocal = patch.autoFlipLocal;
    }
    if (typeof patch.showCoordinates === 'boolean') {
      user.settings.showCoordinates = patch.showCoordinates;
    }
    if (typeof patch.animatePieces === 'boolean') {
      user.settings.animatePieces = patch.animatePieces;
    }

    this.persist();
    return { ok: true, user: sanitizePublicUser(user) };
  }

  public getUserMatches(userId: string): StoredMatchRecord[] {
    return this.db.matches
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
  }

  public saveUserMatch(
    userId: string,
    match: Omit<StoredMatchRecord, 'id' | 'userId'>
  ): { ok: true; match: StoredMatchRecord; matches: StoredMatchRecord[]; stats: UserStats } | { ok: false; status: number; error: string } {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) return { ok: false, status: 404, error: 'Account not found.' };

    const validModes = new Set(['ai', 'local', 'online']);
    const validWinners = new Set(['w', 'b', 'draw']);
    const validDifficulties = new Set(['easy', 'medium', 'hard', 'expert']);

    if (!validModes.has(String(match.mode))) {
      return { ok: false, status: 400, error: 'Invalid match mode.' };
    }
    if (!validWinners.has(String(match.winner))) {
      return { ok: false, status: 400, error: 'Invalid match winner.' };
    }

    const difficulty =
      match.difficulty && validDifficulties.has(String(match.difficulty))
        ? match.difficulty
        : undefined;

    const pliesRaw = Number(match.totalPlies);
    const totalPlies = Number.isFinite(pliesRaw) ? Math.max(0, Math.min(2000, Math.floor(pliesRaw))) : 0;

    const record: StoredMatchRecord = {
      id: `m_${crypto.randomUUID()}`,
      userId,
      timestamp: Number.isFinite(Number(match.timestamp)) ? Number(match.timestamp) : Date.now(),
      mode: match.mode,
      difficulty,
      whiteName: String(match.whiteName || 'White').trim().slice(0, 32) || 'White',
      blackName: String(match.blackName || 'Black').trim().slice(0, 32) || 'Black',
      playerColor: match.playerColor === 'w' || match.playerColor === 'b' ? match.playerColor : undefined,
      winner: match.winner,
      termination: String(match.termination || 'resignation').trim().slice(0, 32),
      reasonLabel: String(match.reasonLabel || '').trim().slice(0, 80),
      totalPlies,
      timeControlLabel: String(match.timeControlLabel || '10 + 0').trim().slice(0, 24),
      pgn: String(match.pgn || '').slice(0, 16384),
      finalFen: String(match.finalFen || '').slice(0, 128),
    };

    this.db.matches.unshift(record);
    // Cap per-user history cleanly to 100 entries
    let seenForUser = 0;
    this.db.matches = this.db.matches.filter((item) => {
      if (item.userId !== userId) return true;
      seenForUser += 1;
      return seenForUser <= 100;
    });
    this.persist();

    const matches = this.getUserMatches(userId);
    return {
      ok: true,
      match: record,
      matches,
      stats: computeUserStats(matches),
    };
  }

  public clearUserMatches(userId: string): void {
    this.db.matches = this.db.matches.filter((m) => m.userId !== userId);
    this.persist();
  }
}
