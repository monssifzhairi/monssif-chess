import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getBoardMap, getOrderedSquares, isDarkSquare, type LegalTarget } from '../chess/rules';
import type { PieceColor, PieceType } from '../types/chess';
import { ChessPieceIcon } from './ChessPieceIcon';

interface ChessBoardProps {
  fen: string;
  flipped: boolean;
  selectedSquare: string | null;
  legalTargets: LegalTarget[];
  lastMove: { from: string; to: string; isCapture?: boolean } | null;
  checkSquare: string | null;
  isCheckmate?: boolean;
  showCoordinates?: boolean;
  animatePieces?: boolean;
  interactive: boolean;
  canDragSquare?: (square: string) => boolean;
  pendingPromotion: { from: string; to: string; color: PieceColor } | null;
  onSquareClick: (square: string) => void;
  onPieceDrop?: (from: string, to: string) => void;
  onPromotionSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onPromotionCancel: () => void;
}

interface DragState {
  from: string;
  pieceType: PieceType;
  pieceColor: PieceColor;
  startX: number;
  startY: number;
  x: number;
  y: number;
  size: number;
  active: boolean;
  hoverSquare: string | null;
}

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  flipped,
  selectedSquare,
  legalTargets,
  lastMove,
  checkSquare,
  isCheckmate = false,
  showCoordinates = true,
  animatePieces = true,
  interactive,
  canDragSquare,
  pendingPromotion,
  onSquareClick,
  onPieceDrop,
  onPromotionSelect,
  onPromotionCancel,
}) => {
  const squares = useMemo(() => getOrderedSquares(flipped), [flipped]);
  const boardMap = useMemo(() => getBoardMap(fen), [fen]);
  const targetMap = useMemo(() => {
    const map = new Map<string, LegalTarget>();
    for (const t of legalTargets) map.set(t.to, t);
    return map;
  }, [legalTargets]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef<boolean>(false);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  // Cancel active drag if board becomes non-interactive or position updates externally
  useEffect(() => {
    if (!interactive && dragRef.current) {
      setDrag(null);
    }
  }, [interactive, fen]);

  // Support Escape key to cancel pending pawn promotion
  useEffect(() => {
    if (!pendingPromotion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPromotionCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPromotionCancel, pendingPromotion]);

  const resolveSquareFromPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const grid = gridRef.current;
      if (!grid) return null;
      const rect = grid.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      const col = Math.min(7, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8)));
      const row = Math.min(7, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8)));
      return squares[row * 8 + col] ?? null;
    },
    [squares]
  );

  // Global pointer tracking for smooth drag-and-drop
  useEffect(() => {
    if (!drag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      const movedEnough = current.active || Math.hypot(dx, dy) >= 6;
      const hoverSquare = movedEnough ? resolveSquareFromPoint(e.clientX, e.clientY) : current.hoverSquare;

      if (movedEnough && !current.active && selectedSquare !== current.from) {
        // Trigger selection so legal move indicators highlight immediately while dragging
        onSquareClick(current.from);
      }

      setDrag({
        ...current,
        x: e.clientX,
        y: e.clientY,
        active: movedEnough,
        hoverSquare,
      });
    };

    const finishDrag = (e: PointerEvent) => {
      const current = dragRef.current;
      setDrag(null);
      if (!current || !current.active) return;

      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 60);

      const dropSquare = resolveSquareFromPoint(e.clientX, e.clientY);
      if (dropSquare && dropSquare !== current.from) {
        if (onPieceDrop) {
          onPieceDrop(current.from, dropSquare);
        } else {
          onSquareClick(dropSquare);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [drag !== null, onPieceDrop, onSquareClick, resolveSquareFromPoint, selectedSquare]);

  const handleSquarePointerDown = (
    sq: string,
    e: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (!interactive || e.button !== 0 || pendingPromotion) return;
    const piece = boardMap.get(sq);
    if (!piece) return;
    if (canDragSquare && !canDragSquare(sq)) return;

    const gridRect = gridRef.current?.getBoundingClientRect();
    const squareSize = gridRect ? gridRect.width / 8 : 64;

    setDrag({
      from: sq,
      pieceType: piece.type,
      pieceColor: piece.color,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      size: squareSize,
      active: false,
      hoverSquare: sq,
    });
  };

  return (
    <motion.div
      animate={{ scale: 1 }}
      className="relative w-full max-w-[720px] aspect-square mx-auto rounded-[24px] glass-surface-elevated p-2 sm:p-2.5 select-none"
    >
      <div
        ref={gridRef}
        className={`grid grid-cols-8 grid-rows-8 w-full h-full rounded-[16px] overflow-hidden border border-white/[0.16] shadow-[0_8px_28px_rgba(0,0,0,0.45)] ${
          interactive ? 'touch-none' : ''
        }`}
        role="grid"
        aria-label="Chessboard"
        data-testid="chessboard-grid"
        data-flipped={flipped ? 'true' : 'false'}
      >
        {squares.map((sq, index) => {
          const row = Math.floor(index / 8);
          const col = index % 8;
          const dark = isDarkSquare(sq);
          const piece = boardMap.get(sq);
          const isSelected = selectedSquare === sq;
          const target = targetMap.get(sq);
          const isLastFrom = lastMove?.from === sq;
          const isLastTo = lastMove?.to === sq;
          const isLastMove = isLastFrom || isLastTo;
          const isCheck = checkSquare === sq;
          const isDragOrigin = Boolean(drag?.active && drag.from === sq);
          const isDragHover = Boolean(
            drag?.active && drag.hoverSquare === sq && sq !== drag.from
          );
          const draggablePiece = Boolean(
            interactive && piece && (!canDragSquare || canDragSquare(sq))
          );

          const showRankCoord = showCoordinates && col === 0;
          const showFileCoord = showCoordinates && row === 7;
          const coordColor = dark ? 'text-[#dedcd0]/85' : 'text-[#395543]';

          const baseBg = dark ? 'bg-[#4f725c]' : 'bg-[#dedcd0]';

          const pieceLabel = piece
            ? `${piece.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[piece.type]}`
            : 'Empty';

          return (
            <button
              key={sq}
              type="button"
              data-square={sq}
              data-piece={piece ? `${piece.color}${piece.type}` : ''}
              disabled={!interactive}
              onPointerDown={(e) => handleSquarePointerDown(sq, e)}
              onClick={() => {
                if (suppressNextClickRef.current) return;
                onSquareClick(sq);
              }}
              aria-label={`Square ${sq}, ${pieceLabel}${target ? ', legal move' : ''}`}
              className={`relative flex items-center justify-center w-full h-full p-0 border-0 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#111713] transition-colors duration-100 ${baseBg} ${
                interactive ? (draggablePiece ? 'cursor-grab active:cursor-grabbing touch-none' : 'cursor-pointer') : 'cursor-default'
              }`}
            >
              {/* Last move subtle highlight */}
              {isLastMove && !isSelected && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[#B9D7B9]/32 transition-opacity duration-150"
                />
              )}

              {/* Capture burst flash on destination square */}
              {isLastTo && lastMove?.isCapture && animatePieces && (
                <motion.span
                  key={`cap-${sq}-${fen}`}
                  initial={{ scale: 0.45, opacity: 0.75 }}
                  animate={{ scale: 1.05, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[10%] z-10 rounded-full border-2 border-[#E9E5D9]"
                />
              )}

              {/* Selected square highlight */}
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[#B9D7B9]/45 ring-2 ring-inset ring-[#203B2D]"
                />
              )}

              {/* Drag-over target highlight */}
              {isDragHover && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 z-10 ring-3 ring-inset ${
                    target
                      ? 'bg-[#B9D7B9]/35 ring-[#E9E5D9]'
                      : 'ring-[#111713]/45'
                  }`}
                />
              )}

              {/* Check / Checkmate highlight */}
              {isCheck && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 bg-[rgba(215,107,107,0.45)] ${
                    isCheckmate ? 'board-check-pulse' : 'ring-2 ring-inset ring-[#D76B6B]'
                  }`}
                />
              )}

              {/* Coordinates */}
              {showRankCoord && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-0.5 left-1 font-mono text-[10px] sm:text-[11px] font-semibold leading-none select-none ${coordColor}`}
                >
                  {sq[1]}
                </span>
              )}
              {showFileCoord && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute bottom-0.5 right-1 font-mono text-[10px] sm:text-[11px] font-semibold leading-none select-none ${coordColor}`}
                >
                  {sq[0]}
                </span>
              )}

              {/* Chess piece with subtle arrival animation on landed square */}
              {piece && (
                <motion.div
                  key={animatePieces && isLastTo ? `moved-${sq}-${piece.color}${piece.type}` : 'static'}
                  initial={animatePieces && isLastTo ? { scale: 0.86, opacity: 0.72 } : false}
                  animate={{
                    scale: isSelected && !isDragOrigin ? 1.06 : 1,
                    opacity: isDragOrigin ? 0.25 : 1,
                  }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-10 flex items-center justify-center w-[82%] h-[82%] pointer-events-none"
                >
                  <ChessPieceIcon
                    type={piece.type}
                    color={piece.color}
                    className="w-full h-full"
                  />
                </motion.div>
              )}

              {/* Checkmate badge on mated king */}
              {isCheck && isCheckmate && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0.5 right-0.5 z-20 rounded bg-[#D76B6B] px-1 font-mono text-[9px] font-bold text-[#111713]"
                >
                  #
                </span>
              )}

              {/* Legal move pip (empty square) */}
              {target && !target.isCapture && !piece && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none relative z-10 h-[28%] w-[28%] rounded-full bg-[#203B2D]/55 ring-2 ring-[#B9D7B9]/65 ${
                    animatePieces ? 'board-pip-enter' : ''
                  }`}
                />
              )}

              {/* Capture indicator ring (occupied or en-passant target) */}
              {target && (target.isCapture || piece) && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-[6%] z-20 rounded-full border-[3px] border-[#203B2D]/75 ring-1 ring-[#B9D7B9]/75 ${
                    animatePieces ? 'board-pip-enter' : ''
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Floating dragged piece ghost */}
      {drag?.active && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-50 drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
          style={{
            width: drag.size * 0.92,
            height: drag.size * 0.92,
            transform: `translate3d(${drag.x - (drag.size * 0.92) / 2}px, ${
              drag.y - (drag.size * 0.92) / 2
            }px, 0) scale(1.08)`,
          }}
        >
          <ChessPieceIcon
            type={drag.pieceType}
            color={drag.pieceColor}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Pawn promotion modal overlay */}
      <AnimatePresence>
        {pendingPromotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-0 z-30 flex items-center justify-center rounded-[24px] bg-[#060b08]/72 backdrop-blur-xl p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Choose pawn promotion piece"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xs rounded-[22px] glass-surface-elevated p-5"
            >
              <h3 className="font-display text-lg font-medium text-[#F4F6F0]">
                Promote Pawn
              </h3>
              <p className="mt-1 text-xs text-[#A5B3A8]">
                Select piece for {pendingPromotion.to.toUpperCase()}
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {(['q', 'r', 'b', 'n'] as const).map((promoType) => {
                  const labelMap = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
                  return (
                    <motion.button
                      key={promoType}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onPromotionSelect(promoType)}
                      aria-label={`Promote to ${labelMap[promoType]}`}
                      className="flex flex-col items-center gap-1 rounded-xl glass-tile p-2.5 hover:border-[#B9D7B9]/60 hover:bg-[#203B2D]/45 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
                    >
                      <ChessPieceIcon
                        type={promoType}
                        color={pendingPromotion.color}
                        className="w-9 h-9"
                      />
                      <span className="font-mono text-[11px] text-[#E9E5D9]">
                        {labelMap[promoType]}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={onPromotionCancel}
                className="mt-4 w-full rounded-xl btn-glass-secondary py-2 font-mono text-xs text-[#A5B3A8] hover:text-[#F4F6F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
              >
                Cancel (Esc)
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
