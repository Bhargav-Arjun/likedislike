'use client';

import { useRef } from 'react';
import StarRating from './StarRating';
import { Item, CategoryType } from '@/lib/supabase';

type ItemWithCounts = Item & {
  reaction_count: number;
  match_count: number;
  user_reacted: boolean;
};

export default function ItemCard({
  item,
  categoryType,
  isOwner,
  canInteract,
  onReact,
  onMatch,
  onDiscuss,
  onRatingChange,
  onLongPress,
}: {
  item: ItemWithCounts;
  categoryType: CategoryType;
  isOwner: boolean;
  canInteract: boolean; // true if a visitor is logged in (needed for heart/match/discuss)
  onReact: (item: ItemWithCounts) => void;
  onMatch: (item: ItemWithCounts) => void;
  onDiscuss: (item: ItemWithCounts) => void;
  onRatingChange?: (item: ItemWithCounts, rating: number) => void;
  onLongPress?: (item: ItemWithCounts) => void;
}) {
  const showRating = categoryType === 'movies_series' || categoryType === 'food';
  const isLike = item.stance === 'like';
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startPress() {
    if (!isOwner || !onLongPress) return;
    pressTimer.current = setTimeout(() => onLongPress(item), 550);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  return (
    <div
      className="relative rounded-lg p-3 flex flex-col gap-2"
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      style={{
        background: '#FAFAFA',
        borderLeft: `3px solid ${isLike ? '#3B82F6' : '#3B82F6'}`,
        borderRadius: '0 8px 8px 0',
      }}
    >
      <div
        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: isLike ? '#DCFCE7' : '#FEE2E2' }}
        aria-label={isLike ? 'Liked' : 'Disliked'}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          {isLike ? (
            <path
              d="M2 21h2a1 1 0 001-1v-9a1 1 0 00-1-1H2v11zM22 10.5A2.5 2.5 0 0019.5 8H14l.9-4.4c.1-.5 0-1-.3-1.4A2 2 0 0013 1L7 8.5V21h11a2 2 0 002-1.6l2-7.5v-1.4z"
              fill="#16A34A"
            />
          ) : (
            <path
              d="M2 3h2a1 1 0 011 1v9a1 1 0 01-1 1H2V3zM22 13.5A2.5 2.5 0 0019.5 16H14l.9 4.4c.1.5 0 1-.3 1.4A2 2 0 0113 23L7 15.5V3h11a2 2 0 012 1.6l2 7.5v1.4z"
              fill="#DC2626"
            />
          )}
        </svg>
      </div>

      <div className="flex gap-2.5">
        <div className="w-12 h-12 rounded-md bg-neutral-200 flex-shrink-0 overflow-hidden">
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-sm font-medium truncate">{item.title}</p>
          {item.subtitle && <p className="text-xs text-neutral-400">{item.subtitle}</p>}
          {showRating && (
            <div className="my-0.5">
              <StarRating
                rating={item.rating || 0}
                readOnly={!isOwner}
                onChange={isOwner && onRatingChange ? (v) => onRatingChange(item, v) : undefined}
              />
            </div>
          )}
          {item.why_note && <p className="text-xs text-neutral-500 leading-snug mt-0.5">{item.why_note}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4 pl-[58px]">
        <button
          onClick={() => canInteract && onReact(item)}
          disabled={!canInteract}
          className="flex items-center gap-1 bg-transparent border-none p-0"
          aria-label="Relate to this"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={item.user_reacted ? '#EF4444' : 'none'} stroke="#EF4444" strokeWidth="1.8">
            <path d="M12 21s-7-4.5-9.5-9C.7 8.4 2 4.5 6 4c2-.3 3.8.8 6 3.2C14.2 4.8 16 3.7 18 4c4 .5 5.3 4.4 3.5 8-2.5 4.5-9.5 9-9.5 9z" />
          </svg>
          <span className="text-[11px] text-neutral-500">{item.reaction_count}</span>
        </button>
        <button
          onClick={() => canInteract && onMatch(item)}
          disabled={!canInteract}
          className="flex items-center gap-1 bg-transparent border-none p-0"
          aria-label="Add to my list too"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8">
            <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          <span className="text-[11px] text-neutral-500">{item.match_count}</span>
        </button>
        <button
          onClick={() => canInteract && onDiscuss(item)}
          disabled={!canInteract}
          className="flex items-center gap-1 bg-transparent border-none p-0"
          aria-label="Discuss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="1.8">
            <path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
