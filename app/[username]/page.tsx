'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Profile, Category, CategoryWithItems, Item, categoryTagSlug, getOrCreateConversation, getMyConnectId } from '@/lib/supabase';
import ItemCard from '@/components/ItemCard';
import AddItemSheet from '@/components/AddItemSheet';
import EmptyIllustration from '@/components/EmptyIllustration';

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [myConnectId, setMyConnectId] = useState<string | null>(null);
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

  useEffect(() => {
    if (drawerOpen && isOwner && !myConnectId) {
      getMyConnectId().then(setMyConnectId);
    }
  }, [drawerOpen, isOwner, myConnectId]);
  const canInteract = !!currentUserId;

  const totalLikes = categories.reduce((sum, c) => sum + c.items.filter((i) => i.stance === 'like').length, 0);
  const totalDislikes = categories.reduce((sum, c) => sum + c.items.filter((i) => i.stance === 'dislike').length, 0);
  const totalItems = totalLikes + totalDislikes;

  // Category names read positively ("Movies I like") -- fine on the Likes tab,
  // but shown as-is above a disliked item it reads backwards. Flip the label
  // for display only; the stored category name never changes.
  function categoryLabel(cat: Category) {
    if (activeTab === 'like' || cat.type === 'custom') return cat.name;
    const dislikeLabel: Record<string, string> = {
      movies_series: "Movies I don't like",
      songs: "Songs I don't like",
      food: "Food I don't like",
      places: "Places I don't like",
    };
    return dislikeLabel[cat.type] || cat.name;
  }

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

  async function handleDiscuss(item: any) {
    if (!currentUserId || !profile) return;
    if (currentUserId === profile.id) return; // can't message yourself
    try {
      const convo = await getOrCreateConversation(currentUserId, profile.id);
      router.push(`/chats/${convo.id}`);
    } catch (err: any) {
      // e.g. blocked -- surface as the same lightweight toast pattern used elsewhere
      setPhase2Toast(true);
      setTimeout(() => setPhase2Toast(false), 2200);
    }
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
    <main className="min-h-screen relative">
      {/* Top bar -- X layout: small avatar left (opens drawer), app icon center, bell/message right */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white z-30 border-b border-neutral-100">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Profile menu"
          className="w-9 h-9 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center flex-shrink-0 border-none p-0"
        >
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#8E8E8E">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.5 4-7 8-7s8 2.5 8 7" />
            </svg>
          )}
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="iSpace" className="w-8 h-8 rounded-lg object-cover" />

        <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
          {isOwner && (
            <button
              onClick={() => router.push('/messages')}
              aria-label="Messages"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-transparent border-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9BF0" strokeWidth="1.8">
                <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 01-3.4 0" />
              </svg>
            </button>
          )}
          {!isOwner && currentUserId && (
            <button
              onClick={() => handleDiscuss(null)}
              aria-label="Message"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-transparent border-none"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1D9BF0" strokeWidth="1.8">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Drawer -- full-height side panel from the avatar, matching X's real side-menu (not a small floating card) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="h-full bg-white shadow-xl p-5"
            style={{ width: '82%', maxWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close"
              className="w-16 h-16 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center border-none p-0 mb-3"
            >
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="#8E8E8E">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4.5 4-7 8-7s8 2.5 8 7" />
                </svg>
              )}
            </button>
            <p className="font-bold text-[17px]" style={{ color: '#0F1419' }}>
              {profile.display_name}
            </p>
            <p className="text-[14px] text-neutral-500 mb-5">@{profile.username}</p>

            {isOwner && myConnectId && (
              <p className="text-[13px] text-neutral-500 mb-4 -mt-3">
                Connect ID: <span className="font-bold" style={{ color: '#0F1419' }}>{myConnectId}</span>
              </p>
            )}

            <button
              onClick={() => {
                setDrawerOpen(false);
                router.push('/edit-profile');
              }}
              className="w-full text-left font-bold text-[16px] py-3 border-t border-neutral-100 bg-transparent border-none flex items-center gap-3"
              style={{ color: '#0F1419' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F1419" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.5 4-7 8-7s8 2.5 8 7" />
              </svg>
              Profile
            </button>

            {isOwner && (
              <>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    router.push('/connect');
                  }}
                  className="w-full text-left font-bold text-[16px] py-3 border-t border-neutral-100 bg-transparent border-none flex items-center gap-3"
                  style={{ color: '#0F1419' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F1419" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  Find people
                </button>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    router.push('/chats');
                  }}
                  className="w-full text-left font-bold text-[16px] py-3 border-t border-neutral-100 bg-transparent border-none flex items-center gap-3"
                  style={{ color: '#0F1419' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F1419" strokeWidth="1.8">
                    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 01-3.4 0" />
                  </svg>
                  Chats
                </button>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    router.push('/nearby');
                  }}
                  className="w-full text-left font-bold text-[16px] py-3 border-t border-neutral-100 bg-transparent border-none flex items-center gap-3"
                  style={{ color: '#0F1419' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F1419" strokeWidth="1.8">
                    <path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  Nearby
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex px-2 mt-1">
        <button
          onClick={() => setActiveTab('like')}
          className="flex-1 flex items-center justify-center py-3.5 bg-transparent border-none"
          style={{ borderBottom: activeTab === 'like' ? '3px solid #1D9BF0' : '3px solid transparent' }}
        >
          <span
            className="text-[15px]"
            style={{ color: activeTab === 'like' ? '#0F1419' : '#536471', fontWeight: activeTab === 'like' ? 800 : 500 }}
          >
            Likes
          </span>
        </button>
        <button
          onClick={() => setActiveTab('dislike')}
          className="flex-1 flex items-center justify-center py-3.5 bg-transparent border-none"
          style={{ borderBottom: activeTab === 'dislike' ? '3px solid #1D9BF0' : '3px solid transparent' }}
        >
          <span
            className="text-[15px]"
            style={{ color: activeTab === 'dislike' ? '#0F1419' : '#536471', fontWeight: activeTab === 'dislike' ? 800 : 500 }}
          >
            Dislikes
          </span>
        </button>
      </div>


      {/* min-h ensures the swipeable area covers the rest of the screen even when
          the active tab has no items -- otherwise the touch area collapses to
          almost nothing and swipes below it are never detected. */}
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="min-h-[50vh] px-5 pt-2">
        {(() => {
          const tabHasAnyItems = categories.some((c) => c.items.some((i) => i.stance === activeTab));

          if (!tabHasAnyItems) {
            return (
              <div className="flex flex-col items-center pt-8 pb-6">
                <EmptyIllustration size={110} />
                {isOwner ? (
                  <>
                    <p className="text-sm font-medium mt-4 mb-2 text-neutral-800">
                      {activeTab === 'like' ? 'Nothing added yet' : 'No dislikes yet'}
                    </p>
                    {activeTab === 'dislike' && (
                      <p className="text-[13px] text-neutral-400 mb-4 text-center leading-relaxed max-w-[240px]">
                        Not everything's a hit — add something you didn't vibe with
                      </p>
                    )}
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
                  <p className="text-sm text-neutral-400 mt-4">Nothing here yet</p>
                )}
              </div>
            );
          }

          return categories.map((cat) => {
            const filteredItems = cat.items.filter((i) => i.stance === activeTab);
            if (filteredItems.length === 0) return null;

            return (
              <section key={cat.id} className="mb-5">
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-sm font-medium">{categoryLabel(cat)}</p>
                  <p className="text-xs text-neutral-400">{filteredItems.length}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item as any}
                      categoryType={cat.type}
                      categoryTag={categoryTagSlug(cat)}
                      avatarUrl={profile.avatar_url}
                      displayName={profile.display_name}
                      username={profile.username}
                      isOwner={isOwner}
                      canInteract={canInteract && !isOwner}
                      onReact={handleReact}
                      onMatch={handleMatch}
                      onDiscuss={handleDiscuss}
                      onRatingChange={handleRatingChange}
                      onLongPress={(i) => isOwner && setDeleteTarget(i)}
                      onDelete={(i) => setDeleteTarget(i)}
                    />
                  ))}
                </div>
              </section>
            );
          });
        })()}
      </div>

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
          defaultStance={matchContext ? matchContext.stance : activeTab}
          prefill={matchContext ? { title: matchContext.title, subtitle: matchContext.subtitle || undefined, image_url: matchContext.image_url } : undefined}
          onClose={() => {
            setSheetOpen(false);
            setMatchContext(null);
          }}
          onSaved={handleItemSaved}
        />
      )}

      <p className="text-center text-[11px] text-neutral-300 mt-8 px-5">made with iSpace</p>

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
