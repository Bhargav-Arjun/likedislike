export default function EmptyIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="emptyGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F472B6" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>
        <linearGradient id="emptyGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDBA74" />
          <stop offset="100%" stopColor="#FB923C" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="#FCE7F3" />
      <path d="M30 46 L90 30 L60 90 L52 62 Z" fill="url(#emptyGrad1)" />
      <path d="M30 46 L60 90 L52 62 Z" fill="#831843" opacity="0.25" />
      <circle cx="88" cy="82" r="14" fill="url(#emptyGrad2)" />
      <circle cx="24" cy="80" r="7" fill="#A78BFA" />
    </svg>
  );
}

