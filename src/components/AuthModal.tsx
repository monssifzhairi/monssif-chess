import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff, Loader2, LogIn, UserPlus, X } from 'lucide-react';
import { authService, type AuthSessionResponse } from '../services/authService';
import { MonssifLogo } from './MonssifLogo';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  contextMessage?: string | null;
  onClose: () => void;
  onSuccess: (session: AuthSessionResponse) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'login',
  contextMessage = null,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setLoading(false);
    }
  }, [initialMode, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'login') {
      if (!identifier.trim() || !password) {
        setError('Please enter your email or username and password.');
        return;
      }
      setLoading(true);
      try {
        const session = await authService.login({
          identifier: identifier.trim(),
          password,
        });
        onSuccess(session);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setError('Username must be 3–20 characters (letters, numbers, or underscores).');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const session = await authService.register({
        email: cleanEmail,
        username: cleanUsername,
        displayName: displayName.trim() || cleanUsername,
        password,
      });
      onSuccess(session);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040806]/70 backdrop-blur-xl p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-[24px] glass-surface-elevated p-6 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.09] pb-4">
              <div className="space-y-1.5">
                <MonssifLogo size={32} showWordmark showTagline={false} />
                <h2
                  id="auth-modal-title"
                  className="font-display text-xl font-semibold text-[#F4F6F0]"
                >
                  {mode === 'login' ? 'Sign In to MONSSIF CHESS' : 'Create Player Account'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close authentication dialog"
                className="flex h-9 w-9 items-center justify-center rounded-xl btn-glass-secondary text-[#A5B3A8] hover:text-[#F4F6F0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl glass-tile p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`rounded-lg py-2 font-mono text-xs font-medium transition-all ${
                  mode === 'login'
                    ? 'glass-tile-active text-[#DDF0DD]'
                    : 'text-[#A5B3A8] hover:text-[#F4F6F0]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`rounded-lg py-2 font-mono text-xs font-medium transition-all ${
                  mode === 'register'
                    ? 'glass-tile-active text-[#DDF0DD]'
                    : 'text-[#A5B3A8] hover:text-[#F4F6F0]'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4" noValidate>
              {contextMessage && !error && (
                <div className="rounded-xl border border-[#B9D7B9]/30 bg-[#203B2D]/45 px-3.5 py-2.5 text-xs text-[#DDF0DD]">
                  {contextMessage}
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#E07070]/60 bg-[#E07070]/12 px-3.5 py-2.5 text-xs text-[#F4F6F0]"
                >
                  {error}
                </div>
              )}

              {mode === 'login' ? (
                <div>
                  <label
                    htmlFor="auth-identifier"
                    className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                  >
                    Email or Username
                  </label>
                  <input
                    id="auth-identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="player@example.com or handle"
                    className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/60"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="player@example.com"
                      className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/60"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="auth-username"
                        className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                      >
                        Username
                      </label>
                      <input
                        id="auth-username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="monssif_gm"
                        maxLength={20}
                        className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/60"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="auth-display-name"
                        className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                      >
                        Display Name
                      </label>
                      <input
                        id="auth-display-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Optional"
                        maxLength={32}
                        className="w-full rounded-xl glass-input px-3.5 py-2.5 text-sm placeholder:text-[#A5B3A8]/60"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'}
                    maxLength={128}
                    className="w-full rounded-xl glass-input pl-3.5 pr-11 py-2.5 text-sm placeholder:text-[#A5B3A8]/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-[#A5B3A8] hover:text-[#F4F6F0]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'register' && password.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5" aria-hidden="true">
                    {[1, 2, 3].map((tier) => {
                      const score =
                        (password.length >= 8 ? 1 : 0) +
                        (/[A-Z]/.test(password) && /[0-9]/.test(password) ? 1 : 0) +
                        (password.length >= 12 || /[^A-Za-z0-9]/.test(password) ? 1 : 0);
                      const filled = tier <= Math.max(1, score);
                      const barColor =
                        score <= 1 ? 'bg-[#E07070]' : score === 2 ? 'bg-[#E9C46A]' : 'bg-[#B9D7B9]';
                      return (
                        <span
                          key={tier}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            filled ? barColor : 'bg-white/10'
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-medium text-[#A5B3A8] mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl glass-input pl-3.5 pr-11 py-2.5 text-sm placeholder:text-[#A5B3A8]/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-[#A5B3A8] hover:text-[#F4F6F0]"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl btn-glass-primary py-2.5 font-mono text-sm font-semibold disabled:opacity-55"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === 'login' ? 'Signing In…' : 'Creating Account…'}
                  </>
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Account
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
