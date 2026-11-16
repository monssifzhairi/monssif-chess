import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Copy,
  Cpu,
  Globe,
  History,
  Lock,
  Sliders,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { getBoardMap, getOrderedSquares, isDarkSquare } from '../chess/rules';
import type { PlayerStats, PlayerUser, SavedMatchRecord, ScreenId } from '../types/chess';
import { ChessPieceIcon } from './ChessPieceIcon';
import { MonssifLogo } from './MonssifLogo';

interface DashboardScreenProps {
  matchHistory: SavedMatchRecord[];
  hasActiveMatch: boolean;
  user: PlayerUser | null;
  authLoading?: boolean;
  stats: PlayerStats;
  onNavigate: (screen: ScreenId) => void;
  onOpenModeTab?: (tab: 'local' | 'online') => void;
  onQuickStartAI: () => void;
  onClearHistory: () => void;
  onOpenAuth: (mode: 'login' | 'register', reason?: string) => void;
}

// Crisp opening position showcase (Ruy Lopez / Morphy Defense)
const HERO_PREVIEW_FEN = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  matchHistory,
  hasActiveMatch,
  user,
  authLoading = false,
  stats,
  onNavigate,
  onOpenModeTab,
  onQuickStartAI,
  onClearHistory,
  onOpenAuth,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const previewSquares = useMemo(() => getOrderedSquares(false), []);
  const previewPieces = useMemo(() => getBoardMap(HERO_PREVIEW_FEN), []);

  const handleCopyPgn = async (record: SavedMatchRecord) => {
    try {
      await navigator.clipboard.writeText(record.pgn || record.finalFen);
      setCopiedId(record.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <main className="relative z-10 mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-8">
      {/* Hero Glass Sanctuary */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[24px] glass-surface-elevated p-6 sm:p-8 lg:p-10"
      >
        {/* Subtle internal glass light refraction */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-20 h-80 w-80 rounded-full bg-[#B9D7B9]/12 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#2E754F]/22 blur-3xl"
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <MonssifLogo size={48} showWordmark showTagline />

            <h1 className="font-display text-3xl sm:text-4xl lg:text-[46px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#F4F6F0] text-balance">
              Precision tournament chess built for focused calculation.
            </h1>

            <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-[#A5B3A8]">
              Challenge the Stockfish 19 engine across four calibrated strength tiers, share a local
              board on one device, create an instant WebSocket room for online play, and review
              full engine move-by-move accuracy.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                data-start="true"
                onClick={onQuickStartAI}
                className="inline-flex items-center gap-2 rounded-xl btn-glass-primary px-5 py-3 font-mono text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9E5D9]"
              >
                Quick Match vs Stockfish
                <ArrowRight className="h-4 w-4" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => onNavigate('modes')}
                className="inline-flex items-center gap-2 rounded-xl btn-glass-secondary px-5 py-3 font-mono text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
              >
                Select Game Mode
              </motion.button>

              {hasActiveMatch && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onNavigate('game')}
                  className="inline-flex items-center gap-2 rounded-xl glass-tile-active px-5 py-3 font-mono text-sm font-medium text-[#DDF0DD] hover:brightness-110 transition-all"
                >
                  Resume Active Match
                </motion.button>
              )}
            </div>
          </div>

          {/* Frosted Glass Live Chessboard Showcase */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div
              className="w-full max-w-[316px] aspect-square rounded-[22px] glass-surface p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
              aria-hidden="true"
            >
              <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-[14px] overflow-hidden border border-white/[0.14]">
                {previewSquares.map((sq) => {
                  const dark = isDarkSquare(sq);
                  const piece = previewPieces.get(sq);
                  const isHighlighted = sq === 'b5' || sq === 'a6';
                  return (
                    <div
                      key={sq}
                      className={`relative flex items-center justify-center ${
                        dark ? 'bg-[#4f725c]' : 'bg-[#dedcd0]'
                      }`}
                    >
                      {isHighlighted && (
                        <span className="absolute inset-0 bg-[#B9D7B9]/35" />
                      )}
                      {piece && (
                        <ChessPieceIcon
                          type={piece.type}
                          color={piece.color}
                          className="relative z-10 w-[82%] h-[82%]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Core Game Modes Grid */}
      <section aria-labelledby="modes-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 id="modes-heading" className="font-display text-xl font-medium text-[#F4F6F0]">
              Game Modes
            </h2>
            <p className="text-sm text-[#A5B3A8]">Choose your opponent and time format</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('modes')}
            className="font-mono text-xs text-[#B9D7B9] hover:text-[#d9edd9] hover:underline underline-offset-4 whitespace-nowrap transition-colors"
          >
            Open Mode Selector →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.button
            type="button"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onNavigate('ai-setup')}
            className="group text-left rounded-[20px] glass-surface p-6 hover:border-[#B9D7B9]/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#B9D7B9]">
                <Cpu className="h-5 w-5" />
              </div>
              <span className="font-mono text-xs text-[#A5B3A8]">Stockfish 19</span>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-[#F4F6F0]">
              Player vs AI
            </h3>
            <p className="mt-1.5 text-sm text-[#A5B3A8] leading-relaxed">
              Four distinct UCI engine tiers from Easy (~800 ELO) to Full-Strength Expert.
            </p>
            <div className="mt-4 font-mono text-xs text-[#B9D7B9] group-hover:translate-x-0.5 transition-transform">
              Configure AI Match →
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => (onOpenModeTab ? onOpenModeTab('local') : onNavigate('modes'))}
            className="group text-left rounded-[20px] glass-surface p-6 hover:border-[#B9D7B9]/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#E9E5D9]">
                <Users className="h-5 w-5" />
              </div>
              {!user && !authLoading ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs text-[#E9C46A]">
                  <Lock className="h-3 w-3" />
                  Sign In
                </span>
              ) : (
                <span className="font-mono text-xs text-[#A5B3A8]">Single Device</span>
              )}
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-[#F4F6F0]">
              Local Multiplayer
            </h3>
            <p className="mt-1.5 text-sm text-[#A5B3A8] leading-relaxed">
              Two-player over-the-board play with dual clocks, auto-flip option, and draw offers.
            </p>
            <div className="mt-4 font-mono text-xs text-[#B9D7B9] group-hover:translate-x-0.5 transition-transform">
              {!user && !authLoading ? 'Requires Account →' : 'Setup Local Board →'}
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => (onOpenModeTab ? onOpenModeTab('online') : onNavigate('modes'))}
            className="group text-left rounded-[20px] glass-surface p-6 hover:border-[#B9D7B9]/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#B9D7B9]">
                <Globe className="h-5 w-5" />
              </div>
              {!user && !authLoading ? (
                <span className="inline-flex items-center gap-1 font-mono text-xs text-[#E9C46A]">
                  <Lock className="h-3 w-3" />
                  Sign In
                </span>
              ) : (
                <span className="font-mono text-xs text-[#A5B3A8]">WebSocket Rooms</span>
              )}
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-[#F4F6F0]">
              Online Multiplayer
            </h3>
            <p className="mt-1.5 text-sm text-[#A5B3A8] leading-relaxed">
              Create a private 6-character match room and play live across separate devices.
            </p>
            <div className="mt-4 font-mono text-xs text-[#B9D7B9] group-hover:translate-x-0.5 transition-transform">
              {!user && !authLoading ? 'Requires Account →' : 'Create or Join Room →'}
            </div>
          </motion.button>
        </div>
      </section>

      {/* Match History + Real Player Account & Stats */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-[20px] glass-surface p-6">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.09] pb-4">
            <div className="flex items-center gap-2.5">
              <History className="h-4 w-4 text-[#B9D7B9]" />
              <h2 className="font-display text-lg font-medium text-[#F4F6F0]">
                {user ? 'Account Match History' : 'Session Match History'}
              </h2>
              <span className="font-mono text-xs text-[#A5B3A8]">
                · {matchHistory.length} recorded
              </span>
            </div>

            {matchHistory.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1.5 rounded-xl btn-glass-secondary px-3 py-1.5 font-mono text-xs text-[#A5B3A8] hover:text-[#E07070] hover:border-[#E07070]/50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          {matchHistory.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-medium text-[#F4F6F0]">
                {user
                  ? 'No completed matches recorded on your account yet.'
                  : 'No completed matches in this browser yet.'}
              </p>
              <p className="text-xs text-[#A5B3A8] max-w-md mx-auto leading-relaxed">
                Completed AI, local, and online games are recorded with full PGN notation and used
                to compute your real match statistics.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {matchHistory.slice(0, 8).map((item) => {
                const outcomeText =
                  item.winner === 'draw'
                    ? 'Draw'
                    : item.winner === 'w'
                      ? `${item.whiteName} Won`
                      : `${item.blackName} Won`;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-[#F4F6F0] truncate">
                        <span>{item.whiteName}</span>
                        <span className="text-[#A5B3A8] font-normal">vs</span>
                        <span>{item.blackName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#A5B3A8]">
                        <span className="text-[#B9D7B9]">{outcomeText}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.reasonLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{Math.ceil(item.totalPlies / 2)} moves</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.timeControlLabel}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyPgn(item)}
                      className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-xl btn-glass-secondary px-3 py-1.5 font-mono text-xs shrink-0"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#B9D7B9]" />
                          Copied PGN
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-[#A5B3A8]" />
                          Copy PGN
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Player Profile & Real Computed Metrics */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-[20px] glass-surface p-6 space-y-4">
            {authLoading ? (
              <div className="space-y-4 animate-pulse" aria-label="Loading player profile">
                <div className="flex items-center gap-3 border-b border-white/[0.09] pb-3.5">
                  <div className="h-8 w-8 rounded-xl bg-white/10" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-28 rounded bg-white/10" />
                    <div className="h-3 w-36 rounded bg-white/10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-xl glass-tile" />
                  <div className="h-16 rounded-xl glass-tile" />
                  <div className="h-16 rounded-xl glass-tile" />
                  <div className="h-16 rounded-xl glass-tile" />
                </div>
                <div className="h-9 rounded-xl bg-white/10" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.09] pb-3.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl glass-tile text-[#B9D7B9] shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-medium text-[#F4F6F0] truncate">
                        {user ? user.displayName : 'Guest · Vs Bot Only'}
                      </h2>
                      <p className="font-mono text-[11px] text-[#A5B3A8] truncate">
                        {user ? `@${user.username} · ${user.titleBadge}` : 'Sign in to unlock multiplayer'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('account')}
                    aria-label="Open profile and board settings"
                    className="flex h-8 w-8 items-center justify-center rounded-xl btn-glass-secondary text-[#A5B3A8] hover:text-[#F4F6F0] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl glass-tile p-3">
                    <dt className="font-mono text-[10px] text-[#A5B3A8]">GAMES PLAYED</dt>
                    <dd className="mt-1 font-mono text-lg font-semibold text-[#F4F6F0] tabular-nums">
                      {stats.totalGames}
                    </dd>
                  </div>
                  <div className="rounded-xl glass-tile p-3">
                    <dt className="font-mono text-[10px] text-[#A5B3A8]">WIN RATE</dt>
                    <dd className="mt-1 font-mono text-lg font-semibold text-[#B9D7B9] tabular-nums">
                      {stats.winRatePct}%
                    </dd>
                  </div>
                  <div className="rounded-xl glass-tile p-3">
                    <dt className="font-mono text-[10px] text-[#A5B3A8]">W / D / L</dt>
                    <dd className="mt-1 font-mono text-sm font-medium text-[#E9E5D9] tabular-nums">
                      {stats.wins} / {stats.draws} / {stats.losses}
                    </dd>
                  </div>
                  <div className="rounded-xl glass-tile p-3">
                    <dt className="font-mono text-[10px] text-[#A5B3A8]">AVG MOVES</dt>
                    <dd className="mt-1 font-mono text-sm font-medium text-[#F4F6F0] tabular-nums">
                      {stats.avgMoves}
                    </dd>
                  </div>
                </dl>

                {user ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('account')}
                    className="w-full rounded-xl btn-glass-secondary py-2.5 font-mono text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
                  >
                    Manage Profile & Preferences →
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login')}
                      className="rounded-xl btn-glass-secondary py-2.5 font-mono text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('register')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl btn-glass-primary py-2.5 font-mono text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9E5D9]"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Register
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-[20px] glass-surface p-6 space-y-3">
            <h2 className="font-display text-base font-medium text-[#F4F6F0]">Active Modules</h2>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#F4F6F0]">Stockfish 19 Engine & Analysis</dt>
                <dd className="font-mono text-[#B9D7B9]">Active</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#F4F6F0]">Local Pass & Play</dt>
                <dd className={`font-mono ${user ? 'text-[#B9D7B9]' : 'text-[#E9C46A]'}`}>
                  {user ? 'Unlocked' : 'Sign In'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#F4F6F0]">WebSocket Live Rooms</dt>
                <dd className={`font-mono ${user ? 'text-[#B9D7B9]' : 'text-[#E9C46A]'}`}>
                  {user ? 'Unlocked' : 'Sign In'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#F4F6F0]">Offline Android PWA</dt>
                <dd className="font-mono text-[#B9D7B9]">Ready</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
    </main>
  );
};
