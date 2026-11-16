import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-30 mx-auto w-full max-w-[1440px] px-4 pt-3 sm:px-6 lg:px-8"
    >
      <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E9C46A]/45 bg-[#E9C46A]/10 backdrop-blur-md px-4 py-2 font-mono text-xs text-[#F4F6F0]">
        <WifiOff className="h-3.5 w-3.5 text-[#E9C46A] shrink-0" />
        <span>
          Offline Mode — Player vs Stockfish Bot remains available. Online multiplayer requires an
          internet connection.
        </span>
      </div>
    </div>
  );
};
