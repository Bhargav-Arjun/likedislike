'use client';

// Tapping a star cycles: if this star is currently empty relative to rating -> half,
// if half -> full, if full -> empty. Read-only mode just renders the value.
export default function StarRating({
  rating,
  onChange,
  readOnly = false,
}: {
  rating: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  const handleTap = (starIndex: number) => {
    if (readOnly || !onChange) return;
    const full = starIndex + 1;
    const half = starIndex + 0.5;
    let next: number;
    if (rating >= full) next = starIndex; // was full -> clear this star
    else if (rating >= half) next = full; // was half -> make full
    else next = half; // was empty -> make half
    onChange(next);
  };

  return (
    <div className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const fillLevel = rating >= i + 1 ? 'full' : rating >= i + 0.5 ? 'half' : 'empty';
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => handleTap(i)}
            aria-label={`Star ${i + 1}`}
            className="p-0 bg-transparent border-none"
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24">
              <defs>
                <clipPath id={`half-clip-${i}`}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
              </defs>
              <path
                d="M12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z"
                fill={fillLevel === 'empty' ? '#E5E5E5' : '#F5B400'}
                clipPath={fillLevel === 'half' ? `url(#half-clip-${i})` : undefined}
              />
              {fillLevel === 'half' && (
                <path
                  d="M12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z"
                  fill="none"
                  stroke="#E5E5E5"
                  strokeWidth="0"
                />
              )}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

