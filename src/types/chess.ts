export type ScreenId = 'dashboard' | 'modes' | 'ai-setup' | 'game' | 'result' | 'account';

export type GameMode = 'ai' | 'local' | 'online';

export type PieceColor = 'w' | 'b';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type ColorPreference = 'w' | 'b' | 'random';

export interface TimeControl {
  id: string;
  label: string;
  category: 'Bullet' | 'Blitz' | 'Rapid' | 'Classical' | 'Untimed';
  initialMs: number;
  incrementMs: number;
}

export interface BoardPiece {
  square: string;
  type: PieceType;
  color: PieceColor;
}

export interface MoveRecord {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: PieceColor;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  fenAfter: string;
  evalCp?: number | null;
  evalMate?: number | null;
}

export interface MovePair {
  moveNumber: number;
  white?: MoveRecord;
  black?: MoveRecord;
}

export interface CapturedState {
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  whiteAdvantage: number;
}

export type GameTermination =
  | 'checkmate'
  | 'stalemate'
  | 'resignation'
  | 'timeout'
  | 'draw_agreement'
  | 'threefold_repetition'
  | 'insufficient_material'
  | 'fifty_move_rule'
  | 'abandoned';

export interface GameResult {
  winner: PieceColor | 'draw';
  termination: GameTermination;
  reasonLabel: string;
  totalPlies: number;
  durationMs: number;
  pgn: string;
  finalFen: string;
  whiteName: string;
  blackName: string;
  mode: GameMode;
  difficulty?: AIDifficulty;
  playerColor?: PieceColor;
  timestamp: number;
}

export interface MatchConfig {
  mode: GameMode;
  playerColor: PieceColor;
  difficulty: AIDifficulty;
  timeControl: TimeControl;
  whiteName: string;
  blackName: string;
  autoFlipLocal?: boolean;
  roomCode?: string;
}

export interface CompletedMatchSnapshot {
  config: MatchConfig;
  result: GameResult;
  fen: string;
  moves: MoveRecord[];
  whiteTimeMs: number;
  blackTimeMs: number;
  flipped: boolean;
}

export interface SavedMatchRecord {
  id: string;
  timestamp: number;
  mode: GameMode;
  difficulty?: AIDifficulty;
  whiteName: string;
  blackName: string;
  playerColor?: PieceColor;
  winner: PieceColor | 'draw';
  termination: GameTermination;
  reasonLabel: string;
  totalPlies: number;
  timeControlLabel: string;
  pgn: string;
  finalFen: string;
  isSample?: boolean;
}

export interface EngineEval {
  cp: number | null;
  mate: number | null;
  depth: number;
  bestMoveUci?: string;
}

export interface OnlineRoomSnapshot {
  roomCode: string;
  status: 'waiting' | 'playing' | 'finished';
  fen: string;
  pgn: string;
  turn: PieceColor;
  moves: MoveRecord[];
  whiteConnected: boolean;
  blackConnected: boolean;
  whiteName: string;
  blackName: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  timeControl: TimeControl;
  drawOfferFrom: PieceColor | null;
  result: Omit<GameResult, 'durationMs'> | null;
  lastMoveAt: number | null;
}

export interface UserSettings {
  defaultTimeId: string;
  soundEnabled: boolean;
  autoFlipLocal: boolean;
  showCoordinates: boolean;
  animatePieces: boolean;
}

export interface PlayerUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  preferredSide: ColorPreference;
  titleBadge: string;
  createdAt: number;
  settings: UserSettings;
}

export interface PlayerStats {
  totalGames: number;
  wins: number;
  draws: number;
  losses: number;
  winRatePct: number;
  avgMoves: number;
  favoriteMode: GameMode | null;
}

export type MoveClassification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface AnalyzedMoveFrame {
  ply: number;
  san: string;
  color: PieceColor;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  evalBeforeCp: number | null;
  evalBeforeMate: number | null;
  evalAfterCp: number | null;
  evalAfterMate: number | null;
  cpLoss: number;
  classification: MoveClassification;
  bestMoveSan?: string;
  bestMoveUci?: string;
}

export interface GameAnalysisReport {
  frames: AnalyzedMoveFrame[];
  evalSeries: { ply: number; cpWhite: number; label: string }[];
  whiteAccuracy: number;
  blackAccuracy: number;
  counts: {
    w: Record<MoveClassification, number>;
    b: Record<MoveClassification, number>;
  };
  depth: number;
  completedAt: number;
}
