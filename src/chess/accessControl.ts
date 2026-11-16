import type {GameMode} from '../types/chess';

export function canAccessGameMode(mode: GameMode, isAuthenticated: boolean): boolean {
  if (mode === 'ai') return true;
  return isAuthenticated;
}

export function getModeGateMessage(mode: GameMode): string {
  if (mode === 'online') {
    return 'Sign in or create an account to create or join Online Multiplayer rooms.';
  }
  if (mode === 'local') {
    return 'Sign in or create an account to unlock Local Pass & Play multiplayer.';
  }
  return '';
}
