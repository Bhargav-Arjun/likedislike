'use client';

import { useEffect, useRef, useState } from 'react';
import StarRating from './StarRating';
import { Item, CategoryType } from '@/lib/supabase';

type ItemWithCounts = Item & {
  reaction_count: number;
  match_count: number;
  user_reacted: boolean;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

export default function ItemCard({
  item,
  categoryType,
  categoryTag,
  avatarUrl,
  displayName,
  username,
  isOwner,
  canInteract,
  onReact,
  onMatch,
  onDiscuss,
  onRatingChange,
  onLongPress,
  onDelete,
}: {
  item: ItemWithCounts;
  categoryType: CategoryType;
  categoryTag: string;
  avatarUrl: string | null;
  displayName: string;
  username: string;
  isOwner: boolean;
  canInteract: boolean;
  onReact: (item: ItemWithCounts) => void;
  onMatch: (item: ItemWithCounts) => void;
  onDiscuss: (item: ItemWithCounts) => void;
  onRatingChange?: (item: ItemWithCounts, rating: number) => void;
  onLongPress?: (item: ItemWithCounts) => void;
  onDelete?: (item: ItemWithCounts) => void;
}) {
  const showRating = categoryType === 'movies_series' || categoryType === 'food';
  const isLike = item.stance === 'like';
  const isVideo = item.image_url ? /\.(mp4|webm|mov|m4v)$/i.test(item.image_url) : false;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [songPlaying, setSongPlaying] = useState(false);

  // Only one song plays at a time across the whole feed -- when this card
  // starts playing it announces itself, and every other card's effect below
  // pauses itself in response.
  useEffect(() => {
    function handleOtherPlay(e: Event) {
      const startedId = (e as CustomEvent).detail;
      if (startedId !== item.id && audioRef.current) {
        audioRef.current.pause();
        setSongPlaying(false);
      }
    }
    window.addEventListener('ispace-song-play', handleOtherPlay);
    return () => window.removeEventListener('ispace-song-play', handleOtherPlay);
  }, [item.id]);

  function toggleSongPlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (songPlaying) {
      audio.pause();
      setSongPlaying(false);
      return;
    }
    window.dispatchEvent(new CustomEvent('ispace-song-play', { detail: item.id }));
    audio.currentTime = item.preview_start_seconds || 0;
    audio.play();
    setSongPlaying(true);
    const stopAt = (item.preview_start_seconds || 0) + 30;
    const check = () => {
      if (!audio || audio.currentTime >= stopAt || audio.paused) {
        audio.pause();
        setSongPlaying(false);
        audio.removeEventListener('timeupdate', check);
      }
    };
    audio.addEventListener('timeupdate', check);
  }

  function startPress() {
    if (!isOwner || !onLongPress) return;
    pressTimer.current = setTimeout(() => onLongPress(item), 550);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  async function handleShare() {
    const shareData = { title: item.title, text: `${item.title}${item.subtitle ? ' — ' + item.subtitle : ''}`, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled -- ignore */
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  }

  return (
    <div
      className="relative py-3.5 border-b border-neutral-100"
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-neutral-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#8E8E8E">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.5 4-7 8-7s8 2.5 8 7" />
              </svg>
            )}
          </div>
          <p className="text-[14px] truncate">
            <span className="font-bold" style={{ color: '#0F1419' }}>{displayName}</span>{' '}
            <span className="text-neutral-500">@{username} · {relativeTime(item.created_at)}</span>
          </p>
        </div>

        {isOwner && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More"
              className="w-7 h-7 flex items-center justify-center bg-transparent border-none text-neutral-400"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-neutral-200 z-20 py-1 w-32">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete?.(item);
                    }}
                    className="w-full text-left px-3 py-2 text-[13px] text-red-500 bg-transparent border-none"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-2 pr-1">
        <div className="min-w-0">
          <span className="text-[13px] font-medium" style={{ color: '#1D9BF0' }}>
            @{categoryTag}
          </span>
          <p className="text-[16px] font-bold text-black leading-tight mt-0.5">{item.title}</p>
          {item.subtitle && <p className="text-[13px] text-neutral-500">{item.subtitle}</p>}
        </div>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
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
      </div>

      {showRating && (
        <div className="my-1">
          <StarRating
            rating={item.rating || 0}
            readOnly={!isOwner}
            onChange={isOwner && onRatingChange ? (v) => onRatingChange(item, v) : undefined}
          />
        </div>
      )}
      {item.why_note && <p className="text-[14px] text-neutral-800 leading-snug mt-1 mb-2.5">{item.why_note}</p>}

      {item.image_url && (
        <div className="relative rounded-2xl overflow-hidden bg-neutral-100 mb-2.5" style={{ aspectRatio: '16 / 9' }}>
          {isVideo ? (
            <video src={item.image_url} className="w-full h-full object-cover" muted loop playsInline autoPlay />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
          )}
          {categoryType === 'songs' && item.audio_preview_url && (
            <>
              <audio ref={audioRef} src={item.audio_preview_url} className="hidden" />
              <button
                onClick={toggleSongPlay}
                aria-label={songPlaying ? 'Pause' : 'Play 30 second preview'}
                className="absolute inset-0 flex items-center justify-center bg-transparent border-none"
                style={{ background: 'rgba(0,0,0,0.15)' }}
              >
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow">
                  {songPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0F1419">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0F1419">
                      <path d="M6 4l14 8-14 8z" />
                    </svg>
                  )}
                </div>
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between max-w-[300px]">
        <button
          onClick={() => canInteract && onDiscuss(item)}
          disabled={!canInteract}
          className="flex items-center gap-1.5 bg-transparent border-none p-0"
          aria-label="Discuss"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#536471" strokeWidth="1.8">
            <path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        </button>
        <button
          onClick={() => canInteract && onMatch(item)}
          disabled={!canInteract}
          className="flex items-center gap-1.5 bg-transparent border-none p-0"
          aria-label="Add to my list too"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#536471" strokeWidth="1.8">
            <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
          </svg>
          <span className="text-[13px] text-neutral-500">{item.match_count}</span>
        </button>
        <button
          onClick={() => canInteract && onReact(item)}
          disabled={!canInteract}
          className="flex items-center gap-1.5 bg-transparent border-none p-0"
          aria-label="Relate to this"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill={item.user_reacted ? '#F91880' : 'none'} stroke={item.user_reacted ? '#F91880' : '#536471'} strokeWidth="1.8">
            <path d="M12 21s-7-4.5-9.5-9C.7 8.4 2 4.5 6 4c2-.3 3.8.8 6 3.2C14.2 4.8 16 3.7 18 4c4 .5 5.3 4.4 3.5 8-2.5 4.5-9.5 9-9.5 9z" />
          </svg>
          <span className="text-[13px]" style={{ color: item.user_reacted ? '#F91880' : '#536471' }}>{item.reaction_count}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 bg-transparent border-none p-0"
          aria-label="Share"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#536471" strokeWidth="1.8">
            <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
