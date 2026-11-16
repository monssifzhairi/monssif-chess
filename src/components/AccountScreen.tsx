import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  Sliders,
  User,
  UserPlus,
} from 'lucide-react';
import { TIME_CONTROLS } from '../chess/rules';
import { authService } from '../services/authService';
import type {
  ColorPreference,
  PlayerStats,
  PlayerUser,
  UserSettings,
} from '../types/chess';
import { PWAInstallButton } from './PWAInstallButton';

interface AccountScreenProps {
  user: PlayerUser | null;
  stats: PlayerStats;
  guestSettings: UserSettings;
  onBack: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onUserUpdated: (user: PlayerUser) => void;
  onGuestSettingsUpdated: (settings: UserSettings) => void;
  onLogout: () => Promise<void>;
}

const TITLE_OPTIONS = [
  'Club Player',
  'Tactician',
  'Endgame Student',
  'Blitz Specialist',
  'Correspondence',
];

export const AccountScreen: React.FC<AccountScreenProps> = ({
  user,
  stats,
  guestSettings,
  onBack,
  onOpenAuth,
  onUserUpdated,
  onGuestSettingsUpdated,
  onLogout,
}) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [preferredSide, setPreferredSide] = useState<ColorPreference>(
    user?.preferredSide || 'random'
  );
  const [titleBadge, setTitleBadge] = useState(user?.titleBadge || 'Club Player');

  const activeSettings = user ? user.settings : guestSettings;
  const [defaultTimeId, setDefaultTimeId] = useState(activeSettings.defaultTimeId);
  const [soundEnabled, setSoundEnabled] = useState(activeSettings.soundEnabled);
  const [autoFlipLocal, setAutoFlipLocal] = useState(activeSettings.autoFlipLocal);
  const [showCoordinates, setShowCoordinates] = useState(activeSettings.showCoordinates);
  const [animatePieces, setAnimatePieces] = useState(activeSettings.animatePieces);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio);
      setPreferredSide(user.preferredSide);
      setTitleBadge(user.titleBadge);
      setDefaultTimeId(user.settings.defaultTimeId);
      setSoundEnabled(user.settings.soundEnabled);
      setAutoFlipLocal(user.settings.autoFlipLocal);
      setShowCoordinates(user.settings.showCoordinates);
      setAnimatePieces(user.settings.animatePieces);
    } else {
      setDefaultTimeId(guestSettings.defaultTimeId);
      setSoundEnabled(guestSettings.soundEnabled);
      setAutoFlipLocal(guestSettings.autoFlipLocal);
      setShowCoordinates(guestSettings.showCoordinates);
      setAnimatePieces(guestSettings.animatePieces);
    }
  }, [guestSettings, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileNotice(null);
    if (displayName.trim().length < 2) {
      setProfileNotice({ type: 'err', text: 'Display name must be at least 2 characters.' });
      return;
    }

    setProfileSaving(true);
    try {
      const res = await authService.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        preferredSide,
        titleBadge,
      });
      onUserUpdated(res.user);
      setProfileNotice({ type: 'ok', text: 'Profile saved to your account.' });
    } catch (err) {
      setProfileNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsNotice(null);

    const nextSettings: UserSettings = {
      defaultTimeId,
      soundEnabled,
      autoFlipLocal,
      showCoordinates,
      animatePieces,
    };

    if (!user) {
      onGuestSettingsUpdated(nextSettings);
      setSettingsNotice({ type: 'ok', text: 'Preferences saved locally in this browser.' });
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setSettingsNotice({ type: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }

    setSettingsSaving(true);
    try {
      const res = await authService.updateSettings({
        ...nextSettings,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      onUserUpdated(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setSettingsNotice({
        type: 'ok',
        text: newPassword ? 'Settings and password updated.' : 'Account settings updated.',
      });
    } catch (err) {
      setSettingsNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update settings.',
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <main className="relative z-10 mx-auto max-w-[1160px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
            {user ? 'Player Profile & Settings' : 'Guest Preferences & Account'}
          </h1>
          <p className="mt-1 text-sm text-[#A5B3A8]">
            {user
              ? `Signed in as @${user.username} · Account data synced with server`
              : 'Customize board preferences locally or sign in to sync your profile and match history.'}
          </p>
        </div>

        {user ? (
          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E07070]/50 bg-[#E07070]/10 backdrop-blur-md px-4 py-2 font-mono text-xs font-medium text-[#E07070] hover:bg-[#E07070]/20 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex items-center gap-2 rounded-xl btn-glass-secondary px-4 py-2 font-mono text-xs font-medium"
            >
              <LogIn className="h-3.5 w-3.5 text-[#B9D7B9]" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="inline-flex items-center gap-2 rounded-xl btn-glass-primary px-4 py-2 font-mono text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Create Account
            </button>
          </div>
        )}
      </div>

      {/* Real Recorded Statistics Strip */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
        aria-label="Recorded player statistics"
      >
        <div className="rounded-[16px] glass-surface p-4">
          <div className="font-mono text-[11px] text-[#A5B3A8]">TOTAL GAMES</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[#F4F6F0] tabular-nums">
            {stats.totalGames}
          </div>
        </div>
        <div className="rounded-[16px] glass-surface p-4">
          <div className="font-mono text-[11px] text-[#A5B3A8]">WINS</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[#B9D7B9] tabular-nums">
            {stats.wins}
          </div>
        </div>
        <div className="rounded-[16px] glass-surface p-4">
          <div className="font-mono text-[11px] text-[#A5B3A8]">DRAWS</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[#E9E5D9] tabular-nums">
            {stats.draws}
          </div>
        </div>
        <div className="rounded-[16px] glass-surface p-4">
          <div className="font-mono text-[11px] text-[#A5B3A8]">LOSSES</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[#E07070] tabular-nums">
            {stats.losses}
          </div>
        </div>
        <div className="rounded-[16px] glass-surface p-4">
          <div className="font-mono text-[11px] text-[#A5B3A8]">WIN RATE</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[#F4F6F0] tabular-nums">
            {stats.winRatePct}%
          </div>
        </div>
        <div className="rounded-[16px] glass-surface p-4">
          <div className="font-mono text-[11px] text-[#A5B3A8]">AVG MOVES</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-[#F4F6F0] tabular-nums">
            {stats.avgMoves}
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Profile Column */}
        <section className="lg:col-span-6 rounded-[22px] glass-surface-elevated p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.09] pb-4">
            <div className="flex items-center gap-2.5">
              <User className="h-4 w-4 text-[#B9D7B9]" />
              <h2 className="font-display text-lg font-medium text-[#F4F6F0]">Player Identity</h2>
            </div>
            {user && (
              <span className="font-mono text-xs text-[#B9D7B9]">{user.titleBadge}</span>
            )}
          </div>

          {!user ? (
            <div className="py-6 space-y-4">
              <p className="text-sm text-[#A5B3A8] leading-relaxed">
                You are currently playing as a guest. Create an account or sign in to persist your
                chess handle, player bio, statistics, and cross-session match history.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="rounded-xl btn-glass-primary px-5 py-2.5 font-mono text-xs font-semibold"
                >
                  Create Free Account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="rounded-xl btn-glass-secondary px-5 py-2.5 font-mono text-xs font-medium"
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
              {profileNotice && (
                <div
                  role={profileNotice.type === 'err' ? 'alert' : 'status'}
                  className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                    profileNotice.type === 'err'
                      ? 'border-[#E07070]/60 bg-[#E07070]/12 text-[#F4F6F0]'
                      : 'border-[#B9D7B9]/40 bg-[#203B2D]/60 text-[#DDF0DD]'
                  }`}
                >
                  {profileNotice.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="profile-display-name"
                    className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                  >
                    Display Name
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={32}
                    className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-title"
                    className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                  >
                    Player Label
                  </label>
                  <div className="relative">
                    <select
                      id="profile-title"
                      value={titleBadge}
                      onChange={(e) => setTitleBadge(e.target.value)}
                      className="w-full appearance-none rounded-xl glass-input pl-3.5 pr-9 py-2.5 text-sm"
                    >
                      {TITLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A5B3A8]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#A5B3A8] mb-1.5">
                  Preferred Opening Side
                </span>
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
                      onClick={() => setPreferredSide(side.id)}
                      className={`rounded-xl py-2 font-mono text-xs transition-all ${
                        preferredSide === side.id
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
                <label
                  htmlFor="profile-bio"
                  className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                >
                  Chess Bio / Opening Repertoire
                </label>
                <textarea
                  id="profile-bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={180}
                  placeholder="Share your favorite openings or club focus…"
                  className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/60"
                />
              </div>

              <div className="flex items-center justify-between pt-2 text-xs text-[#A5B3A8]">
                <span className="font-mono">{user.email}</span>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 rounded-xl btn-glass-primary px-5 py-2.5 font-mono text-xs font-semibold disabled:opacity-55"
                >
                  {profileSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Save Profile
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Settings & Security Column */}
        <section className="lg:col-span-6 rounded-[22px] glass-surface-elevated p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-white/[0.09] pb-4">
            <Sliders className="h-4 w-4 text-[#B9D7B9]" />
            <h2 className="font-display text-lg font-medium text-[#F4F6F0]">
              Board & Account Settings
            </h2>
          </div>

          <form onSubmit={(e) => void handleSaveSettings(e)} className="space-y-4">
            {settingsNotice && (
              <div
                role={settingsNotice.type === 'err' ? 'alert' : 'status'}
                className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                  settingsNotice.type === 'err'
                    ? 'border-[#E07070]/60 bg-[#E07070]/12 text-[#F4F6F0]'
                    : 'border-[#B9D7B9]/40 bg-[#203B2D]/60 text-[#DDF0DD]'
                }`}
              >
                {settingsNotice.text}
              </div>
            )}

            <div>
              <label
                htmlFor="settings-time"
                className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
              >
                Default Time Control
              </label>
              <div className="relative">
                <select
                  id="settings-time"
                  value={defaultTimeId}
                  onChange={(e) => setDefaultTimeId(e.target.value)}
                  className="w-full appearance-none rounded-xl glass-input pl-3.5 pr-9 py-2.5 text-sm"
                >
                  {TIME_CONTROLS.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.label} · {tc.category}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A5B3A8]"
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-center justify-between gap-3 rounded-xl glass-tile px-3.5 py-2.5 cursor-pointer hover:border-white/20 transition-colors">
                <span className="text-sm text-[#F4F6F0]">Board Sound Effects</span>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#B9D7B9]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl glass-tile px-3.5 py-2.5 cursor-pointer hover:border-white/20 transition-colors">
                <span className="text-sm text-[#F4F6F0]">Show Rank & File Coordinates</span>
                <input
                  type="checkbox"
                  checked={showCoordinates}
                  onChange={(e) => setShowCoordinates(e.target.checked)}
                  className="h-4 w-4 accent-[#B9D7B9]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl glass-tile px-3.5 py-2.5 cursor-pointer hover:border-white/20 transition-colors">
                <span className="text-sm text-[#F4F6F0]">Smooth Piece & Capture Animations</span>
                <input
                  type="checkbox"
                  checked={animatePieces}
                  onChange={(e) => setAnimatePieces(e.target.checked)}
                  className="h-4 w-4 accent-[#B9D7B9]"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl glass-tile px-3.5 py-2.5 cursor-pointer hover:border-white/20 transition-colors">
                <span className="text-sm text-[#F4F6F0]">Auto-Flip Local Pass & Play Board</span>
                <input
                  type="checkbox"
                  checked={autoFlipLocal}
                  onChange={(e) => setAutoFlipLocal(e.target.checked)}
                  className="h-4 w-4 accent-[#B9D7B9]"
                />
              </label>
            </div>

            {user && (
              <div className="border-t border-white/[0.09] pt-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[#E9E5D9]">
                  <ShieldCheck className="h-4 w-4 text-[#B9D7B9]" />
                  <span>Change Password (Optional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                    className="w-full rounded-xl glass-input px-3.5 py-2 text-sm placeholder:text-[#A5B3A8]/65"
                  />
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (8+ chars)"
                      autoComplete="new-password"
                      className="w-full rounded-xl glass-input pl-3.5 pr-10 py-2 text-sm placeholder:text-[#A5B3A8]/65"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A5B3A8] hover:text-[#F4F6F0]"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={settingsSaving}
                className="inline-flex items-center gap-2 rounded-xl btn-glass-primary px-5 py-2.5 font-mono text-xs font-semibold disabled:opacity-55"
              >
                {settingsSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Settings
              </button>
            </div>
          </form>
        </section>
      </div>

      <PWAInstallButton variant="card" />
    </main>
  );
};
