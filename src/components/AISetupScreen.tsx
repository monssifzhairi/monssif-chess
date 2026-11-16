import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Cpu } from 'lucide-react';
import { DIFFICULTY_PROFILES, TIME_CONTROLS } from '../chess/rules';
import type { AIDifficulty, ColorPreference, TimeControl } from '../types/chess';
import { ChessPieceIcon } from './ChessPieceIcon';

interface AISetupScreenProps {
  defaultColorPref?: ColorPreference;
  defaultTimeId?: string;
  onBack: () => void;
  onStartMatch: (opts: {
    difficulty: AIDifficulty;
    colorPref: ColorPreference;
    timeControl: TimeControl;
  }) => void;
}

const DIFFICULTIES: AIDifficulty[] = ['easy', 'medium', 'hard', 'expert'];

export const AISetupScreen: React.FC<AISetupScreenProps> = ({
  defaultColorPref,
  defaultTimeId,
  onBack,
  onStartMatch,
}) => {
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [colorPref, setColorPref] = useState<ColorPreference>(defaultColorPref || 'w');
  const [timeId, setTimeId] = useState(defaultTimeId || 'rapid-10-0');

  useEffect(() => {
    if (defaultColorPref) setColorPref(defaultColorPref);
  }, [defaultColorPref]);

  useEffect(() => {
    if (defaultTimeId) setTimeId(defaultTimeId);
  }, [defaultTimeId]);

  const selectedTimeControl = TIME_CONTROLS.find((t) => t.id === timeId) || TIME_CONTROLS[3];
  const selectedProfile = DIFFICULTY_PROFILES[difficulty];

  return (
    <main className="relative z-10 mx-auto max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[#A5B3A8] hover:text-[#F4F6F0] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Modes
        </button>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-tile text-[#B9D7B9]">
            <Cpu className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4F6F0]">
            AI Match Setup
          </h1>
        </div>
        <p className="mt-1.5 text-sm text-[#A5B3A8]">
          Powered by Stockfish 19 WASM running locally in a dedicated Web Worker.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-[24px] glass-surface-elevated p-6 sm:p-8 space-y-8"
      >
        {/* Difficulty Selector */}
        <section aria-labelledby="difficulty-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="difficulty-heading" className="font-display text-lg font-medium text-[#F4F6F0]">
              Engine Strength
            </h2>
            <span className="font-mono text-xs text-[#B9D7B9]">
              {selectedProfile.label} · {selectedProfile.eloLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DIFFICULTIES.map((diffKey) => {
              const profile = DIFFICULTY_PROFILES[diffKey];
              const active = difficulty === diffKey;
              return (
                <motion.button
                  key={diffKey}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDifficulty(diffKey)}
                  aria-pressed={active}
                  className={`text-left rounded-[16px] p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9] ${
                    active
                      ? 'glass-tile-active'
                      : 'glass-tile hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-semibold text-[#F4F6F0]">
                      {profile.label}
                    </span>
                    <span className="font-mono text-[11px] text-[#B9D7B9]">
                      {profile.eloLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#A5B3A8]">
                    {profile.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Side Selector */}
        <section aria-labelledby="side-heading" className="space-y-3">
          <h2 id="side-heading" className="font-display text-lg font-medium text-[#F4F6F0]">
            Play As
          </h2>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {(
              [
                { id: 'w', label: 'White', sub: 'First move' },
                { id: 'random', label: 'Random', sub: '50 / 50 draw' },
                { id: 'b', label: 'Black', sub: 'Counterplay' },
              ] as const
            ).map((side) => {
              const active = colorPref === side.id;
              return (
                <motion.button
                  key={side.id}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setColorPref(side.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-[16px] p-3.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9] ${
                    active
                      ? 'glass-tile-active'
                      : 'glass-tile hover:border-white/25'
                  }`}
                >
                  {side.id === 'random' ? (
                    <div className="flex items-center -space-x-2">
                      <ChessPieceIcon type="k" color="w" className="w-7 h-7" />
                      <ChessPieceIcon type="k" color="b" className="w-7 h-7" />
                    </div>
                  ) : (
                    <ChessPieceIcon type="k" color={side.id} className="w-8 h-8" />
                  )}
                  <span className="font-display text-sm font-medium text-[#F4F6F0]">
                    {side.label}
                  </span>
                  <span className="font-mono text-[11px] text-[#A5B3A8]">{side.sub}</span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Time Control Selector */}
        <section aria-labelledby="clock-heading" className="space-y-3">
          <h2 id="clock-heading" className="font-display text-lg font-medium text-[#F4F6F0]">
            Time Control
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {TIME_CONTROLS.map((tc) => {
              const active = timeId === tc.id;
              return (
                <button
                  key={tc.id}
                  type="button"
                  onClick={() => setTimeId(tc.id)}
                  aria-pressed={active}
                  className={`rounded-xl px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9] ${
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
        </section>

        {/* Start Action Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/[0.09] pt-6">
          <div className="font-mono text-xs text-[#A5B3A8]">
            Stockfish {selectedProfile.label} ({selectedProfile.eloLabel}) ·{' '}
            {colorPref === 'w' ? 'White' : colorPref === 'b' ? 'Black' : 'Random Side'} ·{' '}
            {selectedTimeControl.label}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            data-start="true"
            onClick={() =>
              onStartMatch({
                difficulty,
                colorPref,
                timeControl: selectedTimeControl,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl btn-glass-primary px-6 py-3 font-mono text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9E5D9]"
          >
            Start Match
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>
    </main>
  );
};
