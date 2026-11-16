import { Chess, Square } from 'chess.js';
import type {
  AIDifficulty,
  BoardPiece,
  CapturedState,
  ColorPreference,
  GameTermination,
  MovePair,
  MoveRecord,
  PieceColor,
  PieceType,
  TimeControl,
} from '../types/chess';

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'bullet-1-0', label: '1 + 0', category: 'Bullet', initialMs: 60_000, incrementMs: 0 },
  { id: 'blitz-3-2', label: '3 + 2', category: 'Blitz', initialMs: 180_000, incrementMs: 2_000 },
  { id: 'blitz-5-0', label: '5 + 0', category: 'Blitz', initialMs: 300_000, incrementMs: 0 },
  { id: 'rapid-10-0', label: '10 + 0', category: 'Rapid', initialMs: 600_000, incrementMs: 0 },
  { id: 'classical-15-10', label: '15 + 10', category: 'Classical', initialMs: 900_000, incrementMs: 10_000 },
  { id: 'untimed', label: 'Untimed', category: 'Untimed', initialMs: 0, incrementMs: 0 },
];

export interface DifficultyProfile {
  id: AIDifficulty;
  label: string;
  eloLabel: string;
  description: string;
  skillLevel: number;
  limitStrength: boolean;
  uciElo: number;
  depth: number;
  moveTimeMs: number;
}

export const DIFFICULTY_PROFILES: Record<AIDifficulty, DifficultyProfile> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    eloLabel: '~800 ELO',
    description: 'Relaxed tactical pressure for casual openings and learning.',
    skillLevel: 1,
    limitStrength: false,
    uciElo: 1320,
    depth: 2,
    moveTimeMs: 140,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    eloLabel: '~1350 ELO',
    description: 'Balanced club-level play with clean positional structure.',
    skillLevel: 8,
    limitStrength: true,
    uciElo: 1350,
    depth: 6,
    moveTimeMs: 320,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    eloLabel: '~1900 ELO',
    description: 'Sharp tactical calculation and punishing endgame accuracy.',
    skillLevel: 15,
    limitStrength: true,
    uciElo: 1900,
    depth: 11,
    moveTimeMs: 650,
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    eloLabel: 'Full Strength',
    description: 'Unrestricted Stockfish calculation for tournament preparation.',
    skillLevel: 20,
    limitStrength: false,
    uciElo: 2850,
    depth: 15,
    moveTimeMs: 1100,
  },
};

export function getDifficultyConfig(difficulty: AIDifficulty): DifficultyProfile {
  return DIFFICULTY_PROFILES[difficulty];
}

export function resolvePlayerColor(pref: ColorPreference): PieceColor {
  if (pref === 'w' || pref === 'b') return pref;
  return Math.random() < 0.5 ? 'w' : 'b';
}

export const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export function getOrderedSquares(flipped: boolean): string[] {
  const ranks = flipped ? [...RANKS].reverse() : RANKS;
  const files = flipped ? [...FILES].reverse() : FILES;
  const squares: string[] = [];
  for (const r of ranks) {
    for (const f of files) {
      squares.push(`${f}${r}`);
    }
  }
  return squares;
}

export function isDarkSquare(square: string): boolean {
  const fileIdx = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rankNum = Number(square[1]);
  // a1 is dark: fileIdx=0, rankNum=1 -> (0 + 1) % 2 === 1 -> dark? Wait:
  // a1 is dark (0 + 0 = 0 even -> dark), h1 is light (7 + 0 = 7 odd -> light).
  // Let's check: rankIdx (0-based from rank 1) = rankNum - 1. (fileIdx + rankIdx) % 2 === 0 => dark!
  return (fileIdx + (rankNum - 1)) % 2 === 0;
}

export function getBoardMap(fen: string): Map<string, BoardPiece> {
  const chess = new Chess(fen);
  const board = chess.board();
  const map = new Map<string, BoardPiece>();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (cell) {
        map.set(cell.square, {
          square: cell.square,
          type: cell.type,
          color: cell.color,
        });
      }
    }
  }
  return map;
}

export interface LegalTarget {
  to: string;
  isCapture: boolean;
  isPromotion: boolean;
}

export function getLegalTargets(fen: string, fromSquare: string): LegalTarget[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ square: fromSquare as Square, verbose: true });
  const seen = new Map<string, LegalTarget>();
  for (const m of moves) {
    const existing = seen.get(m.to);
    const isCapture = Boolean(m.captured) || m.flags.includes('e');
    const isPromotion = Boolean(m.promotion);
    if (!existing) {
      seen.set(m.to, { to: m.to, isCapture, isPromotion });
    }
  }
  return Array.from(seen.values());
}

export function isPromotionMove(fen: string, fromSquare: string, toSquare: string): boolean {
  const chess = new Chess(fen);
  const moves = chess.moves({ square: fromSquare as Square, verbose: true });
  return moves.some((m) => m.to === toSquare && Boolean(m.promotion));
}

export interface ExecutedMoveResult {
  fen: string;
  pgn: string;
  turn: PieceColor;
  record: MoveRecord;
}

