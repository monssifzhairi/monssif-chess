import React from 'react';

interface MonssifLogoProps {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  className?: string;
}

export const MonssifLogo: React.FC<MonssifLogoProps> = ({
  size = 36,
  showWordmark = true,
  showTagline = false,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-3 shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_4px_14px_rgba(185,215,185,0.16)]"
      >
        <defs>
          <linearGradient id="monssif-glass-fill" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(39, 63, 49, 0.85)" />
            <stop offset="100%" stopColor="rgba(12, 20, 15, 0.92)" />
          </linearGradient>
          <linearGradient id="monssif-glass-rim" x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.35)" />
            <stop offset="50%" stopColor="rgba(185, 215, 185, 0.2)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.08)" />
          </linearGradient>
        </defs>
        {/* Frosted glass outer shield frame */}
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12"
          fill="url(#monssif-glass-fill)"
          stroke="url(#monssif-glass-rim)"
          strokeWidth="1.4"
        />
        {/* Hybrid M pillar + Knight crest */}
        <path d="M11 36V14L17 20V36H11Z" fill="#EFECE2" />
        <path
          d="M17 20L24 27L30 16L25 14L27.5 10.5L34 12.5L37 18.5L33 21.5L37 26V36H31V24.5L24 31.5L17 24.5V20Z"
          fill="#B9D7B9"
        />
        <circle cx="31.5" cy="15.5" r="1.3" fill="#0A110C" />
        <rect x="10" y="37.5" width="28" height="2" rx="1" fill="rgba(185, 215, 185, 0.45)" />
      </svg>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-display text-base font-semibold tracking-tight text-[#F4F6F0] whitespace-nowrap">
            MONSSIF <span className="text-[#B9D7B9]">CHESS</span>
          </span>
          {showTagline && (
            <span className="mt-1 text-xs text-[#A5B3A8] whitespace-nowrap">
              Think beyond the board.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
