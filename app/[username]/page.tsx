'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Profile, Category, CategoryWithItems, Item } from '@/lib/supabase';
import SocialIcons from '@/components/SocialIcons';
import ItemCard from '@/components/ItemCard';
import AddItemSheet from '@/components/AddItemSheet';

export default function ProfilePage({ params }: { params: { username: string } }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [matchContext, setMatchContext] = useState<Item | null>(null);
  const [visitorCategories, setVisitorCategories] = useState<Category[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [phase2Toast, setPhase2Toast] = useState(false);
  const [activeTab, setActiveTab] = useState<'like' | 'dislike'>('like');
  const touchStartX = useRef<number | null>(null);

  function showPhase2Toast() {
    setPhase2Toast(true);
    setTimeout(() => setPhase2Toast(false), 2200);
  }

  const load = useCallback(async () => {
    // getSession() reads from local storage (instant) instead of getUser(),
    // which makes a network round-trip to re-validate the token every time.
    // Combined with fetching the profile in parallel, this noticeably cuts
    // the "loading..." time on every page open.
    const [sessionResult, profResult] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from('profiles').select('*').eq('username', params.username).single(),
    ]);

    setCurrentUserId(sessionResult.data.session?.user?.id || null);

    const prof = profResult.data;
    if (!prof) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setProfile(prof);

    const { data: cats } = await supabase
      .from('categories')
      .select('*, items(*)')
      .eq('profile_id', prof.id)
      .order('sort_order');

    const allItemIds = (cats || []).flatMap((c: any) => c.items.map((i: Item) => i.id));

    const [{ data: reactions }, { data: matches }] = allItemIds.length
      ? await Promise.all([
          supabase.from('item_reactions').select('item_id, reactor_id').in('item_id', allItemIds),
          supabase.from('item_matches').select('source_item_id').in('source_item_id', allItemIds),
        ])
      : [{ data: [] }, { data: [] }];

    const currentUserId = sessionResult.data.session?.user?.id;
    const withCounts = (cats || []).map((c: any) => ({
      ...c,
      items: c.items
        .sort((a: Item, b: Item) => a.sort_order - b.sort_order)
        .map((item: Item) => ({
          ...item,
          reaction_count: (reactions || []).filter((r) => r.item_id === item.id).length,
          match_count: (matches || []).filter((m) => m.source_item_id === item.id).length,
          user_reacted: (reactions || []).some((r) => r.item_id === item.id && r.reactor_id === currentUserId),
        })),
    }));

    setCategories(withCounts);
    setLoading(false);
  }, [params.username]);

  useEffect(() => {
    load();
  }, [load]);

  // Prefetching this route means tapping "Edit profile" doesn't wait to fetch
  // the page's JS bundle -- it's already warm, so the click feels instant.
  useEffect(() => {
    router.prefetch('/edit-profile');
  }, [router]);

  const isOwner = !!currentUserId && !!profile && currentUserId === profile.id;
  const canInteract = !!currentUserId;

  const totalLikes = categories.reduce((sum, c) => sum + c.items.filter((i) => i.stance === 'like').length, 0);
  const totalDislikes = categories.reduce((sum, c) => sum + c.items.filter((i) => i.stance === 'dislike').length, 0);
  const totalItems = totalLikes + totalDislikes;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 50) return;
    if (deltaX < 0) setActiveTab('dislike'); // swipe left -> dislikes
    else setActiveTab('like'); // swipe right -> likes
  }

  async function handleReact(item: any) {
    if (!currentUserId) return;
    if (item.user_reacted) {
      await supabase.from('item_reactions').delete().eq('item_id', item.id).eq('reactor_id', currentUserId);
    } else {
      await supabase.from('item_reactions').insert({ item_id: item.id, reactor_id: currentUserId });
    }
    load();
  }

  async function handleMatch(item: any) {
    if (!currentUserId) return;
    if (!isOwner && visitorCategories.length === 0) {
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('profile_id', currentUserId)
        .order('sort_order');
      setVisitorCategories(cats || []);
    }
    setMatchContext(item);
    setSheetOpen(true);
  }

  function handleDiscuss(item: any) {
    // Real 1-to-1 messaging is held back for Phase 2. Heart reactions still
    // notify the owner (see handleReact), so "someone liked this" signal
    // isn't lost -- only open-ended chat is deferred.
    showPhase2Toast();
  }

  async function handleRatingChange(item: any, rating: number) {
    await supabase.from('items').update({ rating }).eq('id', item.id);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('items').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  }

  async function handleItemSaved(inserted: any) {
    if (matchContext && inserted) {
      await supabase.from('item_matches').insert({
        source_item_id: matchContext.id,
        copied_item_id: inserted.id,
        matcher_id: currentUserId,
      });
    }
    setSheetOpen(false);
    setMatchContext(null);
    load();
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;
  if (notFound || !profile) return <main className="min-h-screen flex items-center justify-center">profile not found</main>;

  // Own categories, used both for the "+ Add" sheet and as the match-copy target list.
  // For visitors this is fetched lazily (see handleMatch) to keep the initial page load light.
  const myCategories = isOwner ? categories : visitorCategories;

  return (
    <main className="min-h-screen px-5 py-6 relative">
      {!isOwner && currentUserId && (
        <button
          onClick={showPhase2Toast}
          aria-label="Message"
          className="absolute top-6 right-5 w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      )}

      {isOwner && (
        <button
          onClick={() => router.push('/notifications')}
          aria-label="Notifications"
          className="absolute top-6 right-5 w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
        </button>
      )}

      <div className="flex items-center gap-5 mb-3">
        <div className="w-20 h-20 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#BDBDBD">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          )}
        </div>
        <div className="flex flex-1 justify-around">
          <div className="flex flex-col items-center">
            <span className="font-semibold text-base">{totalLikes}</span>
            <span className="text-xs text-neutral-500">likes</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-semibold text-base">{totalDislikes}</span>
            <span className="text-xs text-neutral-500">dislikes</span>
          </div>
        </div>
      </div>

      <p className="font-medium text-base mb-3">{profile.display_name}</p>

      <SocialIcons profile={profile} />

      {isOwner && (
        <button
          onClick={() => router.push('/edit-profile')}
          className="w-full bg-brand text-white rounded-lg py-2 text-sm font-medium mb-5"
        >
          Edit profile
        </button>
      )}

      {totalItems === 0 ? (
        <div className="flex flex-col items-center pt-10 pb-6">
          <div className="w-24 h-24 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden mb-4">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
            ) : (
              <svg width="46" height="46" viewBox="0 0 24 24" fill="#BDBDBD">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            )}
          </div>
          {isOwner ? (
            <>
              <p className="text-sm font-medium mb-1">Nothing added yet</p>
              <p className="text-xs text-neutral-400 mb-4">Movies, songs, food, places -- start with your first one</p>
              <button
                onClick={() => {
                  setMatchContext(null);
                  setSheetOpen(true);
                }}
                className="bg-brand text-white rounded-lg px-6 py-2 text-sm font-medium"
              >
                Create
              </button>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Nothing shared yet</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex border-b border-neutral-200 mb-4">
            <button
              onClick={() => setActiveTab('like')}
              className="flex-1 flex items-center justify-center py-2.5 bg-transparent border-none"
              style={{ borderBottom: activeTab === 'like' ? '2px solid #16A34A' : '2px solid transparent' }}
              aria-label="Likes"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'like' ? '#16A34A' : 'none'} stroke={activeTab === 'like' ? '#16A34A' : '#A3A3A3'} strokeWidth="1.8">
                <path d="M2 21h2a1 1 0 001-1v-9a1 1 0 00-1-1H2v11zM22 10.5A2.5 2.5 0 0019.5 8H14l.9-4.4c.1-.5 0-1-.3-1.4A2 2 0 0013 1L7 8.5V21h11a2 2 0 002-1.6l2-7.5v-1.4z" />
              </svg>
            </button>
            <button
              onClick={() => setActiveTab('dislike')}
              className="flex-1 flex items-center justify-center py-2.5 bg-transparent border-none"
              style={{ borderBottom: activeTab === 'dislike' ? '2px solid #DC2626' : '2px solid transparent' }}
              aria-label="Dislikes"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === 'dislike' ? '#DC2626' : 'none'} stroke={activeTab === 'dislike' ? '#DC2626' : '#A3A3A3'} strokeWidth="1.8">
                <path d="M2 3h2a1 1 0 011 1v9a1 1 0 01-1 1H2V3zM22 13.5A2.5 2.5 0 0019.5 16H14l.9 4.4c.1.5 0 1-.3 1.4A2 2 0 0113 23L7 15.5V3h11a2 2 0 012 1.6l2 7.5v1.4z" />
              </svg>
            </button>
          </div>

          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {categories.map((cat) => {
              const filteredItems = cat.items.filter((i) => i.stance === activeTab);
              const categoryIsEmpty = cat.items.length === 0;
              // On the dislikes tab, skip categories that have zero items entirely --
              // no need for an empty-state prompt on both tabs at once.
              if (filteredItems.length === 0 && !(activeTab === 'like' && categoryIsEmpty)) return null;

              return (
                <section key={cat.id} className="mb-5">
                  <div className="flex justify-between items-baseline mb-2">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-neutral-400">{filteredItems.length}</p>
                  </div>
                  {filteredItems.length === 0 ? (
                    <p className="text-xs text-neutral-400">
                      {cat.type === 'movies_series' && 'share the movies and series you love'}
                      {cat.type === 'songs' && 'share the songs on your playlist'}
                      {cat.type === 'food' && 'share the food you love to eat'}
                      {cat.type === 'places' && 'share the places that make you comfortable'}
                      {cat.type === 'custom' && 'nothing added yet'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {filteredItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item as any}
                          categoryType={cat.type}
                          isOwner={isOwner}
                          canInteract={canInteract && !isOwner}
                          onReact={handleReact}
                          onMatch={handleMatch}
                          onDiscuss={handleDiscuss}
                          onRatingChange={handleRatingChange}
                          onLongPress={(i) => isOwner && setDeleteTarget(i)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-8"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDeleteTarget(null)}
        >
          <div className="bg-white rounded-xl p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium mb-1">Delete "{deleteTarget.title}"?</p>
            <p className="text-xs text-neutral-400 mb-4">This can't be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-neutral-300 rounded-lg py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm"
              >
                {deleting ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <AddItemSheet
          categories={myCategories}
          prefill={matchContext ? { title: matchContext.title, subtitle: matchContext.subtitle || undefined, image_url: matchContext.image_url } : undefined}
          onClose={() => {
            setSheetOpen(false);
            setMatchContext(null);
          }}
          onSaved={handleItemSaved}
        />
      )}

      <p className="text-center text-[11px] text-neutral-300 mt-8">made with GetMe</p>

      {isOwner && totalItems > 0 && (
        <button
          onClick={() => {
            setMatchContext(null);
            setSheetOpen(true);
          }}
          aria-label="Add item"
          className="fixed bottom-6 right-5 w-14 h-14 rounded-full bg-brand text-white text-2xl flex items-center justify-center shadow-lg z-40"
        >
          +
        </button>
      )}

      {phase2Toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-4 py-2 rounded-full z-50 whitespace-nowrap">
          Messaging launches in Phase 2 🚀
        </div>
      )}
    </main>
  );
}