export function executeChessMove(
  chess: Chess,
  from: string,
  to: string,
  promotion?: 'q' | 'r' | 'b' | 'n'
): ExecutedMoveResult | null {
  try {
    const move = chess.move({
      from: from as Square,
      to: to as Square,
      promotion,
    });
    if (!move) return null;

    const ply = chess.history().length;
    const record: MoveRecord = {
      ply,
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      piece: move.piece,
      captured: move.captured,
      promotion: move.promotion as PieceType | undefined,
      fenAfter: chess.fen(),
    };

    return {
      fen: chess.fen(),
      pgn: chess.pgn(),
      turn: chess.turn(),
      record,
    };
  } catch {
    return null;
  }
}

export function getKingInCheckSquare(fen: string): string | null {
  const chess = new Chess(fen);
  if (!chess.inCheck()) return null;
  const turn = chess.turn();
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (cell && cell.type === 'k' && cell.color === turn) {
        return cell.square;
      }
    }
  }
  return null;
}

export function computeMaterialState(fen: string): CapturedState {
  const startingCounts: Record<PieceColor, Record<Exclude<PieceType, 'k'>, number>> = {
    w: { q: 1, r: 2, b: 2, n: 2, p: 8 },
    b: { q: 1, r: 2, b: 2, n: 2, p: 8 },
  };
  const currentCounts: Record<PieceColor, Record<Exclude<PieceType, 'k'>, number>> = {
    w: { q: 0, r: 0, b: 0, n: 0, p: 0 },
    b: { q: 0, r: 0, b: 0, n: 0, p: 0 },
  };

  const chess = new Chess(fen);
  const board = chess.board();
  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (!cell || cell.type === 'k') continue;
      currentCounts[cell.color][cell.type] += 1;
      if (cell.color === 'w') {
        whiteMaterial += PIECE_VALUES[cell.type];
      } else {
        blackMaterial += PIECE_VALUES[cell.type];
      }
    }
  }

  const order: Exclude<PieceType, 'k'>[] = ['q', 'r', 'b', 'n', 'p'];
  const capturedByWhite: PieceType[] = [];
  const capturedByBlack: PieceType[] = [];

  for (const type of order) {
    const missingBlack = Math.max(0, startingCounts.b[type] - currentCounts.b[type]);
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(type);

    const missingWhite = Math.max(0, startingCounts.w[type] - currentCounts.w[type]);
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(type);
  }

  return {
    capturedByWhite,
    capturedByBlack,
    whiteAdvantage: whiteMaterial - blackMaterial,
  };
}

export function pairMoveHistory(moves: MoveRecord[]): MovePair[] {
  const pairs: MovePair[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }
  return pairs;
}

export interface GameOverEvaluation {
  isOver: boolean;
  winner?: PieceColor | 'draw';
  termination?: GameTermination;
  reasonLabel?: string;
}

export function evaluateGameOver(chess: Chess): GameOverEvaluation {
  if (!chess.isGameOver()) {
    return { isOver: false };
  }

  if (chess.isCheckmate()) {
    const winner: PieceColor = chess.turn() === 'w' ? 'b' : 'w';
    return {
      isOver: true,
      winner,
      termination: 'checkmate',
      reasonLabel: 'Checkmate',
    };
  }

  if (chess.isStalemate()) {
    return {
      isOver: true,
      winner: 'draw',
      termination: 'stalemate',
      reasonLabel: 'Draw by Stalemate',
    };
  }

  if (chess.isThreefoldRepetition()) {
    return {
      isOver: true,
      winner: 'draw',
      termination: 'threefold_repetition',
      reasonLabel: 'Draw by Threefold Repetition',
    };
  }

  if (chess.isInsufficientMaterial()) {
    return {
      isOver: true,
      winner: 'draw',
      termination: 'insufficient_material',
      reasonLabel: 'Draw by Insufficient Material',
    };
  }

  return {
    isOver: true,
    winner: 'draw',
    termination: 'fifty_move_rule',
    reasonLabel: 'Draw by 50-Move Rule',
  };
}

export function formatClockMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalTenths = Math.floor(clamped / 100);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (clamped < 20_000 && clamped > 0) {
    const tenths = totalTenths % 10;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function applyClockIncrement(
  clocks: { w: number; b: number },
  movingColor: PieceColor,
  incrementMs: number,
  untimed: boolean
): { w: number; b: number } {
  if (untimed || incrementMs <= 0) {
    return clocks;
  }
  return {
    w: movingColor === 'w' ? clocks.w + incrementMs : clocks.w,
    b: movingColor === 'b' ? clocks.b + incrementMs : clocks.b,
  };
}

export function formatEvalDisplay(cp: number | null | undefined, mate: number | null | undefined): string {
  if (mate !== null && mate !== undefined) {
    return mate > 0 ? `+M${mate}` : `-M${Math.abs(mate)}`;
  }
  if (cp === null || cp === undefined) return '0.0';
  const pawns = cp / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(1)}`;
}
