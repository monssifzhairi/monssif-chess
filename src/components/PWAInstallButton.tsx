import React, {useState} from 'react';
import {CheckCircle2, Download, Share, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({variant = 'compact'}) => {
  const {isInstallable, isInstalled, isIOS, isAndroid, triggerInstall} = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (variant === 'compact') {
    if (isInstalled || (!isInstallable && !isIOS)) {
      return null;
    }

    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              void triggerInstall();
            } else {
              setShowGuide(true);
            }
          }}
          className="inline-flex h-9 sm:h-10 items-center gap-1.5 rounded-xl btn-glass-secondary px-3 font-mono text-xs font-medium text-[#B9D7B9] hover:text-[#F4F6F0] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9D7B9]"
          title="Install MONSSIF CHESS app"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Install App</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#040806]/70 backdrop-blur-xl p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Install MONSSIF CHESS on your device"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowGuide(false);
            }}
          >
            <div className="w-full max-w-sm rounded-[22px] glass-surface-elevated p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="h-5 w-5 text-[#B9D7B9]" />
                  <h3 className="font-display text-lg font-semibold text-[#F4F6F0]">
                    Install MONSSIF CHESS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close install guide"
                  className="flex h-8 w-8 items-center justify-center rounded-xl btn-glass-secondary text-[#A5B3A8]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs leading-relaxed text-[#A5B3A8]">
                {isIOS
                  ? 'Tap Share in Safari, then choose "Add to Home Screen" to launch MONSSIF CHESS full-screen.'
                  : 'Open the browser menu (⋮) in Chrome on Android and tap "Install app" or "Add to Home screen".'}
              </p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full rounded-xl btn-glass-primary py-2.5 font-mono text-xs font-semibold"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="rounded-[22px] glass-surface-elevated p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.09] pb-4">
        <div className="flex items-center gap-2.5">
          <Smartphone className="h-4 w-4 text-[#B9D7B9]" />
          <h2 className="font-display text-lg font-medium text-[#F4F6F0]">
            Android &amp; Mobile App
          </h2>
        </div>
        {isInstalled ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#B9D7B9]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Installed
          </span>
        ) : (
          <span className="font-mono text-xs text-[#A5B3A8]">PWA Ready</span>
        )}
      </div>

      {isInstalled ? (
        <p className="text-sm text-[#A5B3A8] leading-relaxed">
          MONSSIF CHESS is running in standalone app mode with cached Stockfish 19 assets for
          offline Player vs Bot play.
        </p>
      ) : isInstallable ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-[#A5B3A8] leading-relaxed">
            Install MONSSIF CHESS directly to your Android home screen for full-screen gameplay and
            offline Stockfish 19 bot support.
          </p>
          <button
            type="button"
            onClick={() => void triggerInstall()}
            className="inline-flex items-center justify-center gap-2 rounded-xl btn-glass-primary px-5 py-2.5 font-mono text-xs font-semibold shrink-0"
          >
            <Download className="h-4 w-4" />
            Install Android App
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 text-sm text-[#A5B3A8] leading-relaxed">
          <p>
            Installable as a standalone Android or iOS app directly from your mobile browser — no
            store download required:
          </p>
          <ul className="space-y-1.5 font-mono text-xs text-[#E9E5D9]">
            <li>
              • {isAndroid ? 'Chrome on Android' : 'Android Chrome'}: Tap Menu (⋮) →{' '}
              <span className="text-[#B9D7B9]">Install app</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span>• iPhone / iPad Safari: Tap</span>
              <Share className="h-3.5 w-3.5 text-[#B9D7B9]" />
              <span>
                → <span className="text-[#B9D7B9]">Add to Home Screen</span>
              </span>
            </li>
          </ul>
        </div>
      )}
    </section>
  );
};
