import { Chess, type Square } from 'chess.js';
import { formatEvalDisplay } from './rules';
import type {
  AnalyzedMoveFrame,
  EngineEval,
  GameAnalysisReport,
  MoveClassification,
  MoveRecord,
  PieceColor,
} from '../types/chess';

/**
 * Normalize centipawn or mate evaluation into bounded White-perspective centipawns (-1200..+1200)
 * for graphing and centipawn-loss computation.
 */
export function evalToWhiteCp(cp: number | null | undefined, mate: number | null | undefined): number {
  if (mate !== null && mate !== undefined) {
    if (mate === 0) return 0;
    const sign = mate > 0 ? 1 : -1;
    // Mate in 1 is higher than mate in 5
    return sign * Math.max(950, 1200 - Math.min(20, Math.abs(mate)) * 12);
  }
  if (cp === null || cp === undefined || !Number.isFinite(cp)) {
    return 0;
  }
  return Math.max(-1200, Math.min(1200, Math.round(cp)));
}

export function computeCpLossForMove(
  moverColor: PieceColor,
  beforeEval: { cp: number | null | undefined; mate: number | null | undefined },
  afterEval: { cp: number | null | undefined; mate: number | null | undefined }
): number {
  const beforeScore = evalToWhiteCp(beforeEval.cp, beforeEval.mate);
  const afterScore = evalToWhiteCp(afterEval.cp, afterEval.mate);
  const signedDelta = moverColor === 'w' ? beforeScore - afterScore : afterScore - beforeScore;
  return Math.max(0, Math.round(signedDelta));
}

export function classifyMoveLoss(cpLoss: number, isEngineTopMove = false): MoveClassification {
  if (isEngineTopMove || cpLoss <= 20) return 'best';
  if (cpLoss <= 55) return 'good';
  if (cpLoss <= 125) return 'inaccuracy';
  if (cpLoss <= 260) return 'mistake';
  return 'blunder';
}

export function computeAccuracyFromFrames(
  frames: Pick<AnalyzedMoveFrame, 'color' | 'cpLoss'>[],
  color: PieceColor
): number {
  const sideFrames = frames.filter((f) => f.color === color);
  if (sideFrames.length === 0) return 100;

  let totalScore = 0;
  for (const frame of sideFrames) {
    const moveScore = 100 * Math.exp(-0.0038 * Math.min(800, Math.max(0, frame.cpLoss)));
    totalScore += moveScore;
  }
  return Math.max(0, Math.min(100, Math.round(totalScore / sideFrames.length)));
}

export function uciMoveToSan(fen: string, uciMove: string | undefined): string | undefined {
  if (!uciMove || uciMove === '(none)' || uciMove.length < 4) return undefined;
  try {
    const chess = new Chess(fen);
    const from = uciMove.slice(0, 2) as Square;
    const to = uciMove.slice(2, 4) as Square;
    const promo = uciMove.length >= 5 ? uciMove[4] : undefined;
    const promotion =
      promo === 'q' || promo === 'r' || promo === 'b' || promo === 'n' ? promo : undefined;
    const result = chess.move({ from, to, promotion });
    return result?.san;
  } catch {
    return undefined;
  }
}

export function buildAnalysisReport(
  moves: MoveRecord[],
  evalsByPly: EngineEval[],
  depth: number
): GameAnalysisReport {
  const initialFen = new Chess().fen();
  const emptyCounts = (): Record<MoveClassification, number> => ({
    best: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  });

  const counts = {
    w: emptyCounts(),
    b: emptyCounts(),
  };

  const evalSeries: { ply: number; cpWhite: number; label: string }[] = [
    {
      ply: 0,
      cpWhite: evalToWhiteCp(evalsByPly[0]?.cp, evalsByPly[0]?.mate),
      label: formatEvalDisplay(evalsByPly[0]?.cp, evalsByPly[0]?.mate),
    },
  ];

  const frames: AnalyzedMoveFrame[] = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = i === 0 ? initialFen : moves[i - 1].fenAfter;
    const beforeEval = evalsByPly[i] || { cp: 0, mate: null, depth };
    const afterEval = evalsByPly[i + 1] || { cp: beforeEval.cp, mate: beforeEval.mate, depth };

    const bestUci = beforeEval.bestMoveUci;
    const playedUci = `${move.from}${move.to}${move.promotion || ''}`;
    const isTop = Boolean(bestUci && bestUci === playedUci);
    const cpLoss = isTop ? 0 : computeCpLossForMove(move.color, beforeEval, afterEval);
    const classification = classifyMoveLoss(cpLoss, isTop);
    const bestMoveSan = uciMoveToSan(fenBefore, bestUci);

    counts[move.color][classification] += 1;

    frames.push({
      ply: move.ply,
      san: move.san,
      color: move.color,
      from: move.from,
      to: move.to,
      fenBefore,
      fenAfter: move.fenAfter,
      evalBeforeCp: beforeEval.cp,
      evalBeforeMate: beforeEval.mate,
      evalAfterCp: afterEval.cp,
      evalAfterMate: afterEval.mate,
      cpLoss,
      classification,
      bestMoveSan,
      bestMoveUci: bestUci,
    });

    evalSeries.push({
      ply: move.ply,
      cpWhite: evalToWhiteCp(afterEval.cp, afterEval.mate),
      label: formatEvalDisplay(afterEval.cp, afterEval.mate),
    });
  }

  return {
    frames,
    evalSeries,
    whiteAccuracy: computeAccuracyFromFrames(frames, 'w'),
    blackAccuracy: computeAccuracyFromFrames(frames, 'b'),
    counts,
    depth,
    completedAt: Date.now(),
  };
}

export async function analyzeGameWithEvaluator(
  moves: MoveRecord[],
  evaluator: (fen: string, turn: PieceColor, depth: number) => Promise<EngineEval>,
  options?: {
    depth?: number;
    onProgress?: (completed: number, total: number) => void;
    signal?: AbortSignal;
  }
): Promise<GameAnalysisReport> {
  const depth = options?.depth ?? 8;
  const totalPositions = moves.length + 1;
  const evalsByPly: EngineEval[] = [];
  const startFen = new Chess().fen();

  for (let ply = 0; ply < totalPositions; ply++) {
    if (options?.signal?.aborted) {
      throw new Error('Analysis cancelled');
    }

    const fen = ply === 0 ? startFen : moves[ply - 1].fenAfter;
    const probe = new Chess(fen);
    if (probe.isGameOver()) {
      if (probe.isCheckmate()) {
        const mateForWhite = probe.turn() === 'b' ? 1 : -1;
        evalsByPly.push({ cp: null, mate: mateForWhite, depth });
      } else {
        evalsByPly.push({ cp: 0, mate: null, depth });
      }
    } else {
      const ev = await evaluator(fen, probe.turn(), depth);
      evalsByPly.push(ev);
    }

    options?.onProgress?.(ply + 1, totalPositions);
  }

  return buildAnalysisReport(moves, evalsByPly, depth);
}
