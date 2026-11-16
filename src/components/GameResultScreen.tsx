import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { motion } from 'motion/react';
import {
  Activity,
  Check,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Eye,
  LayoutDashboard,
  Loader2,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import { analyzeGameWithEvaluator } from '../chess/analysis';
import { formatEvalDisplay, getKingInCheckSquare } from '../chess/rules';
import { stockfishService } from '../engine/stockfishService';
import type {
  AnalyzedMoveFrame,
  GameAnalysisReport,
  GameResult,
  MoveClassification,
  MoveRecord,
  ScreenId,
} from '../types/chess';
import { ChessBoard } from './ChessBoard';

interface GameResultScreenProps {
  result: GameResult;
  moves: MoveRecord[];
  timeControlLabel: string;
  playerFlipped?: boolean;
  showCoordinates?: boolean;
  animatePieces?: boolean;
  analysisReport: GameAnalysisReport | null;
  onAnalysisComplete: (report: GameAnalysisReport) => void;
  onRematch: () => void;
  onReviewBoard: () => void;
  onNavigate: (screen: ScreenId) => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

const CLASS_LABEL: Record<MoveClassification, { text: string; color: string }> = {
  best: { text: 'Best', color: 'text-[#B9D7B9]' },
  good: { text: 'Good', color: 'text-[#E9E5D9]' },
  inaccuracy: { text: 'Inaccuracy', color: 'text-[#E9C46A]' },
  mistake: { text: 'Mistake', color: 'text-[#E79A6B]' },
  blunder: { text: 'Blunder', color: 'text-[#E07070]' },
};

export const GameResultScreen: React.FC<GameResultScreenProps> = ({
  result,
  moves,
  timeControlLabel,
  playerFlipped = false,
  showCoordinates = true,
  animatePieces = true,
  analysisReport,
  onAnalysisComplete,
  onRematch,
  onReviewBoard,
  onNavigate,
}) => {
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });
  const [selectedPly, setSelectedPly] = useState<number | null>(
    moves.length > 0 ? moves.length : null
  );
  const [hoveredGraphPly, setHoveredGraphPly] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSelectedPly(moves.length > 0 ? moves.length : null);
  }, [moves.length, result.timestamp]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Keyboard arrow scrubbing for post-match position inspection
  useEffect(() => {
    if (moves.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedPly((prev) => Math.max(0, (prev ?? moves.length) - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedPly((prev) => Math.min(moves.length, (prev ?? moves.length) + 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSelectedPly(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedPly(moves.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moves.length]);

  const headline =
    result.winner === 'draw'
      ? 'Match Drawn'
      : result.winner === 'w'
        ? `${result.whiteName} Wins`
        : `${result.blackName} Wins`;

  const sideTag =
    result.winner === 'draw'
      ? '1/2 — 1/2'
      : result.winner === 'w'
        ? '1 — 0 · White Victory'
        : '0 — 1 · Black Victory';

  const handleCopyPgn = async () => {
    try {
      await navigator.clipboard.writeText(result.pgn || result.finalFen);
      setCopiedPgn(true);
      window.setTimeout(() => setCopiedPgn(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleRunAnalysis = async () => {
    if (moves.length === 0 || analyzing) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAnalyzing(true);
    setAnalysisError(null);
    setProgress({ completed: 0, total: moves.length + 1 });

    try {
      const report = await analyzeGameWithEvaluator(
        moves,
        (fen, turn, depth) => stockfishService.evaluatePosition(fen, turn, depth),
        {
          depth: 8,
          signal: controller.signal,
          onProgress: (completed, total) => setProgress({ completed, total }),
        }
      );
      onAnalysisComplete(report);
    } catch (err) {
      if (err instanceof Error && err.message === 'Analysis cancelled') {
        setAnalysisError('Analysis cancelled.');
      } else {
        setAnalysisError(
          err instanceof Error ? err.message : 'Stockfish post-match analysis failed.'
        );
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Board snapshot driven by selectedPly
  const displayedFen = useMemo(() => {
    if (selectedPly === null || selectedPly >= moves.length) return result.finalFen;
    if (selectedPly <= 0) return new Chess().fen();
    return moves[selectedPly - 1]?.fenAfter || result.finalFen;
  }, [moves, result.finalFen, selectedPly]);

  const displayedLastMove = useMemo(() => {
    const idx = (selectedPly === null ? moves.length : selectedPly) - 1;
    if (idx < 0 || !moves[idx]) return null;
    return {
      from: moves[idx].from,
      to: moves[idx].to,
      isCapture: Boolean(moves[idx].captured),
    };
  }, [moves, selectedPly]);

  const checkSquare = useMemo(() => getKingInCheckSquare(displayedFen), [displayedFen]);
  const isCheckmatePos = useMemo(() => {
    try {
      return new Chess(displayedFen).isCheckmate();
    } catch {
      return false;
    }
  }, [displayedFen]);

  const selectedFrame: AnalyzedMoveFrame | null = useMemo(() => {
    if (!analysisReport || !selectedPly || selectedPly <= 0) return null;
    return analysisReport.frames.find((f) => f.ply === selectedPly) || null;
  }, [analysisReport, selectedPly]);

  // SVG chart coordinates helper for Evaluation Swing graph
  const evalGraph = useMemo(() => {
    if (!analysisReport || analysisReport.evalSeries.length < 2) return null;
    const width = 640;
    const height = 140;
    const midY = height / 2;
    const maxCp = 800;
    const series = analysisReport.evalSeries;
    const points = series.map((pt, idx) => {
      const x = series.length === 1 ? 0 : (idx / (series.length - 1)) * width;
      const clamped = Math.max(-maxCp, Math.min(maxCp, pt.cpWhite));
      const y = midY - (clamped / maxCp) * (midY - 12);
      return { ...pt, x, y };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
    const areaPath = `${linePath} L ${width} ${midY} L 0 ${midY} Z`;

    return { width, height, midY, points, linePath, areaPath };
  }, [analysisReport]);

  return (
    <main className="relative z-10 mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-6">
      {/* Primary Result Summary Card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="rounded-[24px] glass-surface-elevated p-6 sm:p-8 lg:p-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Outcome & Controls */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 font-mono text-xs text-[#B9D7B9]">
                <Trophy className="h-4 w-4" />
                <span>{sideTag}</span>
                {result.termination === 'checkmate' && (
                  <span className="font-mono text-[11px] text-[#E9E5D9]">· Checkmate</span>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4F6F0] text-balance">
                {headline}
              </h1>
              <p className="text-base text-[#E9E5D9]">{result.reasonLabel}</p>
            </div>

            {/* Players Summary */}
            <div className="grid grid-cols-2 gap-3 rounded-[16px] glass-tile p-4">
              <div>
                <div className="font-mono text-[11px] text-[#A5B3A8]">WHITE</div>
                <div className="mt-1 font-display text-base font-medium text-[#F4F6F0] truncate">
                  {result.whiteName}
                </div>
                {analysisReport && (
                  <div className="mt-1 font-mono text-xs text-[#B9D7B9]">
                    Accuracy: {analysisReport.whiteAccuracy}%
                  </div>
                )}
              </div>
              <div>
                <div className="font-mono text-[11px] text-[#A5B3A8]">BLACK</div>
                <div className="mt-1 font-display text-base font-medium text-[#F4F6F0] truncate">
                  {result.blackName}
                </div>
                {analysisReport && (
                  <div className="mt-1 font-mono text-xs text-[#B9D7B9]">
                    Accuracy: {analysisReport.blackAccuracy}%
                  </div>
                )}
              </div>
            </div>

            {/* Telemetry */}
            <dl className="grid grid-cols-3 gap-3 border-y border-white/[0.09] py-4">
              <div>
                <dt className="font-mono text-[11px] text-[#A5B3A8]">MOVES</dt>
                <dd className="mt-1 font-mono text-lg font-medium text-[#F4F6F0] tabular-nums">
                  {Math.ceil(result.totalPlies / 2)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-[#A5B3A8]">DURATION</dt>
                <dd className="mt-1 font-mono text-lg font-medium text-[#F4F6F0] tabular-nums">
                  {formatDuration(result.durationMs)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] text-[#A5B3A8]">FORMAT</dt>
                <dd className="mt-1 font-mono text-lg font-medium text-[#F4F6F0]">
                  {timeControlLabel}
                </dd>
              </div>
            </dl>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                data-start="true"
                onClick={onRematch}
                className="inline-flex items-center gap-2 rounded-xl btn-glass-primary px-5 py-3 font-mono text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9E5D9]"
              >
                <RotateCcw className="h-4 w-4" />
                Play Rematch
              </motion.button>

              <button
                type="button"
                onClick={onReviewBoard}
                className="inline-flex items-center gap-2 rounded-xl btn-glass-secondary px-4 py-3 font-mono text-sm font-medium"
              >
                <Eye className="h-4 w-4 text-[#B9D7B9]" />
                Review Board
              </button>

              <button
                type="button"
                onClick={handleCopyPgn}
                className="inline-flex items-center gap-2 rounded-xl btn-glass-secondary px-4 py-3 font-mono text-sm font-medium"
              >
                {copiedPgn ? (
                  <>
                    <Check className="h-4 w-4 text-[#B9D7B9]" />
                    Copied PGN
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-[#A5B3A8]" />
                    Copy PGN
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('modes')}
                className="font-mono text-xs text-[#A5B3A8] hover:text-[#F4F6F0] underline underline-offset-4"
              >
                Change Mode
              </button>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-[#A5B3A8] hover:text-[#F4F6F0]"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Return to Dashboard
              </button>
            </div>
          </div>

          {/* Right: Interactive Board Snapshot */}
          <div className="lg:col-span-5">
            <div className="max-w-[380px] mx-auto space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[11px] text-[#A5B3A8]">
                <span>
                  {selectedPly === null || selectedPly >= moves.length
                    ? 'FINAL POSITION'
                    : `PLY ${selectedPly} · ${moves[selectedPly - 1]?.san || ''}`}
                </span>
                {selectedFrame && (
                  <span className={CLASS_LABEL[selectedFrame.classification].color}>
                    {CLASS_LABEL[selectedFrame.classification].text} (
                    {formatEvalDisplay(selectedFrame.evalAfterCp, selectedFrame.evalAfterMate)})
                  </span>
                )}
              </div>
              <ChessBoard
                fen={displayedFen}
                flipped={playerFlipped}
                selectedSquare={null}
                legalTargets={[]}
                lastMove={displayedLastMove}
                checkSquare={checkSquare}
                isCheckmate={isCheckmatePos}
                showCoordinates={showCoordinates}
                animatePieces={animatePieces}
                interactive={false}
                pendingPromotion={null}
                onSquareClick={() => undefined}
                onPromotionSelect={() => undefined}
                onPromotionCancel={() => undefined}
              />
              {moves.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    disabled={selectedPly === 0}
                    onClick={() => setSelectedPly(0)}
                    aria-label="Start position"
                    className="flex items-center justify-center rounded-xl glass-tile py-1.5 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
                  >
                    <ChevronFirst className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedPly === 0}
                    onClick={() => setSelectedPly((p) => Math.max(0, (p ?? moves.length) - 1))}
                    aria-label="Previous ply"
                    className="flex items-center justify-center rounded-xl glass-tile py-1.5 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedPly === null || selectedPly >= moves.length}
                    onClick={() =>
                      setSelectedPly((p) => Math.min(moves.length, (p ?? moves.length) + 1))
                    }
                    aria-label="Next ply"
                    className="flex items-center justify-center rounded-xl glass-tile py-1.5 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedPly === null || selectedPly >= moves.length}
                    onClick={() => setSelectedPly(moves.length)}
                    aria-label="Final position"
                    className="flex items-center justify-center rounded-xl glass-tile py-1.5 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
                  >
                    <ChevronLast className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Post-Match Stockfish 19 Analysis Suite */}
      {moves.length > 0 && (
        <section
          aria-labelledby="post-match-analysis-heading"
          className="rounded-[24px] glass-surface p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.09] pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#B9D7B9]">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h2
                  id="post-match-analysis-heading"
                  className="font-display text-lg font-medium text-[#F4F6F0]"
                >
                  Stockfish 19 Post-Match Analysis
                </h2>
                <p className="text-xs text-[#A5B3A8]">
                  Position-by-position engine evaluation, centipawn loss, and optimal move suggestions.
                </p>
              </div>
            </div>

            {!analyzing ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => void handleRunAnalysis()}
                data-testid="run-stockfish-analysis"
                className="inline-flex items-center justify-center gap-2 rounded-xl btn-glass-primary px-5 py-2.5 font-mono text-xs font-semibold shrink-0"
              >
                <Activity className="h-4 w-4" />
                {analysisReport ? 'Re-Analyze Match' : 'Analyze Match with Stockfish 19'}
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E07070]/60 bg-[#E07070]/12 px-4 py-2 font-mono text-xs font-medium text-[#E07070] hover:bg-[#E07070]/20 shrink-0"
              >
                <XCircle className="h-4 w-4" />
                Cancel ({progress.completed}/{progress.total})
              </button>
            )}
          </div>

          {analysisError && (
            <div
              role="alert"
              className="rounded-xl border border-[#E07070]/60 bg-[#E07070]/12 px-4 py-3 text-xs text-[#F4F6F0]"
            >
              {analysisError}
            </div>
          )}

          {analyzing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between font-mono text-xs text-[#A5B3A8]">
                <span className="inline-flex items-center gap-2 text-[#E9E5D9]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B9D7B9]" />
                  Evaluating position {progress.completed} of {progress.total} at depth 8…
                </span>
                <span className="tabular-nums">
                  {progress.total > 0
                    ? Math.round((progress.completed / progress.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/40 border border-white/10">
                <motion.div
                  className="h-full bg-[#B9D7B9]"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
                    }%`,
                  }}
                  transition={{ duration: 0.15 }}
                />
              </div>
            </div>
          )}

          {analysisReport && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-6"
            >
              {/* Accuracy & Move Classification Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    { side: 'w', label: result.whiteName, accuracy: analysisReport.whiteAccuracy },
                    { side: 'b', label: result.blackName, accuracy: analysisReport.blackAccuracy },
                  ] as const
                ).map((entry) => {
                  const counts = analysisReport.counts[entry.side];
                  return (
                    <div key={entry.side} className="rounded-[16px] glass-tile p-4 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="font-display text-sm font-medium text-[#F4F6F0] truncate">
                          {entry.label} ({entry.side === 'w' ? 'White' : 'Black'})
                        </span>
                        <span className="font-mono text-base font-semibold text-[#B9D7B9] tabular-nums">
                          {entry.accuracy}% Accuracy
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[11px]">
                        {(['best', 'good', 'inaccuracy', 'mistake', 'blunder'] as const).map(
                          (cls) => (
                            <div
                              key={cls}
                              className="rounded-lg border border-white/[0.08] bg-black/25 py-1.5 px-1"
                            >
                              <div className={`font-semibold tabular-nums ${CLASS_LABEL[cls].color}`}>
                                {counts[cls]}
                              </div>
                              <div className="text-[10px] text-[#A5B3A8] truncate">
                                {CLASS_LABEL[cls].text}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Animated Evaluation Swing Chart */}
              {evalGraph && (
                <div className="rounded-[16px] glass-tile p-4 space-y-2">
                  <div className="flex items-center justify-between font-mono text-[11px] text-[#A5B3A8]">
                    <span>EVALUATION ADVANTAGE (WHITE ↑ / BLACK ↓)</span>
                    <span className="tabular-nums text-[#E9E5D9]">
                      {hoveredGraphPly !== null
                        ? (() => {
                            const pt = evalGraph.points.find((p) => p.ply === hoveredGraphPly);
                            return pt ? `Ply ${pt.ply} · ${pt.label}` : 'Click any point to inspect board';
                          })()
                        : 'Click any point or use ←/→ keys'}
                    </span>
                  </div>
                  <svg
                    viewBox={`0 0 ${evalGraph.width} ${evalGraph.height}`}
                    className="w-full h-[130px] overflow-visible"
                    role="img"
                    aria-label="Game evaluation swing chart"
                    onMouseLeave={() => setHoveredGraphPly(null)}
                  >
                    <line
                      x1="0"
                      y1={evalGraph.midY}
                      x2={evalGraph.width}
                      y2={evalGraph.midY}
                      stroke="rgba(255,255,255,0.16)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <path d={evalGraph.areaPath} fill="#2C6546" fillOpacity="0.52" />
                    <motion.path
                      d={evalGraph.linePath}
                      fill="none"
                      stroke="#B9D7B9"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {hoveredGraphPly !== null &&
                      (() => {
                        const hp = evalGraph.points.find((p) => p.ply === hoveredGraphPly);
                        return hp ? (
                          <line
                            x1={hp.x}
                            y1={6}
                            x2={hp.x}
                            y2={evalGraph.height - 6}
                            stroke="#E9E5D9"
                            strokeOpacity="0.4"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                        ) : null;
                      })()}
                    {evalGraph.points.map((pt) => {
                      const active = selectedPly === pt.ply;
                      const hovered = hoveredGraphPly === pt.ply;
                      return (
                        <circle
                          key={pt.ply}
                          cx={pt.x}
                          cy={pt.y}
                          r={active ? 5.5 : hovered ? 4.5 : 3.2}
                          fill={active ? '#E9E5D9' : hovered ? '#F4F6F0' : '#B9D7B9'}
                          className="cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredGraphPly(pt.ply)}
                          onClick={() => setSelectedPly(pt.ply === 0 ? 0 : pt.ply)}
                        >
                          <title>{`Ply ${pt.ply}: ${pt.label}`}</title>
                        </circle>
                      );
                    })}
                  </svg>
                </div>
              )}

              {/* Clickable Move-by-Move Breakdown */}
              <div className="rounded-[16px] glass-tile overflow-x-auto chess-scroll">
                <div className="min-w-[480px]">
                  <div className="grid grid-cols-[52px_68px_1.2fr_72px_1fr] gap-2 border-b border-white/[0.09] bg-black/25 px-3.5 py-2 font-mono text-[10px] text-[#A5B3A8]">
                    <span>PLY</span>
                    <span>MOVE</span>
                    <span>QUALITY</span>
                    <span>EVAL</span>
                    <span>ENGINE NOTE</span>
                  </div>
                  <div className="chess-scroll max-h-[260px] overflow-y-auto divide-y divide-white/[0.06]">
                    {analysisReport.frames.map((frame) => {
                      const active = selectedPly === frame.ply;
                      const meta = CLASS_LABEL[frame.classification];
                      return (
                        <button
                          key={frame.ply}
                          type="button"
                          onClick={() => setSelectedPly(frame.ply)}
                          className={`w-full grid grid-cols-[52px_68px_1.2fr_72px_1fr] gap-2 items-center px-3.5 py-2 text-left font-mono text-xs transition-colors ${
                            active
                              ? 'bg-[#B9D7B9]/18 text-[#F4F6F0]'
                              : 'hover:bg-white/[0.05] text-[#F4F6F0]'
                          }`}
                        >
                          <span className="text-[#A5B3A8] tabular-nums">
                            {Math.ceil(frame.ply / 2)}
                            {frame.color === 'w' ? '.' : '…'}
                          </span>
                          <span className="font-semibold">{frame.san}</span>
                          <span className={meta.color}>
                            {meta.text}
                            {frame.cpLoss > 0 ? ` (-${(frame.cpLoss / 100).toFixed(2)})` : ''}
                          </span>
                          <span className="text-[#E9E5D9] tabular-nums">
                            {formatEvalDisplay(frame.evalAfterCp, frame.evalAfterMate)}
                          </span>
                          <span className="text-[#A5B3A8] truncate">
                            {frame.classification !== 'best' && frame.bestMoveSan
                              ? `Best: ${frame.bestMoveSan}`
                              : 'Optimal line'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </section>
      )}
    </main>
  );
};
