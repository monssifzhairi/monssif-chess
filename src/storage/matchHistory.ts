import type { GameResult, SavedMatchRecord } from '../types/chess';

const STORAGE_KEY = 'monssif_chess_match_history_v1';

export function loadMatchHistory(): SavedMatchRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveMatchResult(result: GameResult, timeControlLabel: string): SavedMatchRecord[] {
  const existing = loadMatchHistory();
  const record: SavedMatchRecord = {
    id: `match-${result.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: result.timestamp,
    mode: result.mode,
    difficulty: result.difficulty,
    whiteName: result.whiteName,
    blackName: result.blackName,
    winner: result.winner,
    termination: result.termination,
    reasonLabel: result.reasonLabel,
    totalPlies: result.totalPlies,
    timeControlLabel,
    pgn: result.pgn,
    finalFen: result.finalFen,
  };
  const updated = [record, ...existing].slice(0, 25);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota issues cleanly
  }
  return updated;
}

export function clearMatchHistory(): SavedMatchRecord[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return [];
}
