import { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { chessAudio } from './audio/chessAudio';
import { canAccessGameMode, getModeGateMessage } from './chess/accessControl';
import { resolvePlayerColor, TIME_CONTROLS } from './chess/rules';
import { AccountScreen } from './components/AccountScreen';
import { AISetupScreen } from './components/AISetupScreen';
import { AuthModal } from './components/AuthModal';
import { DashboardScreen } from './components/DashboardScreen';
import { GameResultScreen } from './components/GameResultScreen';
import { GameScreen } from './components/GameScreen';
import { ModeSelectionScreen } from './components/ModeSelectionScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { TopNav } from './components/TopNav';
import { onlineService } from './online/onlineService';
import { authService, type AuthSessionResponse } from './services/authService';
import { clearMatchHistory, loadMatchHistory, saveMatchResult } from './storage/matchHistory';
import type {
  AIDifficulty,
  ColorPreference,
  CompletedMatchSnapshot,
  GameAnalysisReport,
  GameMode,
  GameResult,
  MatchConfig,
  OnlineRoomSnapshot,
  PieceColor,
  PlayerStats,
  PlayerUser,
  SavedMatchRecord,
  ScreenId,
  TimeControl,
  UserSettings,
} from './types/chess';

const GUEST_SETTINGS_KEY = 'monssif_chess_guest_settings_v1';

const DEFAULT_SETTINGS: UserSettings = {
  defaultTimeId: 'rapid-10-0',
  soundEnabled: true,
  autoFlipLocal: false,
  showCoordinates: true,
  animatePieces: true,
};

function loadGuestSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(GUEST_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveGuestSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

function computeLocalStats(matches: SavedMatchRecord[]): PlayerStats {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalMoves = 0;
  const modeCounts: Record<GameMode, number> = { ai: 0, local: 0, online: 0 };

  for (const m of matches) {
    modeCounts[m.mode] = (modeCounts[m.mode] || 0) + 1;
    totalMoves += Math.ceil((m.totalPlies || 0) / 2);
    if (m.winner === 'draw') {
      draws += 1;
    } else if (m.playerColor) {
      if (m.winner === m.playerColor) wins += 1;
      else losses += 1;
    } else if (m.winner === 'w') {
      wins += 1;
    } else {
      losses += 1;
    }
  }

  const totalGames = matches.length;
  const winRatePct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const avgMoves = totalGames > 0 ? Math.round(totalMoves / totalGames) : 0;
  let favoriteMode: GameMode | null = null;
  let bestCount = 0;
  for (const mode of ['ai', 'local', 'online'] as const) {
    if (modeCounts[mode] > bestCount) {
      bestCount = modeCounts[mode];
      favoriteMode = mode;
    }
  }

  return { totalGames, wins, draws, losses, winRatePct, avgMoves, favoriteMode };
}

const DEFAULT_AI_CONFIG: MatchConfig = {
  mode: 'ai',
  playerColor: 'w',
  difficulty: 'medium',
  timeControl: TIME_CONTROLS[3],
  whiteName: 'You',
  blackName: 'Stockfish 19',
};

export default function App() {
  const [screen, setScreen] = useState<ScreenId>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'game';
    }
    return 'dashboard';
  });

  const [matchConfig, setMatchConfig] = useState<MatchConfig | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return DEFAULT_AI_CONFIG;
    }
    return null;
  });

  const [matchKey, setMatchKey] = useState<number>(1);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [completedSnapshot, setCompletedSnapshot] = useState<CompletedMatchSnapshot | null>(null);
  const [analysisReport, setAnalysisReport] = useState<GameAnalysisReport | null>(null);

  // Auth & persistent player state
  const [user, setUser] = useState<PlayerUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [serverStats, setServerStats] = useState<PlayerStats | null>(null);
  const [guestSettings, setGuestSettings] = useState<UserSettings>(() => loadGuestSettings());
  const [matchHistory, setMatchHistory] = useState<SavedMatchRecord[]>(() => loadMatchHistory());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authContextMessage, setAuthContextMessage] = useState<string | null>(null);
  const [modesInitialPanel, setModesInitialPanel] = useState<'local' | 'online'>('local');

  const activeSettings = user ? user.settings : guestSettings;
  const muted = !activeSettings.soundEnabled;

  // Keep audio engine synchronized with active user/guest preference
  useEffect(() => {
    chessAudio.setMuted(!activeSettings.soundEnabled);
  }, [activeSettings.soundEnabled]);

  // Restore signed-in session cookie on initial load, and only recover saved online rooms for authenticated accounts
  useEffect(() => {
    let active = true;
    authService
      .fetchSession()
      .then((session) => {
        if (!active) return;
        if (session.user) {
          setUser(session.user);
          setServerStats(session.stats || null);
          if (session.matches) setMatchHistory(session.matches);

          const params =
            typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          if (params?.get('autostart') !== '1') {
            const saved = onlineService.getSavedRoomSession();
            if (saved && saved.roomCode) {
              setOnlineConnecting(true);
              void onlineService.joinRoom(saved.roomCode, saved.playerName).catch(() => {
                setOnlineConnecting(false);
              });
            }
          }
        } else {
          if (onlineService.getSavedRoomSession()) {
            onlineService.disconnect();
          }
        }
      })
      .catch(() => {
        // Guest fallback cleanly preserved
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const effectiveStats = useMemo(() => {
    if (user && serverStats) return serverStats;
    return computeLocalStats(matchHistory);
  }, [matchHistory, serverStats, user]);

  // Online multiplayer state
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [onlineAssignedColor, setOnlineAssignedColor] = useState<PieceColor | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineConnecting, setOnlineConnecting] = useState<boolean>(false);
  const [onlineReconnecting, setOnlineReconnecting] = useState<boolean>(false);

  useEffect(() => {
    const unsubRoom = onlineService.onRoomUpdate((room, assigned) => {
      setOnlineRoom(room);
      setOnlineAssignedColor(assigned);
      setOnlineConnecting(false);
      setOnlineReconnecting(false);
      setOnlineError(null);
      if (room.status === 'playing' && room.moves.length === 0) {
        setCompletedSnapshot(null);
        setAnalysisReport(null);
      }
      setMatchConfig({
        mode: 'online',
        playerColor: assigned || 'w',
        difficulty: 'medium',
        timeControl: room.timeControl,
        whiteName: room.whiteName,
        blackName: room.blackName,
        roomCode: room.roomCode,
      });
      setScreen((prev) => {
        if (room.status === 'playing' || room.status === 'waiting') {
          return 'game';
        }
        return prev === 'result' ? prev : 'game';
      });
    });

    const unsubErr = onlineService.onError((msg) => {
      setOnlineError(msg);
      setOnlineConnecting(false);
    });

    const unsubConn = onlineService.onConnectionChange((connected, reconnecting) => {
      setOnlineReconnecting(!connected && reconnecting);
    });

    return () => {
      unsubRoom();
      unsubErr();
      unsubConn();
    };
  }, []);

  const handleOpenAuth = useCallback((mode: 'login' | 'register', reason?: string) => {
    setAuthModalMode(mode);
    setAuthContextMessage(reason || null);
    setAuthModalOpen(true);
  }, []);

  const handleAuthSuccess = useCallback((session: AuthSessionResponse) => {
    if (session.user) {
      setUser(session.user);
      setServerStats(session.stats || null);
      if (session.matches) setMatchHistory(session.matches);
      setAuthContextMessage(null);
      setOnlineError(null);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network hiccup on logout
    }
    onlineService.disconnect();
    setOnlineRoom(null);
    setOnlineAssignedColor(null);
    setOnlineReconnecting(false);
    setOnlineError(null);
    setUser(null);
    setServerStats(null);
    setMatchHistory(loadMatchHistory());
    setMatchConfig((prev) => {
      if (prev && prev.mode !== 'ai') {
        setLastResult(null);
        setCompletedSnapshot(null);
        setAnalysisReport(null);
        setScreen('dashboard');
        return null;
      }
      return prev;
    });
  }, []);

  const handleToggleMute = async () => {
    const nextSound = !activeSettings.soundEnabled;
    const nextSettings: UserSettings = { ...activeSettings, soundEnabled: nextSound };
    if (user) {
      setUser({ ...user, settings: nextSettings });
      try {
        const res = await authService.updateSettings({ soundEnabled: nextSound });
        setUser(res.user);
      } catch {
        // Local mute still applied
      }
    } else {
      setGuestSettings(nextSettings);
      saveGuestSettings(nextSettings);
    }
  };

  const handleStartAIMatch = useCallback(
    (opts: { difficulty: AIDifficulty; colorPref: ColorPreference; timeControl: TimeControl }) => {
      onlineService.disconnect();
      setOnlineRoom(null);
      setOnlineAssignedColor(null);
      const humanColor = resolvePlayerColor(opts.colorPref);
      const playerLabel = user?.displayName || 'You';
      setMatchConfig({
        mode: 'ai',
        playerColor: humanColor,
        difficulty: opts.difficulty,
        timeControl: opts.timeControl,
        whiteName: humanColor === 'w' ? playerLabel : 'Stockfish 19',
        blackName: humanColor === 'b' ? playerLabel : 'Stockfish 19',
      });
      setLastResult(null);
      setCompletedSnapshot(null);
      setAnalysisReport(null);
      setMatchKey((k) => k + 1);
      setScreen('game');
    },
    [user?.displayName]
  );

  const handleQuickStartAI = () => {
    const defaultTc =
      TIME_CONTROLS.find((t) => t.id === activeSettings.defaultTimeId) || TIME_CONTROLS[3];
    handleStartAIMatch({
      difficulty: 'medium',
      colorPref: user?.preferredSide || 'w',
      timeControl: defaultTc,
    });
  };

  const handleStartLocalMatch = (opts: {
    whiteName: string;
    blackName: string;
    timeControl: TimeControl;
    autoFlip: boolean;
  }) => {
    if (!canAccessGameMode('local', Boolean(user))) {
      handleOpenAuth('login', getModeGateMessage('local'));
      return;
    }
    onlineService.disconnect();
    setOnlineRoom(null);
    setOnlineAssignedColor(null);
    setMatchConfig({
      mode: 'local',
      playerColor: 'w',
      difficulty: 'medium',
      timeControl: opts.timeControl,
      whiteName: opts.whiteName,
      blackName: opts.blackName,
      autoFlipLocal: opts.autoFlip,
    });
    setLastResult(null);
    setCompletedSnapshot(null);
    setAnalysisReport(null);
    setMatchKey((k) => k + 1);
    setScreen('game');
  };

  const handleCreateOnlineRoom = async (opts: {
    playerName: string;
    colorPref: ColorPreference;
    timeControl: TimeControl;
  }) => {
    if (!canAccessGameMode('online', Boolean(user))) {
      handleOpenAuth('login', getModeGateMessage('online'));
      return;
    }
    setOnlineError(null);
    setOnlineConnecting(true);
    setLastResult(null);
    setCompletedSnapshot(null);
    setAnalysisReport(null);
    try {
      await onlineService.createRoom(opts.playerName, opts.colorPref, opts.timeControl);
    } catch (err) {
      setOnlineConnecting(false);
      setOnlineError(err instanceof Error ? err.message : 'Unable to create online room.');
    }
  };

  const handleJoinOnlineRoom = async (opts: { roomCode: string; playerName: string }) => {
    if (!canAccessGameMode('online', Boolean(user))) {
      handleOpenAuth('login', getModeGateMessage('online'));
      return;
    }
    setOnlineError(null);
    setOnlineConnecting(true);
    setLastResult(null);
    setCompletedSnapshot(null);
    setAnalysisReport(null);
    try {
      await onlineService.joinRoom(opts.roomCode, opts.playerName);
    } catch (err) {
      setOnlineConnecting(false);
      setOnlineError(err instanceof Error ? err.message : 'Unable to join online room.');
    }
  };

  const handleLeaveOnlineRoom = () => {
    onlineService.disconnect();
    setOnlineRoom(null);
    setOnlineAssignedColor(null);
    setOnlineReconnecting(false);
    setOnlineError(null);
    setMatchConfig(null);
    setCompletedSnapshot(null);
    setAnalysisReport(null);
    setScreen('modes');
  };

  const handleGameComplete = useCallback(
    (result: GameResult, snapshot?: CompletedMatchSnapshot) => {
      setLastResult(result);
      setCompletedSnapshot(snapshot || null);
      setAnalysisReport(null);
      const tcLabel = matchConfig?.timeControl.label || '10 + 0';

      if (user) {
        void authService
          .saveMatch(result, tcLabel)
          .then((res) => {
            setMatchHistory(res.matches);
            setServerStats(res.stats);
          })
          .catch(() => {
            const updated = saveMatchResult(result, tcLabel);
            setMatchHistory(updated);
          });
      } else {
        const updated = saveMatchResult(result, tcLabel);
        setMatchHistory(updated);
      }

      setScreen('result');
    },
    [matchConfig, user]
  );

  const handleClearHistory = async () => {
    if (user) {
      try {
        const res = await authService.clearMatches();
        setMatchHistory(res.matches);
        setServerStats(res.stats);
        return;
      } catch {
        // Fallback ignored
      }
    }
    setMatchHistory(clearMatchHistory());
  };

  const handleRematch = () => {
    if (!matchConfig) return;
    if (matchConfig.mode === 'online') {
      setCompletedSnapshot(null);
      setAnalysisReport(null);
      onlineService.requestRematch();
      setScreen('game');
      return;
    }
    setLastResult(null);
    setCompletedSnapshot(null);
    setAnalysisReport(null);
    setMatchKey((k) => k + 1);
    setScreen('game');
  };

  const handleNavigate = (target: ScreenId) => {
    if (target === 'game' && !matchConfig) {
      setScreen('modes');
      return;
    }
    setScreen(target);
  };

  const activeReviewSnapshot =
    completedSnapshot && matchConfig && completedSnapshot.config === matchConfig
      ? completedSnapshot
      : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen flex flex-col glass-ambient-bg text-[#F4F6F0]">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 glass-grid-overlay opacity-45"
        />
        <TopNav
          currentScreen={screen}
          hasActiveMatch={Boolean(matchConfig)}
          muted={muted}
          user={user}
          authLoading={authLoading}
          onToggleMute={() => void handleToggleMute()}
          onNavigate={handleNavigate}
          onOpenAuth={handleOpenAuth}
        />

        <OfflineIndicator />

        <div className="flex-1">
          <motion.div
            key={screen}
            initial={{ opacity: 0.85, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.11, ease: [0.16, 1, 0.3, 1] }}
          >
              {screen === 'dashboard' && (
                <DashboardScreen
                  matchHistory={matchHistory}
                  hasActiveMatch={Boolean(matchConfig)}
                  user={user}
                  authLoading={authLoading}
                  stats={effectiveStats}
                  onNavigate={handleNavigate}
                  onOpenModeTab={(tab) => {
                    setModesInitialPanel(tab);
                    setScreen('modes');
                  }}
                  onQuickStartAI={handleQuickStartAI}
                  onClearHistory={() => void handleClearHistory()}
                  onOpenAuth={handleOpenAuth}
                />
              )}

              {screen === 'modes' && (
                <ModeSelectionScreen
                  isAuthenticated={Boolean(user)}
                  authLoading={authLoading}
                  initialPanel={modesInitialPanel}
                  defaultName={user?.displayName}
                  defaultTimeId={activeSettings.defaultTimeId}
                  defaultAutoFlip={activeSettings.autoFlipLocal}
                  onBack={() => setScreen('dashboard')}
                  onSelectAI={() => setScreen('ai-setup')}
                  onOpenAuth={handleOpenAuth}
                  onStartLocal={handleStartLocalMatch}
                  onCreateOnlineRoom={handleCreateOnlineRoom}
                  onJoinOnlineRoom={handleJoinOnlineRoom}
                  onlineError={onlineError}
                  onlineConnecting={onlineConnecting}
                />
              )}

              {screen === 'ai-setup' && (
                <AISetupScreen
                  defaultColorPref={user?.preferredSide}
                  defaultTimeId={activeSettings.defaultTimeId}
                  onBack={() => setScreen('modes')}
                  onStartMatch={handleStartAIMatch}
                />
              )}

              {screen === 'game' && matchConfig && (
                <GameScreen
                  key={matchKey}
                  config={matchConfig}
                  reviewSnapshot={activeReviewSnapshot}
                  onlineRoom={onlineRoom}
                  onlineAssignedColor={onlineAssignedColor}
                  onlineError={onlineError}
                  onlineReconnecting={onlineReconnecting}
                  showCoordinates={activeSettings.showCoordinates}
                  animatePieces={activeSettings.animatePieces}
                  onGameComplete={handleGameComplete}
                  onViewResult={() => {
                    if (lastResult) setScreen('result');
                  }}
                  onRematchLocalOrAI={handleRematch}
                  onLeaveOnlineRoom={handleLeaveOnlineRoom}
                  onExitToModes={() => setScreen('modes')}
                />
              )}

              {screen === 'result' && lastResult && (
                <GameResultScreen
                  result={lastResult}
                  moves={completedSnapshot?.moves || []}
                  timeControlLabel={matchConfig?.timeControl.label || '10 + 0'}
                  playerFlipped={completedSnapshot?.flipped || false}
                  showCoordinates={activeSettings.showCoordinates}
                  animatePieces={activeSettings.animatePieces}
                  analysisReport={analysisReport}
                  onAnalysisComplete={setAnalysisReport}
                  onRematch={handleRematch}
                  onReviewBoard={() => setScreen('game')}
                  onNavigate={handleNavigate}
                />
              )}

              {screen === 'account' && (
                <AccountScreen
                  user={user}
                  stats={effectiveStats}
                  guestSettings={guestSettings}
                  onBack={() => setScreen('dashboard')}
                  onOpenAuth={handleOpenAuth}
                  onUserUpdated={setUser}
                  onGuestSettingsUpdated={(next) => {
                    setGuestSettings(next);
                    saveGuestSettings(next);
                  }}
                  onLogout={handleLogout}
                />
              )}
            </motion.div>
        </div>

        <AuthModal
          open={authModalOpen}
          initialMode={authModalMode}
          contextMessage={authContextMessage}
          onClose={() => {
            setAuthModalOpen(false);
            setAuthContextMessage(null);
          }}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </MotionConfig>
  );
}
