'use client';

import { useState } from 'react';
import { supabase, Category, NOTE_PROMPTS } from '@/lib/supabase';

type FetchResult = { id: string; title: string; subtitle: string; image_url: string | null; source: string };

export default function AddItemSheet({
  categories,
  defaultCategoryId,
  prefill,
  onClose,
  onSaved,
}: {
  categories: Category[];
  defaultCategoryId?: string;
  prefill?: { title: string; subtitle?: string; image_url?: string | null };
  onClose: () => void;
  onSaved: (insertedItem: any) => void;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?.id || '');
  const [query, setQuery] = useState(prefill?.title || '');
  const [results, setResults] = useState<FetchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FetchResult | null>(
    prefill ? { id: 'prefill', title: prefill.title, subtitle: prefill.subtitle || '', image_url: prefill.image_url || null, source: 'manual' } : null
  );
  const [manualImage, setManualImage] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [stance, setStance] = useState<'like' | 'dislike'>('like');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const category = categories.find((c) => c.id === categoryId);
  const autoFetchable = category?.type === 'movies_series' || category?.type === 'songs';
  const showRating = category?.type === 'movies_series' || category?.type === 'food';
  const promptHint = category ? NOTE_PROMPTS[category.type][0] : 'why this made the list...';

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
      if (!uploadError) {
        const { data: pub } = supabase.storage.from('item-images').getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }
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
        why_note: note.slice(0, 60),
        stance,
        rating: showRating ? rating : null,
        external_source: selected?.source || 'manual',
        external_id: selected?.id !== 'prefill' ? selected?.id : null,
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
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSelected(null);
            setResults([]);
          }}
          className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-3"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

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
              <img src={selected.image_url} alt="" className="w-16 h-16 rounded-lg object-cover mb-2" />
            )}
            {!autoFetchable && (
              <>
                <label className="text-xs text-neutral-500">Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setManualImage(e.target.files?.[0] || null)}
                  className="w-full text-sm mt-1 mb-3"
                />
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
              onChange={(e) => setNote(e.target.value.slice(0, 60))}
              maxLength={60}
              rows={2}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-1"
            />
            <p className="text-[11px] text-neutral-400 text-right mb-3">{note.length}/60</p>

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

