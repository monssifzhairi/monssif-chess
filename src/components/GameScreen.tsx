import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Flag,
  Handshake,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import { chessAudio } from '../audio/chessAudio';
import {
  applyClockIncrement,
  computeMaterialState,
  evaluateGameOver,
  executeChessMove,
  formatEvalDisplay,
  getBoardMap,
  getDifficultyConfig,
  getKingInCheckSquare,
  getLegalTargets,
  isPromotionMove,
  pairMoveHistory,
} from '../chess/rules';
import { stockfishService } from '../engine/stockfishService';
import { onlineService } from '../online/onlineService';
import type {
  CompletedMatchSnapshot,
  EngineEval,
  GameResult,
  MatchConfig,
  MoveRecord,
  OnlineRoomSnapshot,
  PieceColor,
} from '../types/chess';
import { ChessBoard } from './ChessBoard';
import { PlayerClockCard } from './PlayerClockCard';

interface GameScreenProps {
  config: MatchConfig;
  reviewSnapshot?: CompletedMatchSnapshot | null;
  onlineRoom: OnlineRoomSnapshot | null;
  onlineAssignedColor: PieceColor | null;
  onlineError: string | null;
  onlineReconnecting?: boolean;
  showCoordinates?: boolean;
  animatePieces?: boolean;
  onGameComplete: (result: GameResult, snapshot?: CompletedMatchSnapshot) => void;
  onViewResult: () => void;
  onRematchLocalOrAI: () => void;
  onLeaveOnlineRoom?: () => void;
  onExitToModes: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  config,
  reviewSnapshot = null,
  onlineRoom,
  onlineAssignedColor,
  onlineError,
  onlineReconnecting = false,
  showCoordinates = true,
  animatePieces = true,
  onGameComplete,
  onViewResult,
  onRematchLocalOrAI,
  onLeaveOnlineRoom,
  onExitToModes,
}) => {
  const isOnline = config.mode === 'online';
  const isAI = config.mode === 'ai';
  const isLocal = config.mode === 'local';
  const untimed = config.timeControl.initialMs <= 0;

  // Authoritative local/AI Chess instance
  const chessRef = useRef<Chess>(new Chess());
  const matchStartRef = useRef<number>(Date.now());
  const finishedRef = useRef<boolean>(false);

  const [fen, setFen] = useState<string>(() => reviewSnapshot?.fen || chessRef.current.fen());
  const [moves, setMoves] = useState<MoveRecord[]>(() => reviewSnapshot?.moves || []);
  const [turn, setTurn] = useState<PieceColor>(() => {
    if (reviewSnapshot?.fen) {
      try {
        return new Chess(reviewSnapshot.fen).turn();
      } catch {
        return 'w';
      }
    }
    return 'w';
  });
  const [whiteTimeMs, setWhiteTimeMs] = useState<number>(
    reviewSnapshot ? reviewSnapshot.whiteTimeMs : config.timeControl.initialMs
  );
  const [blackTimeMs, setBlackTimeMs] = useState<number>(
    reviewSnapshot ? reviewSnapshot.blackTimeMs : config.timeControl.initialMs
  );
  const [isGameOver, setIsGameOver] = useState<boolean>(Boolean(reviewSnapshot));
  const [gameOverBanner, setGameOverBanner] = useState<string | null>(
    reviewSnapshot?.result.reasonLabel || null
  );

  // Selection & board orientation
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: PieceColor;
  } | null>(null);
  const [flipped, setFlipped] = useState<boolean>(
    reviewSnapshot
      ? reviewSnapshot.flipped
      : isOnline
        ? onlineAssignedColor === 'b'
        : isAI
          ? config.playerColor === 'b'
          : false
  );

  // Keep live refs for clean snapshot creation at termination
  const whiteTimeRef = useRef<number>(whiteTimeMs);
  const blackTimeRef = useRef<number>(blackTimeMs);
  const flippedRef = useRef<boolean>(flipped);
  useEffect(() => {
    whiteTimeRef.current = whiteTimeMs;
  }, [whiteTimeMs]);
  useEffect(() => {
    blackTimeRef.current = blackTimeMs;
  }, [blackTimeMs]);
  useEffect(() => {
    flippedRef.current = flipped;
  }, [flipped]);

  // History inspection (null = live board)
  const [viewPly, setViewPly] = useState<number | null>(null);

  // AI state
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [engineEval, setEngineEval] = useState<EngineEval>({ cp: 0, mate: null, depth: 0 });

  // Draw & Resign controls
  const [confirmResign, setConfirmResign] = useState<boolean>(false);
  const [localDrawOfferFrom, setLocalDrawOfferFrom] = useState<PieceColor | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [copiedRoomCode, setCopiedRoomCode] = useState<boolean>(false);

  // Mobile notation drawer toggle
  const [mobileNotationOpen, setMobileNotationOpen] = useState<boolean>(false);
  const moveListEndRef = useRef<HTMLDivElement | null>(null);
  const prevOnlinePlyRef = useRef<number>(reviewSnapshot?.moves.length || 0);

  // Initialize or restore local/AI state cleanly
  useEffect(() => {
    if (isOnline) return;

    if (reviewSnapshot) {
      try {
        chessRef.current = new Chess(reviewSnapshot.fen);
      } catch {
        chessRef.current = new Chess();
      }
      finishedRef.current = true;
      setFen(reviewSnapshot.fen);
      setMoves(reviewSnapshot.moves);
      setTurn(chessRef.current.turn());
      setWhiteTimeMs(reviewSnapshot.whiteTimeMs);
      setBlackTimeMs(reviewSnapshot.blackTimeMs);
      setIsGameOver(true);
      setGameOverBanner(reviewSnapshot.result.reasonLabel);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setViewPly(null);
      setAiThinking(false);
      setEngineError(null);
      setConfirmResign(false);
      setLocalDrawOfferFrom(null);
      setStatusNotice(null);
      setFlipped(reviewSnapshot.flipped);
      return;
    }

    chessRef.current = new Chess();
    matchStartRef.current = Date.now();
    finishedRef.current = false;
    setFen(chessRef.current.fen());
    setMoves([]);
    setTurn('w');
    setWhiteTimeMs(config.timeControl.initialMs);
    setBlackTimeMs(config.timeControl.initialMs);
    setIsGameOver(false);
    setGameOverBanner(null);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setViewPly(null);
    setAiThinking(false);
    setEngineError(null);
    setEngineEval({ cp: 0, mate: null, depth: 0 });
    setConfirmResign(false);
    setLocalDrawOfferFrom(null);
    setStatusNotice(null);
    setFlipped(isAI ? config.playerColor === 'b' : false);

    if (isAI) {
      void stockfishService.newGame().catch((err) => {
        setEngineError(err instanceof Error ? err.message : 'Stockfish unavailable');
      });
    }

    return () => {
      if (isAI) {
        stockfishService.stop();
      }
    };
  }, [config, isAI, isOnline, reviewSnapshot]);

  // Synchronize online room state
  useEffect(() => {
    if (!isOnline || !onlineRoom) return;

    const prevPlies = prevOnlinePlyRef.current;
    const nextPlies = onlineRoom.moves.length;

    // Detect fresh game or online rematch transition
    if (nextPlies === 0 && (prevPlies > 0 || finishedRef.current)) {
      matchStartRef.current = Date.now();
      setViewPly(null);
      setConfirmResign(false);
      setStatusNotice(null);
    }

    // Play audio cues for newly arrived online moves (including opponent moves)
    if (nextPlies > prevPlies && onlineRoom.status === 'playing') {
      const latestMove = onlineRoom.moves[nextPlies - 1];
      const probe = new Chess(onlineRoom.fen);
      if (probe.inCheck()) {
        chessAudio.playCheck();
      } else if (latestMove?.captured) {
        chessAudio.playCapture();
      } else {
        chessAudio.playMove();
      }
    }
    prevOnlinePlyRef.current = nextPlies;

    setFen(onlineRoom.fen);
    setMoves(onlineRoom.moves);
    setTurn(onlineRoom.turn);
    setWhiteTimeMs(onlineRoom.whiteTimeMs);
    setBlackTimeMs(onlineRoom.blackTimeMs);
    setSelectedSquare(null);
    setPendingPromotion(null);

    if (onlineAssignedColor && onlineRoom.moves.length === 0) {
      setFlipped(onlineAssignedColor === 'b');
    }

    if (onlineRoom.status === 'finished' && onlineRoom.result && !finishedRef.current) {
      finishedRef.current = true;
      setIsGameOver(true);
      setGameOverBanner(onlineRoom.result.reasonLabel);
      chessAudio.playGameEnd();
      const result: GameResult = {
        ...onlineRoom.result,
        durationMs: Date.now() - matchStartRef.current,
        playerColor: onlineAssignedColor || config.playerColor,
        termination: onlineRoom.result.termination as GameResult['termination'],
      };
      onGameComplete(result, {
        config,
        result,
        fen: onlineRoom.fen,
        moves: onlineRoom.moves,
        whiteTimeMs: onlineRoom.whiteTimeMs,
        blackTimeMs: onlineRoom.blackTimeMs,
        flipped: onlineAssignedColor === 'b',
      });
    } else if (onlineRoom.status === 'playing') {
      finishedRef.current = false;
      setIsGameOver(false);
      setGameOverBanner(null);
    }
  }, [config, isOnline, onlineAssignedColor, onlineRoom, onGameComplete]);

  // Scroll move list to latest
  useEffect(() => {
    moveListEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [moves.length]);

  // Keyboard arrow navigation across move history (ArrowLeft/ArrowRight/Home/End)
  useEffect(() => {
    if (moves.length === 0 || pendingPromotion) return;
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
        setViewPly((prev) => {
          const current = prev === null ? moves.length : prev;
          return Math.max(0, current - 1);
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setViewPly((prev) => {
          if (prev === null) return null;
          const next = prev + 1;
          return next >= moves.length ? null : next;
        });
      } else if (e.key === 'Home') {
        e.preventDefault();
        setViewPly(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setViewPly(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moves.length, pendingPromotion]);

  const finishMatch = useCallback(
    (
      winner: PieceColor | 'draw',
      termination: GameResult['termination'],
      reasonLabel: string,
      finalChess: Chess,
      finalMoves: MoveRecord[],
      overrideWhiteMs?: number,
      overrideBlackMs?: number
    ) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setIsGameOver(true);
      setGameOverBanner(reasonLabel);
      setAiThinking(false);
      setConfirmResign(false);
      setLocalDrawOfferFrom(null);
      chessAudio.playGameEnd();

      const result: GameResult = {
        winner,
        termination,
        reasonLabel,
        totalPlies: finalMoves.length,
        durationMs: Date.now() - matchStartRef.current,
        pgn: finalChess.pgn(),
        finalFen: finalChess.fen(),
        whiteName: config.whiteName,
        blackName: config.blackName,
        mode: config.mode,
        difficulty: isAI ? config.difficulty : undefined,
        playerColor: isAI ? config.playerColor : isOnline ? onlineAssignedColor || 'w' : 'w',
        timestamp: Date.now(),
      };

      onGameComplete(result, {
        config,
        result,
        fen: finalChess.fen(),
        moves: finalMoves,
        whiteTimeMs: overrideWhiteMs ?? whiteTimeRef.current,
        blackTimeMs: overrideBlackMs ?? blackTimeRef.current,
        flipped: flippedRef.current,
      });
    },
    [config, isAI, isOnline, onGameComplete, onlineAssignedColor]
  );

  // Local / AI Countdown clock loop (pure state decrement without updater side effects)
  useEffect(() => {
    if (isOnline || untimed || isGameOver || moves.length === 0) return;

    const interval = window.setInterval(() => {
      if (turn === 'w') {
        setWhiteTimeMs((prev) => Math.max(0, prev - 100));
      } else {
        setBlackTimeMs((prev) => Math.max(0, prev - 100));
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [isGameOver, isOnline, moves.length, turn, untimed]);

  // Detect clock expiration cleanly outside React state updaters
  useEffect(() => {
    if (isOnline || untimed || isGameOver || moves.length === 0 || finishedRef.current) return;
    if (whiteTimeMs <= 0) {
      finishMatch('b', 'timeout', 'White Flagged · Time Out', chessRef.current, moves, 0, blackTimeMs);
    } else if (blackTimeMs <= 0) {
      finishMatch('w', 'timeout', 'Black Flagged · Time Out', chessRef.current, moves, whiteTimeMs, 0);
    }
  }, [blackTimeMs, finishMatch, isGameOver, isOnline, moves, untimed, whiteTimeMs]);

  // Local client-side smooth interpolation for Online clocks between server ticks
  useEffect(() => {
    if (
      !isOnline ||
      untimed ||
      isGameOver ||
      !onlineRoom ||
      onlineRoom.status !== 'playing' ||
      moves.length === 0
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      if (turn === 'w') {
        setWhiteTimeMs((prev) => Math.max(0, prev - 200));
      } else {
        setBlackTimeMs((prev) => Math.max(0, prev - 200));
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, [isOnline, isGameOver, moves.length, onlineRoom, turn, untimed]);

  // Apply a move locally (AI or Local Multiplayer)
  const commitLocalMove = useCallback(
    (from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
      const chess = chessRef.current;
      const movingColor = chess.turn();
      const result = executeChessMove(chess, from, to, promotion);
      if (!result) return false;

      let nextWhiteMs = whiteTimeRef.current;
      let nextBlackMs = blackTimeRef.current;

      // Apply increment after every completed move (including White move 1)
      if (!untimed && config.timeControl.incrementMs > 0) {
        const inc = config.timeControl.incrementMs;
        if (movingColor === 'w') {
          nextWhiteMs = applyClockIncrement({ w: whiteTimeRef.current, b: 0 }, 'w', inc, untimed).w;
          whiteTimeRef.current = nextWhiteMs;
          setWhiteTimeMs(nextWhiteMs);
        } else {
          nextBlackMs = applyClockIncrement({ w: 0, b: blackTimeRef.current }, 'b', inc, untimed).b;
          blackTimeRef.current = nextBlackMs;
          setBlackTimeMs(nextBlackMs);
        }
      }

      const nextMoves = [...moves, result.record];
      setFen(result.fen);
      setTurn(result.turn);
      setMoves(nextMoves);
      setSelectedSquare(null);
      setPendingPromotion(null);
      setViewPly(null);
      setLocalDrawOfferFrom(null);
      setStatusNotice(null);

      if (chess.inCheck()) {
        chessAudio.playCheck();
      } else if (result.record.captured) {
        chessAudio.playCapture();
      } else {
        chessAudio.playMove();
      }

      if (isLocal && config.autoFlipLocal && !chess.isGameOver()) {
        setFlipped(result.turn === 'b');
      }

      const over = evaluateGameOver(chess);
      if (over.isOver && over.winner && over.termination && over.reasonLabel) {
        finishMatch(
          over.winner,
          over.termination,
          over.reasonLabel,
          chess,
          nextMoves,
          nextWhiteMs,
          nextBlackMs
        );
      }

      return true;
    },
    [config.autoFlipLocal, config.timeControl.incrementMs, finishMatch, isLocal, moves, untimed]
  );

  // Trigger Stockfish AI move when it is AI's turn
  useEffect(() => {
    if (!isAI || isGameOver) return;
    const aiColor: PieceColor = config.playerColor === 'w' ? 'b' : 'w';
    if (turn !== aiColor) return;

    let cancelled = false;
    setAiThinking(true);
    setEngineError(null);

    const requestStart = performance.now();
    stockfishService
      .requestBestMove(fen, config.difficulty, turn, (ev) => {
        if (!cancelled) setEngineEval(ev);
      })
      .then((best) => {
        if (cancelled || finishedRef.current) return;
        const elapsed = performance.now() - requestStart;
        const minVisualDelay = Math.max(0, 280 - elapsed);
        window.setTimeout(() => {
          if (cancelled || finishedRef.current) return;
          setEngineEval(best.eval);
          setAiThinking(false);
          commitLocalMove(best.from, best.to, best.promotion);
        }, minVisualDelay);
      })
      .catch((err) => {
        if (cancelled) return;
        setAiThinking(false);
        if (err instanceof Error && err.message === 'Search cancelled') return;
        setEngineError(err instanceof Error ? err.message : 'Stockfish failed to respond.');
      });

    return () => {
      cancelled = true;
    };
  }, [commitLocalMove, config.difficulty, config.playerColor, fen, isAI, isGameOver, turn]);

  // Display FEN (supports inspecting move history!)
  const displayedFen = useMemo(() => {
    if (viewPly === null || viewPly >= moves.length) return fen;
    if (viewPly === 0) return new Chess().fen();
    return moves[viewPly - 1]?.fenAfter ?? fen;
  }, [fen, moves, viewPly]);

  const isInspectingHistory = viewPly !== null && viewPly < moves.length;

  const displayedLastMove = useMemo(() => {
    const activeIndex = viewPly === null ? moves.length - 1 : viewPly - 1;
    if (activeIndex < 0 || !moves[activeIndex]) return null;
    return {
      from: moves[activeIndex].from,
      to: moves[activeIndex].to,
      isCapture: Boolean(moves[activeIndex].captured),
    };
  }, [moves, viewPly]);

  const checkSquare = useMemo(() => getKingInCheckSquare(displayedFen), [displayedFen]);
  const isCheckmatePos = useMemo(() => {
    try {
      return new Chess(displayedFen).isCheckmate();
    } catch {
      return false;
    }
  }, [displayedFen]);
  const materialState = useMemo(() => computeMaterialState(displayedFen), [displayedFen]);
  const boardMap = useMemo(() => getBoardMap(displayedFen), [displayedFen]);

  // Determine whether the current human can interact with the board
  const canInteract = useMemo(() => {
    if (isGameOver || isInspectingHistory) return false;
    if (isAI) return turn === config.playerColor && !aiThinking;
    if (isOnline) {
      if (!onlineRoom || onlineRoom.status !== 'playing') return false;
      return onlineAssignedColor === turn;
    }
    return true;
  }, [
    aiThinking,
    config.playerColor,
    isAI,
    isGameOver,
    isInspectingHistory,
    isOnline,
    onlineAssignedColor,
    onlineRoom,
    turn,
  ]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare || !canInteract) return [];
    return getLegalTargets(fen, selectedSquare);
  }, [canInteract, fen, selectedSquare]);

  const canDragSquare = useCallback(
    (square: string): boolean => {
      if (!canInteract) return false;
      const piece = boardMap.get(square);
      if (!piece || piece.color !== turn) return false;
      if (isAI && piece.color !== config.playerColor) return false;
      if (isOnline && piece.color !== onlineAssignedColor) return false;
      return true;
    },
    [boardMap, canInteract, config.playerColor, isAI, isOnline, onlineAssignedColor, turn]
  );

  const handlePieceDrop = useCallback(
    (from: string, to: string) => {
      if (!canInteract) return;
      const targets = getLegalTargets(fen, from);
      const isLegal = targets.some((t) => t.to === to);
      if (!isLegal) return;

      if (isPromotionMove(fen, from, to)) {
        setPendingPromotion({ from, to, color: turn });
        return;
      }

      if (isOnline) {
        onlineService.sendMove(from, to);
        setSelectedSquare(null);
      } else {
        commitLocalMove(from, to);
      }
    },
    [canInteract, commitLocalMove, fen, isOnline, turn]
  );

  const handleSquareClick = (square: string) => {
    if (!canInteract) return;

    // 1. If a square is already selected and clicked square is a legal target -> make move
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      const isTarget = legalTargets.some((t) => t.to === square);
      if (isTarget) {
        if (isPromotionMove(fen, selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square, color: turn });
          return;
        }

        if (isOnline) {
          onlineService.sendMove(selectedSquare, square);
          setSelectedSquare(null);
        } else {
          commitLocalMove(selectedSquare, square);
        }
        return;
      }
    }

    // 2. Otherwise select a friendly piece on the active turn
    const clickedPiece = boardMap.get(square);
    if (clickedPiece && clickedPiece.color === turn) {
      if (isAI && clickedPiece.color !== config.playerColor) return;
      if (isOnline && clickedPiece.color !== onlineAssignedColor) return;
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const handlePromotionSelect = (promo: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    if (isOnline) {
      onlineService.sendMove(pendingPromotion.from, pendingPromotion.to, promo);
      setPendingPromotion(null);
      setSelectedSquare(null);
    } else {
      commitLocalMove(pendingPromotion.from, pendingPromotion.to, promo);
    }
  };

  const handleResignConfirm = () => {
    if (isGameOver) return;
    if (isOnline) {
      onlineService.resign();
      setConfirmResign(false);
      return;
    }

    const resigningColor: PieceColor = isAI ? config.playerColor : turn;
    const winner: PieceColor = resigningColor === 'w' ? 'b' : 'w';
    finishMatch(
      winner,
      'resignation',
      `${resigningColor === 'w' ? 'White' : 'Black'} Resigned`,
      chessRef.current,
      moves
    );
  };

  const handleOfferDraw = async () => {
    if (isGameOver) return;

    if (isOnline) {
      onlineService.offerDraw();
      setStatusNotice('Draw offer sent to opponent.');
      return;
    }

    if (isLocal) {
      setLocalDrawOfferFrom(turn);
      return;
    }

    if (isAI) {
      if (moves.length < 10) {
        setStatusNotice('Stockfish declined: at least 5 full moves must be played.');
        return;
      }
      setStatusNotice('Stockfish is evaluating draw offer…');
      try {
        const evalRes = await stockfishService.evaluatePosition(fen, turn, 8);
        setEngineEval(evalRes);
        const aiColor: PieceColor = config.playerColor === 'w' ? 'b' : 'w';
        const aiCp =
          evalRes.mate !== null
            ? evalRes.mate > 0
              ? aiColor === 'w'
                ? 9999
                : -9999
              : aiColor === 'w'
                ? -9999
                : 9999
            : (evalRes.cp ?? 0) * (aiColor === 'w' ? 1 : -1);

        if (aiCp <= 25) {
          finishMatch(
            'draw',
            'draw_agreement',
            'Draw by Mutual Agreement',
            chessRef.current,
            moves
          );
        } else {
          setStatusNotice('Stockfish declined your draw offer.');
        }
      } catch {
        setStatusNotice('Unable to evaluate draw offer right now.');
      }
    }
  };

  const handleCopyRoomCode = async () => {
    if (!onlineRoom) return;
    try {
      await navigator.clipboard.writeText(onlineRoom.roomCode);
      setCopiedRoomCode(true);
      window.setTimeout(() => setCopiedRoomCode(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const movePairs = useMemo(() => pairMoveHistory(moves), [moves]);

  // Top vs Bottom player info depending on board flip
  const topColor: PieceColor = flipped ? 'w' : 'b';
  const bottomColor: PieceColor = flipped ? 'b' : 'w';

  const getPlayerProps = (color: PieceColor) => {
    const name =
      isOnline && onlineRoom
        ? color === 'w'
          ? onlineRoom.whiteName
          : onlineRoom.blackName
        : color === 'w'
          ? config.whiteName
          : config.blackName;

    const subtitle = isAI
      ? color === config.playerColor
        ? `Human · ${color === 'w' ? 'White' : 'Black'}`
        : `${getDifficultyConfig(config.difficulty).label} · ${getDifficultyConfig(config.difficulty).eloLabel}`
      : isOnline
        ? color === onlineAssignedColor
          ? 'You'
          : 'Opponent'
        : color === 'w'
          ? 'White Pieces'
          : 'Black Pieces';

    const capturedPieces =
      color === 'w' ? materialState.capturedByWhite : materialState.capturedByBlack;
    const adv =
      color === 'w'
        ? Math.max(0, materialState.whiteAdvantage)
        : Math.max(0, -materialState.whiteAdvantage);

    const connectionState: 'connected' | 'waiting' | 'disconnected' | undefined =
      isOnline && onlineRoom
        ? (color === 'w' ? onlineRoom.whiteConnected : onlineRoom.blackConnected)
          ? 'connected'
          : onlineRoom.status === 'waiting'
            ? 'waiting'
            : 'disconnected'
        : undefined;

    return {
      name,
      subtitle,
      color,
      timeMs: color === 'w' ? whiteTimeMs : blackTimeMs,
      untimed,
      isActive: turn === color && (!isOnline || onlineRoom?.status === 'playing'),
      isGameOver,
      capturedPieces,
      materialAdvantage: adv,
      isThinking: isAI && aiThinking && color !== config.playerColor,
      connectionState,
    };
  };

  const topPlayer = getPlayerProps(topColor);
  const bottomPlayer = getPlayerProps(bottomColor);

  const onlineDrawIncoming =
    isOnline &&
    onlineRoom?.drawOfferFrom &&
    onlineAssignedColor &&
    onlineRoom.drawOfferFrom !== onlineAssignedColor;

  const waitingForOnlineOpponent = isOnline && onlineRoom?.status === 'waiting';

  const moveNavigationControls = (
    <div className="flex items-center justify-between gap-1.5 border-t border-white/[0.09] pt-3">
      <button
        type="button"
        disabled={moves.length === 0 || viewPly === 0}
        onClick={() => setViewPly(0)}
        aria-label="First position"
        className="flex-1 flex items-center justify-center rounded-xl glass-tile py-2 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
      >
        <ChevronFirst className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={moves.length === 0 || viewPly === 0}
        onClick={() =>
          setViewPly((prev) => {
            const current = prev === null ? moves.length : prev;
            return Math.max(0, current - 1);
          })
        }
        aria-label="Previous move"
        className="flex-1 flex items-center justify-center rounded-xl glass-tile py-2 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={viewPly === null || viewPly >= moves.length}
        onClick={() =>
          setViewPly((prev) => {
            if (prev === null) return null;
            const next = prev + 1;
            return next >= moves.length ? null : next;
          })
        }
        aria-label="Next move"
        className="flex-1 flex items-center justify-center rounded-xl glass-tile py-2 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={viewPly === null || viewPly >= moves.length}
        onClick={() => setViewPly(null)}
        aria-label="Latest position"
        className="flex-1 flex items-center justify-center rounded-xl glass-tile py-2 text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0] disabled:opacity-35 transition-colors"
      >
        <ChevronLast className="h-4 w-4" />
      </button>
    </div>
  );

  const notationRows = (
    <div className="chess-scroll flex-1 overflow-y-auto pr-1 min-h-[180px] max-h-[420px]">
      {movePairs.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#A5B3A8]">
          {waitingForOnlineOpponent
            ? 'Waiting for opponent to join room…'
            : 'Make the opening move to begin notation.'}
        </div>
      ) : (
        <div className="space-y-0.5 font-mono text-[13px]">
          {movePairs.map((pair, idx) => {
            const activePly = viewPly === null ? moves.length : viewPly;
            const whiteSelected = pair.white && activePly === pair.white.ply;
            const blackSelected = pair.black && activePly === pair.black.ply;
            return (
              <div
                key={pair.moveNumber}
                className={`grid grid-cols-[36px_1fr_1fr] items-center rounded-lg px-1.5 py-1 ${
                  idx % 2 === 1 ? 'bg-white/[0.03]' : 'bg-transparent'
                }`}
              >
                <span className="text-[#A5B3A8] tabular-nums">{pair.moveNumber}.</span>
                {pair.white ? (
                  <button
                    type="button"
                    onClick={() =>
                      setViewPly(pair.white!.ply === moves.length ? null : pair.white!.ply)
                    }
                    className={`text-left rounded-md px-2 py-0.5 transition-colors ${
                      whiteSelected
                        ? 'bg-[#B9D7B9]/20 text-[#DDF0DD] font-medium'
                        : 'text-[#F4F6F0] hover:bg-white/[0.06]'
                    }`}
                  >
                    {pair.white.san}
                  </button>
                ) : (
                  <span />
                )}

                {pair.black ? (
                  <button
                    type="button"
                    onClick={() =>
                      setViewPly(pair.black!.ply === moves.length ? null : pair.black!.ply)
                    }
                    className={`text-left rounded-md px-2 py-0.5 transition-colors ${
                      blackSelected
                        ? 'bg-[#B9D7B9]/20 text-[#DDF0DD] font-medium'
                        : 'text-[#F4F6F0] hover:bg-white/[0.06]'
                    }`}
                  >
                    {pair.black.san}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}
          <div ref={moveListEndRef} />
        </div>
      )}
    </div>
  );

  return (
    <main className="relative z-10 mx-auto max-w-[1440px] px-3 py-4 sm:px-6 lg:px-8 lg:py-6">
      {/* Error, reconnection, or waiting alerts */}
      <AnimatePresence>
        {(engineError || onlineError) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="alert"
            className="mb-4 rounded-[16px] border border-[#E07070]/60 bg-[#E07070]/12 backdrop-blur-md px-4 py-3 text-sm text-[#F4F6F0]"
          >
            {engineError || onlineError}
          </motion.div>
        )}

        {isOnline && onlineReconnecting && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="status"
            className="mb-4 rounded-[16px] glass-surface border-[#E9E5D9]/35 px-4 py-3 font-mono text-xs text-[#E9E5D9]"
          >
            Connection interrupted · Reconnecting to room {onlineRoom?.roomCode || config.roomCode}…
          </motion.div>
        )}
      </AnimatePresence>

      {waitingForOnlineOpponent && onlineRoom && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[18px] glass-tile-active px-4 py-3">
          <div className="space-y-0.5">
            <div className="font-display text-sm font-medium text-[#F4F6F0]">
              Online Room Ready · Share Code with Opponent
            </div>
            <div className="text-xs text-[#A5B3A8]">
              Your opponent can join from Game Modes → Online Multiplayer using this code.
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyRoomCode}
            className="inline-flex items-center gap-2 self-start sm:self-center rounded-xl border border-[#B9D7B9]/45 bg-black/45 px-4 py-2 font-mono text-sm font-semibold tracking-widest text-[#B9D7B9] hover:bg-black/65 transition-colors"
          >
            <span>{onlineRoom.roomCode}</span>
            {copiedRoomCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* 3-Column Desktop Sanctuary / Tablet 2-Col / Mobile Stack */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_350px] gap-4 lg:gap-6 items-start">
        {/* LEFT RAIL (Desktop 300px): Top Clock, Match Status & Controls, Bottom Clock */}
        <aside className="hidden xl:flex flex-col gap-4 sticky top-20">
          <PlayerClockCard {...topPlayer} />

          <div className="rounded-[20px] glass-surface p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.09] pb-3">
              <div>
                <div className="font-mono text-[11px] text-[#A5B3A8]">
                  {isAI
                    ? 'STOCKFISH 19'
                    : isOnline
                      ? `ROOM ${onlineRoom?.roomCode || ''}`
                      : 'LOCAL MATCH'}
                </div>
                <div className="font-display text-sm font-medium text-[#F4F6F0]">
                  {config.timeControl.label} · {config.timeControl.category}
                </div>
              </div>
              {isAI && (
                <div className="text-right">
                  <div className="font-mono text-[11px] text-[#A5B3A8]">EVAL</div>
                  <div className="font-mono text-sm font-semibold text-[#B9D7B9] tabular-nums">
                    {formatEvalDisplay(engineEval.cp, engineEval.mate)}
                  </div>
                </div>
              )}
            </div>

            {statusNotice && (
              <p className="rounded-xl glass-tile px-3 py-2 text-xs text-[#E9E5D9]">
                {statusNotice}
              </p>
            )}

            {/* Incoming Draw Offer (Local or Online) */}
            {(localDrawOfferFrom || onlineDrawIncoming) && !isGameOver && (
              <div className="rounded-[14px] glass-tile-active p-3 space-y-2.5">
                <p className="text-xs font-medium text-[#F4F6F0]">
                  {isLocal
                    ? `${localDrawOfferFrom === 'w' ? config.whiteName : config.blackName} offers a draw.`
                    : 'Opponent offered a draw.'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isOnline) {
                        onlineService.respondDraw(true);
                      } else {
                        finishMatch(
                          'draw',
                          'draw_agreement',
                          'Draw by Mutual Agreement',
                          chessRef.current,
                          moves
                        );
                      }
                    }}
                    className="rounded-xl btn-glass-primary py-1.5 font-mono text-xs font-semibold"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isOnline) onlineService.respondDraw(false);
                      else setLocalDrawOfferFrom(null);
                    }}
                    className="rounded-xl btn-glass-secondary py-1.5 font-mono text-xs"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-glass-secondary py-2.5 font-mono text-xs font-medium"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-[#B9D7B9]" />
                Flip Board
              </button>

              {!isGameOver ? (
                <>
                  <button
                    type="button"
                    disabled={waitingForOnlineOpponent}
                    onClick={() => void handleOfferDraw()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-glass-secondary py-2.5 font-mono text-xs font-medium disabled:opacity-45"
                  >
                    <Handshake className="h-3.5 w-3.5 text-[#E9E5D9]" />
                    Offer Draw
                  </button>

                  {!confirmResign ? (
                    <button
                      type="button"
                      disabled={waitingForOnlineOpponent}
                      onClick={() => setConfirmResign(true)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#E07070]/50 bg-[#E07070]/8 py-2.5 font-mono text-xs font-medium text-[#E07070] hover:bg-[#E07070]/16 disabled:opacity-45 transition-colors"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Resign
                    </button>
                  ) : (
                    <div className="rounded-xl border border-[#E07070]/60 bg-[#E07070]/12 p-2.5 space-y-2">
                      <p className="text-center font-mono text-[11px] text-[#F4F6F0]">
                        Confirm resignation?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleResignConfirm}
                          className="rounded-lg bg-[#E07070] py-1.5 font-mono text-xs font-semibold text-[#0a0f0c] hover:opacity-90"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmResign(false)}
                          className="rounded-lg btn-glass-secondary py-1.5 font-mono text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={onViewResult}
                    className="w-full rounded-xl btn-glass-primary py-2.5 font-mono text-xs font-semibold"
                  >
                    View Match Result & Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isOnline) onlineService.requestRematch();
                      else onRematchLocalOrAI();
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-glass-secondary py-2.5 font-mono text-xs font-medium"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Rematch
                  </button>
                </div>
              )}

              {isOnline && onLeaveOnlineRoom && (
                <button
                  type="button"
                  onClick={onLeaveOnlineRoom}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-glass-secondary py-2 font-mono text-[11px] text-[#A5B3A8] hover:text-[#F4F6F0]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave Room
                </button>
              )}
            </div>
          </div>

          <PlayerClockCard {...bottomPlayer} />
        </aside>

        {/* CENTER: Board Sanctuary */}
        <section className="flex flex-col items-center gap-3 w-full" aria-label="Active Chessboard">
          {/* Mobile & Tablet Top Clock */}
          <div className="w-full max-w-[720px] xl:hidden">
            <PlayerClockCard {...topPlayer} />
          </div>

          {/* History Inspection Banner */}
          {isInspectingHistory && (
            <div className="w-full max-w-[720px] flex items-center justify-between gap-3 rounded-2xl glass-tile-active px-3.5 py-2">
              <span className="font-mono text-xs text-[#F4F6F0]">
                Inspecting move {Math.ceil((viewPly || 0) / 2)} · Board locked
              </span>
              <button
                type="button"
                onClick={() => setViewPly(null)}
                className="rounded-lg btn-glass-primary px-3 py-1 font-mono text-xs font-semibold"
              >
                Return to Live
              </button>
            </div>
          )}

          {/* Game Over inline banner (when reviewing board) */}
          {isGameOver && gameOverBanner && (
            <div className="w-full max-w-[720px] flex flex-wrap items-center justify-between gap-3 rounded-2xl glass-tile-active px-4 py-2.5">
              <span className="font-display text-sm font-medium text-[#F4F6F0]">
                {gameOverBanner}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onViewResult}
                  className="rounded-xl btn-glass-primary px-3 py-1.5 font-mono text-xs font-semibold"
                >
                  Result & Analysis
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isOnline) onlineService.requestRematch();
                    else onRematchLocalOrAI();
                  }}
                  className="rounded-xl btn-glass-secondary px-3 py-1.5 font-mono text-xs"
                >
                  Rematch
                </button>
              </div>
            </div>
          )}

          <ChessBoard
            fen={displayedFen}
            flipped={flipped}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            lastMove={displayedLastMove}
            checkSquare={checkSquare}
            isCheckmate={isCheckmatePos}
            showCoordinates={showCoordinates}
            animatePieces={animatePieces}
            interactive={canInteract}
            canDragSquare={canDragSquare}
            pendingPromotion={pendingPromotion}
            onSquareClick={handleSquareClick}
            onPieceDrop={handlePieceDrop}
            onPromotionSelect={handlePromotionSelect}
            onPromotionCancel={() => setPendingPromotion(null)}
          />

          {/* Mobile & Tablet Bottom Clock */}
          <div className="w-full max-w-[720px] xl:hidden">
            <PlayerClockCard {...bottomPlayer} />
          </div>

          {/* Mobile status notice (draw offers, engine responses, connection notices) */}
          {statusNotice && (
            <p
              role="status"
              data-testid="mobile-status-notice"
              className="w-full max-w-[720px] md:hidden rounded-xl glass-surface px-3.5 py-2.5 text-xs text-[#E9E5D9]"
            >
              {statusNotice}
            </p>
          )}

          {/* Mobile Action Bar (below board) */}
          <div className="w-full max-w-[720px] flex flex-wrap items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl btn-glass-secondary py-2.5 px-3 font-mono text-xs"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-[#B9D7B9]" />
              Flip
            </button>
            {!isGameOver && (
              <>
                <button
                  type="button"
                  disabled={waitingForOnlineOpponent}
                  onClick={() => void handleOfferDraw()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl btn-glass-secondary py-2.5 px-3 font-mono text-xs"
                >
                  <Handshake className="h-3.5 w-3.5 text-[#E9E5D9]" />
                  Draw
                </button>
                <button
                  type="button"
                  disabled={waitingForOnlineOpponent}
                  onClick={() => setConfirmResign((c) => !c)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E07070]/50 bg-[#E07070]/10 py-2.5 px-3 font-mono text-xs text-[#E07070]"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Resign
                </button>
              </>
            )}
            {isOnline && onLeaveOnlineRoom && (
              <button
                type="button"
                onClick={onLeaveOnlineRoom}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl btn-glass-secondary py-2.5 px-3 font-mono text-xs text-[#A5B3A8]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave
              </button>
            )}
          </div>

          {/* Mobile Resign Confirm or Draw Offer */}
          {confirmResign && !isGameOver && (
            <div className="w-full max-w-[720px] md:hidden rounded-xl border border-[#E07070]/60 bg-[#E07070]/12 backdrop-blur-md p-3 flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-[#F4F6F0]">Confirm resignation?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResignConfirm}
                  className="rounded-lg bg-[#E07070] px-3 py-1.5 font-mono text-xs font-semibold text-[#0a0f0c]"
                >
                  Resign
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResign(false)}
                  className="rounded-lg btn-glass-secondary px-3 py-1.5 font-mono text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(localDrawOfferFrom || onlineDrawIncoming) && !isGameOver && (
            <div className="w-full max-w-[720px] xl:hidden rounded-xl glass-tile-active p-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[#F4F6F0]">Draw offer received</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isOnline) onlineService.respondDraw(true);
                    else
                      finishMatch(
                        'draw',
                        'draw_agreement',
                        'Draw by Mutual Agreement',
                        chessRef.current,
                        moves
                      );
                  }}
                  className="rounded-lg btn-glass-primary px-3 py-1.5 font-mono text-xs font-semibold"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isOnline) onlineService.respondDraw(false);
                    else setLocalDrawOfferFrom(null);
                  }}
                  className="rounded-lg btn-glass-secondary px-3 py-1.5 font-mono text-xs"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Mobile Expandable Move Notation Sheet */}
          <div className="w-full max-w-[720px] md:hidden rounded-[20px] glass-surface p-4">
            <button
              type="button"
              onClick={() => setMobileNotationOpen((o) => !o)}
              aria-expanded={mobileNotationOpen}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <span className="font-display text-sm font-medium text-[#F4F6F0]">
                  Move Notation
                </span>
                <span className="ml-2 font-mono text-xs text-[#A5B3A8]">
                  · {moves.length} plies
                </span>
              </div>
              {mobileNotationOpen ? (
                <ChevronUp className="h-4 w-4 text-[#A5B3A8]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#A5B3A8]" />
              )}
            </button>
            {mobileNotationOpen && (
              <div className="mt-3 space-y-3">
                {notationRows}
                {moveNavigationControls}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL (Desktop 360px & Tablet 320px): Notation, Evaluation & Tablet Controls */}
        <aside className="hidden md:flex flex-col rounded-[20px] glass-surface p-5 gap-4 sticky top-20">
          <div className="flex items-center justify-between border-b border-white/[0.09] pb-3">
            <div>
              <h2 className="font-display text-base font-medium text-[#F4F6F0]">Move History</h2>
              <p className="font-mono text-[11px] text-[#A5B3A8]">
                {isGameOver ? 'Match Completed' : turn === 'w' ? 'White to move' : 'Black to move'} ·{' '}
                {moves.length} plies
              </p>
            </div>
            {isAI && (
              <div className="font-mono text-xs text-[#B9D7B9] tabular-nums">
                {formatEvalDisplay(engineEval.cp, engineEval.mate)}
              </div>
            )}
          </div>

          {notationRows}
          {moveNavigationControls}

          {/* Tablet-only controls (since left rail is hidden below xl) */}
          <div className="xl:hidden border-t border-white/[0.09] pt-3 space-y-2">
            {statusNotice && (
              <p className="rounded-xl glass-tile px-3 py-2 text-xs text-[#E9E5D9]">
                {statusNotice}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="rounded-xl btn-glass-secondary py-2 font-mono text-xs"
              >
                Flip
              </button>
              <button
                type="button"
                disabled={isGameOver || waitingForOnlineOpponent}
                onClick={() => void handleOfferDraw()}
                className="rounded-xl btn-glass-secondary py-2 font-mono text-xs disabled:opacity-45"
              >
                Draw
              </button>
              <button
                type="button"
                disabled={isGameOver || waitingForOnlineOpponent}
                onClick={() => setConfirmResign((c) => !c)}
                className="rounded-xl border border-[#E07070]/50 bg-[#E07070]/10 py-2 font-mono text-xs text-[#E07070] disabled:opacity-45"
              >
                Resign
              </button>
            </div>
            {isOnline && onLeaveOnlineRoom && (
              <button
                type="button"
                onClick={onLeaveOnlineRoom}
                className="w-full rounded-xl btn-glass-secondary py-1.5 font-mono text-[11px] text-[#A5B3A8] hover:text-[#F4F6F0]"
              >
                Leave Online Room
              </button>
            )}
            {confirmResign && !isGameOver && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E07070]/60 bg-[#E07070]/12 p-2">
                <span className="font-mono text-[11px] text-[#F4F6F0]">Confirm?</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleResignConfirm}
                    className="rounded-lg bg-[#E07070] px-2.5 py-1 font-mono text-xs font-semibold text-[#0a0f0c]"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResign(false)}
                    className="rounded-lg btn-glass-secondary px-2.5 py-1 font-mono text-xs"
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onExitToModes}
            className="text-left font-mono text-[11px] text-[#A5B3A8] hover:text-[#F4F6F0] pt-1 transition-colors"
          >
            ← Switch Game Mode
          </button>
        </aside>
      </div>
    </main>
  );
};
