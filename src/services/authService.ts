import type {
  ColorPreference,
  GameResult,
  PlayerStats,
  PlayerUser,
  SavedMatchRecord,
  UserSettings,
} from '../types/chess';

export interface AuthSessionResponse {
  user: PlayerUser | null;
  matches: SavedMatchRecord[];
  stats: PlayerStats;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // Ignore non-JSON body
  }

  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`);
  }

  return data as T;
}

export const authService = {
  fetchSession(): Promise<AuthSessionResponse> {
    return requestJson<AuthSessionResponse>('/api/auth/me');
  },

  register(payload: {
    email: string;
    username: string;
    displayName?: string;
    password: string;
  }): Promise<AuthSessionResponse> {
    return requestJson<AuthSessionResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { identifier: string; password: string }): Promise<AuthSessionResponse> {
    return requestJson<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async logout(): Promise<void> {
    await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },

  updateProfile(patch: {
    displayName?: string;
    bio?: string;
    preferredSide?: ColorPreference;
    titleBadge?: string;
  }): Promise<{ user: PlayerUser }> {
    return requestJson<{ user: PlayerUser }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  updateSettings(
    patch: Partial<UserSettings> & { currentPassword?: string; newPassword?: string }
  ): Promise<{ user: PlayerUser }> {
    return requestJson<{ user: PlayerUser }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  saveMatch(
    result: GameResult,
    timeControlLabel: string
  ): Promise<{ match: SavedMatchRecord; matches: SavedMatchRecord[]; stats: PlayerStats }> {
    return requestJson('/api/matches', {
      method: 'POST',
      body: JSON.stringify({
        timestamp: result.timestamp,
        mode: result.mode,
        difficulty: result.difficulty,
        whiteName: result.whiteName,
        blackName: result.blackName,
        playerColor: result.playerColor,
        winner: result.winner,
        termination: result.termination,
        reasonLabel: result.reasonLabel,
        totalPlies: result.totalPlies,
        timeControlLabel,
        pgn: result.pgn,
        finalFen: result.finalFen,
      }),
    });
  },

  clearMatches(): Promise<{ matches: SavedMatchRecord[]; stats: PlayerStats }> {
    return requestJson('/api/matches', { method: 'DELETE' });
  },
};
