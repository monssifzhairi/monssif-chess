import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Cpu, Globe, Loader2, Lock, LogIn, UserPlus, Users } from 'lucide-react';
import { getModeGateMessage } from '../chess/accessControl';
import { TIME_CONTROLS } from '../chess/rules';
import type { ColorPreference, TimeControl } from '../types/chess';

interface ModeSelectionScreenProps {
  isAuthenticated: boolean;
  authLoading?: boolean;
  initialPanel?: 'local' | 'online';
  defaultName?: string;
  defaultTimeId?: string;
  defaultAutoFlip?: boolean;
  onBack: () => void;
  onSelectAI: () => void;
  onOpenAuth: (mode: 'login' | 'register', reason?: string) => void;
  onStartLocal: (opts: {
    whiteName: string;
    blackName: string;
    timeControl: TimeControl;
    autoFlip: boolean;
  }) => void;
  onCreateOnlineRoom: (opts: {
    playerName: string;
    colorPref: ColorPreference;
    timeControl: TimeControl;
  }) => Promise<void>;
  onJoinOnlineRoom: (opts: { roomCode: string; playerName: string }) => Promise<void>;
  onlineError: string | null;
  onlineConnecting: boolean;
}

export const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({
  isAuthenticated,
  authLoading = false,
  initialPanel = 'local',
  defaultName,
  defaultTimeId,
  defaultAutoFlip,
  onBack,
  onSelectAI,
  onOpenAuth,
  onStartLocal,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onlineError,
  onlineConnecting,
}) => {
  const [selectedPanel, setSelectedPanel] = useState<'local' | 'online'>(initialPanel);

  useEffect(() => {
    setSelectedPanel(initialPanel);
  }, [initialPanel]);

  // Local configuration
  const [whiteName, setWhiteName] = useState(defaultName || 'White Player');
  const [blackName, setBlackName] = useState('Black Player');
  const [localTimeId, setLocalTimeId] = useState(defaultTimeId || 'rapid-10-0');
  const [autoFlip, setAutoFlip] = useState(Boolean(defaultAutoFlip));

  // Online configuration
  const [onlineName, setOnlineName] = useState(defaultName || 'Monssif Player');
  const [onlineColorPref, setOnlineColorPref] = useState<ColorPreference>('random');
  const [onlineTimeId, setOnlineTimeId] = useState(defaultTimeId || 'blitz-5-0');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (defaultName) {
      setWhiteName((prev) => (prev === 'White Player' ? defaultName : prev));
      setOnlineName((prev) => (prev === 'Monssif Player' ? defaultName : prev));
    }
  }, [defaultName]);

  useEffect(() => {
    if (defaultTimeId) {
      setLocalTimeId(defaultTimeId);
      setOnlineTimeId(defaultTimeId);
    }
  }, [defaultTimeId]);

  useEffect(() => {
    if (defaultAutoFlip !== undefined) {
      setAutoFlip(defaultAutoFlip);
    }
  }, [defaultAutoFlip]);

  const localTc = TIME_CONTROLS.find((t) => t.id === localTimeId) || TIME_CONTROLS[3];
  const onlineTc = TIME_CONTROLS.find((t) => t.id === onlineTimeId) || TIME_CONTROLS[2];

  return (
    <main className="relative z-10 mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-[#A5B3A8] hover:text-[#F4F6F0] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-[#F4F6F0]">
            Select Game Mode
          </h1>
          <p className="mt-1 text-sm text-[#A5B3A8]">
            Play against Stockfish 19, share a local board, or challenge an opponent online.
          </p>
        </div>
      </div>

      {/* 3 Primary Glass Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.button
          type="button"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          onClick={onSelectAI}
          className="text-left rounded-[20px] glass-surface p-6 hover:border-[#B9D7B9]/45 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#B9D7B9]">
              <Cpu className="h-5 w-5" />
            </div>
            <span className="font-mono text-xs text-[#A5B3A8]">Engine</span>
          </div>
          <h2 className="mt-4 font-display text-xl font-medium text-[#F4F6F0]">Player vs AI</h2>
          <p className="mt-1.5 text-sm text-[#A5B3A8]">
            Configure Stockfish 19 strength, side selection, and tournament clocks.
          </p>
          <div className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#B9D7B9]">
            Open AI Setup
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setSelectedPanel('local')}
          className={`text-left rounded-[20px] p-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9] ${
            selectedPanel === 'local'
              ? 'glass-tile-active'
              : 'glass-surface hover:border-white/25'
          }`}
        >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#E9E5D9]">
                <Users className="h-5 w-5" />
              </div>
              <span className={`inline-flex items-center gap-1 font-mono text-xs ${isAuthenticated ? 'text-[#B9D7B9]' : 'text-[#E9C46A]'}`}>
                {!isAuthenticated && !authLoading && <Lock className="h-3 w-3" />}
                {selectedPanel === 'local'
                  ? isAuthenticated
                    ? 'Selected'
                    : 'Sign In Required'
                  : isAuthenticated
                    ? 'Pass & Play'
                    : 'Account Only'}
              </span>
            </div>
            <h2 className="mt-4 font-display text-xl font-medium text-[#F4F6F0]">
              Local Multiplayer
            </h2>
            <p className="mt-1.5 text-sm text-[#A5B3A8]">
              Two players on one screen with dual clocks and optional board auto-flip.
            </p>
            <div className="mt-5 font-mono text-xs font-semibold text-[#E9E5D9]">
              {isAuthenticated ? 'Configure below ↓' : 'Sign in to unlock ↓'}
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSelectedPanel('online')}
            className={`text-left rounded-[20px] p-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9] ${
              selectedPanel === 'online'
                ? 'glass-tile-active'
                : 'glass-surface hover:border-white/25'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#B9D7B9]">
                <Globe className="h-5 w-5" />
              </div>
              <span className={`inline-flex items-center gap-1 font-mono text-xs ${isAuthenticated ? 'text-[#B9D7B9]' : 'text-[#E9C46A]'}`}>
                {!isAuthenticated && !authLoading && <Lock className="h-3 w-3" />}
                {selectedPanel === 'online'
                  ? isAuthenticated
                    ? 'Selected'
                    : 'Sign In Required'
                  : isAuthenticated
                    ? 'Live Rooms'
                    : 'Account Only'}
              </span>
            </div>
            <h2 className="mt-4 font-display text-xl font-medium text-[#F4F6F0]">
              Online Multiplayer
            </h2>
            <p className="mt-1.5 text-sm text-[#A5B3A8]">
              Server-validated WebSocket rooms for two players on separate devices.
            </p>
            <div className="mt-5 font-mono text-xs font-semibold text-[#B9D7B9]">
              {isAuthenticated ? 'Create or Join below ↓' : 'Sign in to unlock ↓'}
            </div>
          </motion.button>
        </div>

      {/* Configuration Panel for Local or Online */}
      {authLoading ? (
        <section className="rounded-[22px] glass-surface-elevated p-8 animate-pulse space-y-4">
          <div className="h-6 w-52 rounded bg-white/10" />
          <div className="h-24 rounded-xl glass-tile" />
        </section>
      ) : !isAuthenticated ? (
        <motion.section
          key={`locked-${selectedPanel}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          aria-label="Sign In Required for Multiplayer"
          className="rounded-[22px] glass-surface-elevated p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.09] pb-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-tile text-[#E9C46A] shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-medium text-[#F4F6F0]">
                  {selectedPanel === 'online'
                    ? 'Account Required for Online Multiplayer'
                    : 'Account Required for Local Multiplayer'}
                </h2>
                <p className="mt-1 text-sm text-[#A5B3A8] leading-relaxed">
                  Guest mode can only play against the Stockfish 19 Bot. Sign in or create a free
                  account to unlock {selectedPanel === 'online' ? 'live Online Rooms' : 'Local Pass & Play'} and sync your match history.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenAuth('login', getModeGateMessage(selectedPanel))}
              className="inline-flex items-center gap-2 rounded-xl btn-glass-primary px-5 py-2.5 font-mono text-xs font-semibold"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register', getModeGateMessage(selectedPanel))}
              className="inline-flex items-center gap-2 rounded-xl btn-glass-secondary px-5 py-2.5 font-mono text-xs font-medium"
            >
              <UserPlus className="h-4 w-4 text-[#B9D7B9]" />
              Create Free Account
            </button>
            <button
              type="button"
              onClick={onSelectAI}
              className="inline-flex items-center gap-2 rounded-xl glass-tile px-4 py-2.5 font-mono text-xs text-[#B9D7B9] hover:border-[#B9D7B9]/40 transition-colors"
            >
              <Cpu className="h-4 w-4" />
              Play vs Stockfish Bot as Guest
            </button>
          </div>
        </motion.section>
      ) : selectedPanel === 'local' ? (
        <motion.section
          key="local-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          aria-label="Local Multiplayer Setup"
          className="rounded-[22px] glass-surface-elevated p-6 sm:p-8 space-y-6"
        >
          <div className="border-b border-white/[0.09] pb-4">
            <h2 className="font-display text-xl font-medium text-[#F4F6F0]">
              Local Match Configuration
            </h2>
            <p className="mt-1 text-sm text-[#A5B3A8]">
              Set player labels and time control for over-the-board play on this device.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="local-white-name"
                className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
              >
                White Pieces Player
              </label>
              <input
                id="local-white-name"
                type="text"
                value={whiteName}
                onChange={(e) => setWhiteName(e.target.value)}
                maxLength={24}
                placeholder="White Player"
                className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/65"
              />
            </div>

            <div>
              <label
                htmlFor="local-black-name"
                className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
              >
                Black Pieces Player
              </label>
              <input
                id="local-black-name"
                type="text"
                value={blackName}
                onChange={(e) => setBlackName(e.target.value)}
                maxLength={24}
                placeholder="Black Player"
                className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/65"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[#A5B3A8] mb-2">Time Control</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {TIME_CONTROLS.map((tc) => {
                const active = localTimeId === tc.id;
                return (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setLocalTimeId(tc.id)}
                    className={`rounded-xl px-3 py-2.5 text-left transition-all ${
                      active
                        ? 'glass-tile-active text-[#F4F6F0]'
                        : 'glass-tile text-[#A5B3A8] hover:border-white/25 hover:text-[#F4F6F0]'
                    }`}
                  >
                    <div className="font-mono text-sm font-medium">{tc.label}</div>
                    <div className="text-[11px] opacity-80">{tc.category}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/[0.09] pt-5">
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-[#F4F6F0]">
              <input
                type="checkbox"
                checked={autoFlip}
                onChange={(e) => setAutoFlip(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/40 accent-[#B9D7B9]"
              />
              <span>Auto-flip board after each move</span>
            </label>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() =>
                onStartLocal({
                  whiteName: whiteName.trim() || 'White Player',
                  blackName: blackName.trim() || 'Black Player',
                  timeControl: localTc,
                  autoFlip,
                })
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl btn-glass-primary px-6 py-3 font-mono text-sm font-semibold"
            >
              Start Local Match
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.section>
      ) : (
        <motion.section
          key="online-panel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          aria-label="Online Multiplayer Rooms"
          className="rounded-[22px] glass-surface-elevated p-6 sm:p-8 space-y-6"
        >
          <div className="border-b border-white/[0.09] pb-4">
            <h2 className="font-display text-xl font-medium text-[#F4F6F0]">
              Online Match Rooms
            </h2>
            <p className="mt-1 text-sm text-[#A5B3A8]">
              Create a room and share the 6-character code, or enter an existing room code.
            </p>
          </div>

          {onlineError && (
            <div
              role="alert"
              className="rounded-xl border border-[#E07070]/60 bg-[#E07070]/12 backdrop-blur-md px-4 py-3 text-sm text-[#F4F6F0]"
            >
              {onlineError}
            </div>
          )}

          <div>
            <label
              htmlFor="online-player-name"
              className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
            >
              Your Display Name
            </label>
            <input
              id="online-player-name"
              type="text"
              value={onlineName}
              onChange={(e) => setOnlineName(e.target.value)}
              maxLength={24}
              placeholder="Enter your name"
              className="w-full max-w-sm rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/65"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Room */}
            <div className="rounded-[16px] glass-tile p-5 space-y-4">
              <h3 className="font-display text-base font-medium text-[#F4F6F0]">
                Create Private Room
              </h3>

              <div>
                <span className="block text-xs text-[#A5B3A8] mb-2">Play As</span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'w', label: 'White' },
                      { id: 'random', label: 'Random' },
                      { id: 'b', label: 'Black' },
                    ] as const
                  ).map((side) => (
                    <button
                      key={side.id}
                      type="button"
                      onClick={() => setOnlineColorPref(side.id)}
                      className={`rounded-xl py-2 font-mono text-xs transition-all ${
                        onlineColorPref === side.id
                          ? 'glass-tile-active text-[#DDF0DD]'
                          : 'glass-tile text-[#A5B3A8] hover:text-[#F4F6F0]'
                      }`}
                    >
                      {side.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs text-[#A5B3A8] mb-2">Time Control</span>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_CONTROLS.map((tc) => (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setOnlineTimeId(tc.id)}
                      className={`rounded-xl px-2 py-2 font-mono text-xs transition-all ${
                        onlineTimeId === tc.id
                          ? 'glass-tile-active text-[#DDF0DD]'
                          : 'glass-tile text-[#A5B3A8] hover:text-[#F4F6F0]'
                      }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={onlineConnecting}
                onClick={() =>
                  void onCreateOnlineRoom({
                    playerName: onlineName.trim() || 'Player 1',
                    colorPref: onlineColorPref,
                    timeControl: onlineTc,
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-glass-primary py-2.5 font-mono text-sm font-semibold disabled:opacity-50"
              >
                {onlineConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {onlineConnecting ? 'Connecting…' : 'Create Room'}
              </motion.button>
            </div>

            {/* Join Room */}
            <div className="rounded-[16px] glass-tile p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <h3 className="font-display text-base font-medium text-[#F4F6F0]">
                  Join Existing Room
                </h3>
                <p className="text-xs text-[#A5B3A8] leading-relaxed">
                  Paste the 6-character code shared by your opponent to join their live chessboard.
                </p>
                <div>
                  <label
                    htmlFor="join-room-code"
                    className="block text-xs text-[#A5B3A8] mb-1.5"
                  >
                    Room Code
                  </label>
                  <input
                    id="join-room-code"
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="e.g. K7M4QX"
                    className="w-full rounded-xl glass-input px-3.5 py-2.5 font-mono text-base tracking-widest uppercase placeholder:text-[#A5B3A8]/55"
                  />
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={onlineConnecting || joinCode.trim().length < 4}
                onClick={() =>
                  void onJoinOnlineRoom({
                    roomCode: joinCode.trim(),
                    playerName: onlineName.trim() || 'Player 2',
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-glass-secondary py-2.5 font-mono text-sm font-semibold disabled:opacity-45"
              >
                {onlineConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {onlineConnecting ? 'Joining…' : 'Join Room'}
              </motion.button>
            </div>
          </div>
        </motion.section>
      )}
    </main>
  );
};
