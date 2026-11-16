import React from 'react';
import { motion } from 'motion/react';
import { formatClockMs } from '../chess/rules';
import type { PieceColor, PieceType } from '../types/chess';
import { ChessPieceIcon } from './ChessPieceIcon';

interface PlayerClockCardProps {
  name: string;
  subtitle: string;
  color: PieceColor;
  timeMs: number;
  untimed: boolean;
  isActive: boolean;
  isGameOver: boolean;
  capturedPieces: PieceType[];
  materialAdvantage: number;
  isThinking?: boolean;
  connectionState?: 'connected' | 'waiting' | 'disconnected';
}

export const PlayerClockCard: React.FC<PlayerClockCardProps> = ({
  name,
  subtitle,
  color,
  timeMs,
  untimed,
  isActive,
  isGameOver,
  capturedPieces,
  materialAdvantage,
  isThinking = false,
  connectionState,
}) => {
  const isTimeTrouble = !untimed && isActive && !isGameOver && timeMs > 0 && timeMs < 30_000;
  const activeState = isActive && !isGameOver;

  return (
    <div
      data-testid={`player-card-${color}`}
      className={`rounded-[18px] transition-all duration-150 px-3.5 py-3 ${
        isTimeTrouble
          ? 'glass-surface clock-time-trouble border-[#E07070]/80'
          : activeState
            ? 'glass-tile-active'
            : 'glass-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
              color === 'w'
                ? 'border-white/30 bg-[#E9E5D9]/90 text-[#111713] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]'
                : 'border-white/15 bg-black/50 text-[#F4F6F0] backdrop-blur-md'
            }`}
            aria-hidden="true"
          >
            <ChessPieceIcon type="k" color={color} className="w-6 h-6" />
            {activeState && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${
                  isTimeTrouble ? 'bg-[#E07070]' : 'bg-[#B9D7B9]'
                } ring-2 ring-[#0c140f]`}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm sm:text-base font-medium text-[#F4F6F0] truncate">
                {name}
              </span>
              {isThinking && (
                <span className="font-mono text-[11px] text-[#B9D7B9] whitespace-nowrap">
                  Thinking…
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#A5B3A8] truncate">
              <span className="truncate">{subtitle}</span>
              {connectionState && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={
                      connectionState === 'connected'
                        ? 'text-[#B9D7B9]'
                        : connectionState === 'waiting'
                          ? 'text-[#E9E5D9]'
                          : 'text-[#E07070]'
                    }
                  >
                    {connectionState === 'connected'
                      ? 'Online'
                      : connectionState === 'waiting'
                        ? 'Waiting'
                        : 'Disconnected'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Clock */}
        <div
          data-testid={`clock-${color}`}
          className={`shrink-0 rounded-xl px-2.5 py-1 font-mono text-lg sm:text-xl font-medium tabular-nums tracking-tight ${
            untimed
              ? 'text-[#A5B3A8] text-sm sm:text-base'
              : isTimeTrouble
                ? 'border border-[#E07070]/45 bg-[#E07070]/14 text-[#E07070]'
                : activeState
                  ? 'border border-white/[0.14] bg-black/40 text-[#F4F6F0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-[#A5B3A8]'
          }`}
        >
          {untimed ? '∞' : formatClockMs(timeMs)}
        </div>
      </div>

      {/* Captured pieces & material diff */}
      {(capturedPieces.length > 0 || materialAdvantage > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2">
          <div className="flex flex-wrap items-center gap-0.5 min-h-[18px]">
            {capturedPieces.map((p, idx) => (
              <ChessPieceIcon
                key={`${p}-${idx}`}
                type={p}
                color={color === 'w' ? 'b' : 'w'}
                className="w-4 h-4"
              />
            ))}
          </div>
          {materialAdvantage > 0 && (
            <span className="font-mono text-xs font-medium text-[#B9D7B9] tabular-nums">
              +{materialAdvantage}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
