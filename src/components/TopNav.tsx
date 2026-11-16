import React from 'react';
import { motion } from 'motion/react';
import { LogIn, User, Volume2, VolumeX } from 'lucide-react';
import type { PlayerUser, ScreenId } from '../types/chess';
import { MonssifLogo } from './MonssifLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface TopNavProps {
  currentScreen: ScreenId;
  hasActiveMatch: boolean;
  muted: boolean;
  user: PlayerUser | null;
  authLoading?: boolean;
  onToggleMute: () => void;
  onNavigate: (screen: ScreenId) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentScreen,
  hasActiveMatch,
  muted,
  user,
  authLoading = false,
  onToggleMute,
  onNavigate,
  onOpenAuth,
}) => {
  const navItems: { id: ScreenId; label: string; show?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'modes', label: 'Game Modes' },
    { id: 'ai-setup', label: 'AI Setup' },
    { id: 'game', label: 'Active Board', show: hasActiveMatch || currentScreen === 'game' },
    { id: 'account', label: user ? 'Profile' : 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.09] bg-[#080f0b]/62 backdrop-blur-2xl shadow-[0_10px_36px_rgba(0,0,0,0.35)]">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]/70 rounded-xl shrink-0"
          aria-label="MONSSIF CHESS Dashboard"
        >
          <MonssifLogo size={34} showWordmark showTagline={false} />
        </button>

        <nav
          className="hidden lg:flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-md"
          aria-label="Primary"
        >
          {navItems
            .filter((item) => item.show !== false)
            .map((item) => {
              const active = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative px-3.5 py-1.5 text-sm font-medium whitespace-nowrap shrink-0 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B9D7B9] ${
                    active ? 'text-[#F4F6F0]' : 'text-[#A5B3A8] hover:text-[#F4F6F0]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="topnav-active-indicator"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-white/[0.1] border border-white/[0.15] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl btn-glass-secondary text-[#A5B3A8] hover:text-[#F4F6F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]/70"
            aria-label={muted ? 'Unmute game audio' : 'Mute game audio'}
            title={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {authLoading ? (
            <div
              aria-hidden="true"
              className="h-9 sm:h-10 w-24 rounded-xl glass-tile animate-pulse"
            />
          ) : user ? (
            <button
              type="button"
              onClick={() => onNavigate('account')}
              className={`inline-flex h-9 sm:h-10 items-center gap-2 rounded-xl px-3.5 font-mono text-xs transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9] ${
                currentScreen === 'account'
                  ? 'glass-tile-active text-[#DDF0DD]'
                  : 'btn-glass-secondary text-[#F4F6F0]'
              }`}
              title={`Account: ${user.displayName}`}
            >
              <User className="h-3.5 w-3.5 text-[#B9D7B9]" />
              <span className="max-w-[100px] sm:max-w-[140px] truncate">{user.displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-xl btn-glass-secondary px-3.5 font-mono text-xs font-medium whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
            >
              <LogIn className="h-3.5 w-3.5 text-[#B9D7B9]" />
              <span>Sign In</span>
            </button>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('modes')}
            className="hidden sm:inline-flex h-9 sm:h-10 items-center rounded-xl btn-glass-primary px-4 font-mono text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9E5D9]"
          >
            New Match
          </motion.button>
        </div>
      </div>

      {/* Tablet & Mobile compact secondary nav */}
      <nav
        className="flex lg:hidden items-center gap-2 overflow-x-auto border-t border-white/[0.07] px-4 py-2"
        aria-label="Mobile navigation"
      >
        {navItems
          .filter((item) => item.show !== false)
          .map((item) => {
            const active = currentScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-xs font-medium whitespace-nowrap shrink-0 px-3 py-1 rounded-lg transition-colors ${
                  active
                    ? 'bg-white/[0.11] text-[#DDF0DD] border border-white/[0.14]'
                    : 'text-[#A5B3A8] hover:text-[#F4F6F0]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
      </nav>
    </header>
  );
};
