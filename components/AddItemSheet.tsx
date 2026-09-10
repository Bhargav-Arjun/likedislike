'use client';

import { useRef, useState } from 'react';
import { supabase, Category, NOTE_PROMPTS } from '@/lib/supabase';

type FetchResult = { id: string; title: string; subtitle: string; image_url: string | null; preview_url?: string | null; source: string };

export default function AddItemSheet({
  categories,
  defaultCategoryId,
  defaultStance = 'like',
  prefill,
  onClose,
  onSaved,
}: {
  categories: Category[];
  defaultCategoryId?: string;
  defaultStance?: 'like' | 'dislike';
  prefill?: { title: string; subtitle?: string; image_url?: string | null };
  onClose: () => void;
  onSaved: (insertedItem: any) => void;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?.id || '');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [localCategories, setLocalCategories] = useState(categories);
  const [query, setQuery] = useState(prefill?.title || '');
  const [results, setResults] = useState<FetchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FetchResult | null>(
    prefill ? { id: 'prefill', title: prefill.title, subtitle: prefill.subtitle || '', image_url: prefill.image_url || null, source: 'manual' } : null
  );
  const [manualImage, setManualImage] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string | null>(null);
  const [manualIsVideo, setManualIsVideo] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [stance, setStance] = useState<'like' | 'dislike'>(defaultStance);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 30s clip picker for songs -- iTunes only gives us a ~90s preview clip
  // (not the full track, no licensing for that on a free-tier stack), so
  // the person picks their favorite 30s window within that preview.
  const [clipStart, setClipStart] = useState(0);
  const [clipDuration, setClipDuration] = useState(90);
  const [clipPlaying, setClipPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  function playClipPreview() {
    const audio = audioRef.current;
    if (!audio) return;
    if (clipPlaying) {
      audio.pause();
      setClipPlaying(false);
      return;
    }
    audio.currentTime = clipStart;
    audio.play();
    setClipPlaying(true);
    const stopAt = clipStart + 30;
    const check = () => {
      if (!audio || audio.currentTime >= stopAt || audio.paused) {
        audio.pause();
        setClipPlaying(false);
        audio.removeEventListener('timeupdate', check);
      }
    };
    audio.addEventListener('timeupdate', check);
  }

  const category = localCategories.find((c) => c.id === categoryId);
  const autoFetchable = category?.type === 'movies_series' || category?.type === 'songs';
  const showRating = category?.type === 'movies_series' || category?.type === 'food';
  const promptHint = category ? NOTE_PROMPTS[category.type][stance === 'dislike' ? 1 : 0] : 'why this made the list...';

  // Category names are stored positively ("Movies I like") since that's how
  // they read on the Likes tab -- but showing that same label while adding a
  // dislike would read backwards. This flips the wording for display only;
  // the underlying category row and its name in the database don't change.
  function categoryLabel(cat: Category) {
    if (stance === 'like' || cat.type === 'custom') return cat.name;
    const dislikeLabel: Record<string, string> = {
      movies_series: "Movies I don't like",
      songs: "Songs I don't like",
      food: "Food I don't like",
      places: "Places I don't like",
    };
    return dislikeLabel[cat.type] || cat.name;
  }

  async function runSearch(q: string) {
    setQuery(q);
    if (!autoFetchable || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const endpoint = category?.type === 'movies_series' ? '/api/fetch-movie' : '/api/fetch-song';
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    setMediaError('');

    if (file.type.startsWith('video/')) {
      // Short clips only (10s max) -- checked client-side by reading the
      // video's own metadata before accepting it.
      const duration = await new Promise<number>((resolve) => {
        const videoEl = document.createElement('video');
        videoEl.preload = 'metadata';
        videoEl.onloadedmetadata = () => resolve(videoEl.duration);
        videoEl.onerror = () => resolve(0);
        videoEl.src = URL.createObjectURL(file);
      });
      if (duration > 10) {
        setMediaError('Clips must be 10 seconds or shorter');
        return;
      }
      setManualIsVideo(true);
    } else {
      setManualIsVideo(false);
    }

    setManualImage(file);
    setManualImagePreview(URL.createObjectURL(file));
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: created, error: catError } = await supabase
      .from('categories')
      .insert({
        profile_id: user.id,
        name: newCategoryName.trim(),
        type: 'custom',
        item_limit: 20,
        sort_order: localCategories.length,
      })
      .select()
      .single();

    if (catError) {
      setError(catError.message);
      return;
    }
    if (created) {
      setLocalCategories([...localCategories, created]);
      setCategoryId(created.id);
      setCreatingCategory(false);
      setNewCategoryName('');
      setSelected(null);
      setResults([]);
    }
  }

  async function handleSave() {
    setError('');
    if (!categoryId) {
      setError('Pick a category');
      return;
    }
    const title = selected?.title || query;
    if (!title.trim()) {
      setError('Add a title');
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Session expired, please log in again');
      setSaving(false);
      return;
    }

    let imageUrl = selected?.image_url || null;

    // Manual upload path (cars, bikes, food, places, or manual override)
    if (manualImage) {
      const ext = manualImage.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('item-images').upload(path, manualImage);
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from('item-images').getPublicUrl(path);
      imageUrl = pub.publicUrl;
    }

    const { count } = await supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (category && count !== null && count >= category.item_limit) {
      setError(`This category is full (max ${category.item_limit})`);
      setSaving(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('items')
      .insert({
        category_id: categoryId,
        profile_id: user.id,
        title,
        subtitle: selected?.subtitle || null,
        image_url: imageUrl,
        why_note: note.slice(0, 100),
        stance,
        rating: showRating ? rating : null,
        external_source: selected?.source || 'manual',
        external_id: selected?.id !== 'prefill' ? selected?.id : null,
        audio_preview_url: category?.type === 'songs' ? selected?.preview_url || null : null,
        preview_start_seconds: category?.type === 'songs' && selected?.preview_url ? clipStart : null,
      })
      .select()
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onSaved(inserted);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-neutral-300 rounded-full mx-auto mb-4" />
        <p className="font-medium text-base mb-3">Add item</p>

        <label className="text-xs text-neutral-500">Category</label>
        {!creatingCategory ? (
          <>
            <select
              value={categoryId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setCreatingCategory(true);
                  return;
                }
                setCategoryId(e.target.value);
                setSelected(null);
                setResults([]);
              }}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-3"
            >
              {localCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c)}
                </option>
              ))}
              <option value="__new__">+ New category</option>
            </select>
          </>
        ) : (
          <div className="flex gap-2 mt-1 mb-3">
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="flex-1 border border-neutral-300 rounded-lg px-3 py-2"
            />
            <button onClick={createCategory} className="bg-brand text-white rounded-lg px-3 text-sm">
              Add
            </button>
            <button onClick={() => setCreatingCategory(false)} className="text-neutral-400 text-sm px-1">
              Cancel
            </button>
          </div>
        )}

        {autoFetchable && !selected && (
          <>
            <label className="text-xs text-neutral-500">Search</label>
            <input
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder={category?.type === 'movies_series' ? 'search movies or series...' : 'search songs...'}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-2"
            />
            {searching && <p className="text-xs text-neutral-400 mb-2">searching...</p>}
            {results.length > 0 && (
              <div className="flex flex-col gap-1 mb-3 max-h-52 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected(r);
                      setResults([]);
                    }}
                    className="flex items-center gap-2 border border-neutral-200 rounded-lg p-2 text-left bg-white"
                  >
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" className="w-9 h-9 rounded object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-neutral-200" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm truncate">{r.title}</p>
                      <p className="text-xs text-neutral-400 truncate">{r.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {(selected || !autoFetchable) && (
          <>
            {selected?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.image_url} alt="" className="w-full rounded-xl object-cover mb-2" style={{ aspectRatio: '16 / 9' }} />
            )}

            {category?.type === 'songs' && selected?.preview_url && (
              <div className="bg-neutral-50 rounded-xl p-3 mb-3">
                <audio
                  ref={audioRef}
                  src={selected.preview_url}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration || 90;
                    setClipDuration(d);
                    setClipStart((s) => Math.min(s, Math.max(0, d - 30)));
                  }}
                  className="hidden"
                />
                <p className="text-xs text-neutral-500 mb-2">Pick your 30s clip (from the available preview)</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={playClipPreview}
                    aria-label={clipPlaying ? 'Pause' : 'Play'}
                    className="w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center flex-shrink-0 border-none"
                  >
                    {clipPlaying ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <path d="M6 4l14 8-14 8z" />
                      </svg>
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, Math.floor(clipDuration - 30))}
                    value={clipStart}
                    onChange={(e) => {
                      setClipStart(Number(e.target.value));
                      if (audioRef.current) audioRef.current.pause();
                      setClipPlaying(false);
                    }}
                    className="flex-1"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Playing {Math.round(clipStart)}s – {Math.round(clipStart + 30)}s of the preview
                </p>
              </div>
            )}
            {!autoFetchable && (
              <>
                <label className="text-xs text-neutral-500">Photo or video (max 10s)</label>
                {manualImagePreview && (
                  manualIsVideo ? (
                    <video src={manualImagePreview} className="w-full rounded-xl object-cover mt-1 mb-2" style={{ aspectRatio: '16 / 9' }} muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={manualImagePreview} alt="" className="w-full rounded-xl object-cover mt-1 mb-2" style={{ aspectRatio: '16 / 9' }} />
                  )
                )}
                {mediaError && <p className="text-red-500 text-xs mb-2">{mediaError}</p>}
                <div className="flex gap-2 mt-1 mb-3">
                  <label className="flex-1 flex items-center justify-center gap-1.5 border border-neutral-300 rounded-lg py-2 text-sm text-neutral-600 cursor-pointer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 8a2 2 0 012-2h1.2a1 1 0 00.9-.55l.6-1.2A1 1 0 019.6 3.6h4.8a1 1 0 01.9.55l.6 1.2a1 1 0 00.9.55H18a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
                      <circle cx="12" cy="13" r="3.5" />
                    </svg>
                    Camera
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e.target.files?.[0])}
                    />
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-1.5 border border-neutral-300 rounded-lg py-2 text-sm text-neutral-600 cursor-pointer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="8.5" cy="9.5" r="1.5" />
                      <path d="M21 15l-5-5-9 9" />
                    </svg>
                    Gallery
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </>
            )}
            <label className="text-xs text-neutral-500">Title</label>
            <input
              value={selected?.title ?? query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selected) setSelected({ ...selected, title: e.target.value });
              }}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-3"
            />

            {showRating && (
              <div className="mb-3">
                <label className="text-xs text-neutral-500 block mb-1">Rating</label>
                <div className="scale-125 origin-left inline-block ml-1">
                  {/* Reuse simple inline stars here to avoid extra import cycle */}
                </div>
                <RatingInput rating={rating} onChange={setRating} />
              </div>
            )}

            <label className="text-xs text-neutral-500">Why ({promptHint})</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 100))}
              maxLength={100}
              rows={2}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-1"
            />
            <p className="text-[11px] text-neutral-400 text-right mb-3">{note.length}/100</p>

            <label className="text-xs text-neutral-500 block mb-1">Your take</label>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setStance('like')}
                className={`flex-1 py-2 rounded-lg border ${
                  stance === 'like' ? 'bg-green-50 border-green-400 text-green-700' : 'border-neutral-300 text-neutral-500'
                }`}
              >
                Like
              </button>
              <button
                onClick={() => setStance('dislike')}
                className={`flex-1 py-2 rounded-lg border ${
                  stance === 'dislike' ? 'bg-red-50 border-red-400 text-red-700' : 'border-neutral-300 text-neutral-500'
                }`}
              >
                Dislike
              </button>
            </div>
          </>
        )}

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-brand text-white rounded-lg py-2.5 font-medium mb-2"
        >
          {saving ? 'saving...' : 'Save'}
        </button>
        <button onClick={onClose} className="w-full text-neutral-400 text-sm py-1">
          Cancel
        </button>
      </div>
    </div>
  );
}

function RatingInput({ rating, onChange }: { rating: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4].map((i) => {
        const full = rating >= i + 1;
        const half = rating >= i + 0.5 && rating < i + 1;
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (full) onChange(i);
              else if (half) onChange(i + 1);
              else onChange(i + 0.5);
            }}
            className="bg-transparent border-none p-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <defs>
                <clipPath id={`add-half-${i}`}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
              </defs>
              <path
                d="M12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.2l7.1-.6z"
                fill={full || half ? '#F5B400' : '#E5E5E5'}
                clipPath={half ? `url(#add-half-${i})` : undefined}
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
