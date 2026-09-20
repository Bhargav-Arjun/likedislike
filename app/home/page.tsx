'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Profile, Category, CategoryWithItems, Item, categoryTagSlug } from '@/lib/supabase';
import TopNav from '@/components/TopNav';
import ProfileDrawer from '@/components/ProfileDrawer';
import ItemCard from '@/components/ItemCard';
import AddItemSheet from '@/components/AddItemSheet';
import EmptyIllustration from '@/components/EmptyIllustration';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // "For you" = Likes, "Following" = Dislikes -- same underlying Like/Dislike
  // split used on the profile page, just labeled to match X's own tab names.
  // There's no real follow/social-graph feature here, by design.
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const stance = activeTab === 'foryou' ? 'like' : 'dislike';

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(prof);

    const { data: cats } = await supabase
      .from('categories')
      .select('*, items(*)')
      .eq('profile_id', user.id)
      .order('sort_order');

    const allItemIds = (cats || []).flatMap((c: any) => c.items.map((i: Item) => i.id));

    const [{ data: reactions }, { data: matches }] = allItemIds.length
      ? await Promise.all([
          supabase.from('item_reactions').select('item_id, reactor_id').in('item_id', allItemIds),
          supabase.from('item_matches').select('source_item_id').in('source_item_id', allItemIds),
        ])
      : [{ data: [] }, { data: [] }];

    const withCounts = (cats || []).map((c: any) => ({
      ...c,
      items: c.items
        .sort((a: Item, b: Item) => a.sort_order - b.sort_order)
        .map((item: Item) => ({
          ...item,
          reaction_count: (reactions || []).filter((r) => r.item_id === item.id).length,
          match_count: (matches || []).filter((m) => m.source_item_id === item.id).length,
          user_reacted: false, // it's your own feed -- you can't react to your own posts
        })),
    }));

    setCategories(withCounts);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    router.prefetch('/edit-profile');
  }, [router]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 50) return;
    if (deltaX < 0) setActiveTab('following'); // swipe left -> Following (dislikes)
    else setActiveTab('foryou'); // swipe right -> For you (likes)
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

  async function handleItemSaved() {
    setSheetOpen(false);
    load();
  }

  // Category names read positively ("Movies I like") -- flip the label on
  // the Following (dislikes) tab so it reads naturally there too.
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

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const tabHasAnyItems = categories.some((c) => c.items.some((i) => i.stance === stance));
  const noop = () => {}; // reactions/match/discuss on your own feed are display-only

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen pb-24">
      <TopNav profile={profile} drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen((v) => !v)} />
      <ProfileDrawer profile={profile} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex border-b border-neutral-100">
        <button
          onClick={() => setActiveTab('foryou')}
          className="flex-1 py-3 bg-transparent border-none text-[15px]"
          style={{
            fontWeight: activeTab === 'foryou' ? 700 : 500,
            color: activeTab === 'foryou' ? '#000' : '#536471',
            borderBottom: activeTab === 'foryou' ? '2px solid #1D9BF0' : '2px solid transparent',
          }}
        >
          For you
        </button>
        <button
          onClick={() => setActiveTab('following')}
          className="flex-1 py-3 bg-transparent border-none text-[15px]"
          style={{
            fontWeight: activeTab === 'following' ? 700 : 500,
            color: activeTab === 'following' ? '#000' : '#536471',
            borderBottom: activeTab === 'following' ? '2px solid #1D9BF0' : '2px solid transparent',
          }}
        >
          Following
        </button>
      </div>

      {/* min-h keeps the swipe area full-height even when a tab is empty */}
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="px-4 min-h-[50vh]">
        {totalItems === 0 ? (
          // Brand-new account, nothing posted anywhere yet -- show the illustration once.
          <div className="flex flex-col items-center pt-10">
            <EmptyIllustration size={110} />
            <p className="text-sm font-medium mt-4 mb-4">Nothing added yet</p>
            <button
              onClick={() => setSheetOpen(true)}
              className="bg-brand text-white rounded-lg px-6 py-2 text-sm font-medium"
            >
              Create
            </button>
          </div>
        ) : !tabHasAnyItems ? (
          // Something exists elsewhere (e.g. likes), just not on this tab --
          // plain text only, no illustration, once the account isn't brand-new.
          <p className="text-sm text-neutral-400 text-center pt-10">
            {activeTab === 'foryou' ? 'Nothing here yet' : 'No dislikes yet'}
          </p>
        ) : (
          categories.map((cat) => {
            const filteredItems = cat.items.filter((i) => i.stance === stance);
            if (filteredItems.length === 0) return null;
            return (
              <section key={cat.id} className="mb-4">
                <div className="flex justify-between items-baseline mb-1 pt-2">
                  <p className="text-sm font-bold text-black">{categoryLabel(cat)}</p>
                  <p className="text-xs text-neutral-400">{filteredItems.length}</p>
                </div>
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item as any}
                    categoryType={cat.type}
                    categoryTag={categoryTagSlug(cat)}
                    avatarUrl={profile?.avatar_url ?? null}
                    displayName={profile?.display_name ?? ''}
                    username={profile?.username ?? ''}
                    isOwner={true}
                    canInteract={false}
                    onReact={noop}
                    onMatch={noop}
                    onDiscuss={noop}
                    onRatingChange={handleRatingChange}
                    onLongPress={(i) => setDeleteTarget(i)}
                  />
                ))}
              </section>
            );
          })
        )}
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
              <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-neutral-300 rounded-lg py-2 text-sm">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm">
                {deleting ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <AddItemSheet
          categories={categories}
          defaultStance={stance}
          onClose={() => setSheetOpen(false)}
          onSaved={handleItemSaved}
        />
      )}

      {totalItems > 0 && (
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Add item"
          className="fixed bottom-6 right-5 w-14 h-14 rounded-full bg-brand text-white text-2xl flex items-center justify-center shadow-lg z-40"
        >
          +
        </button>
      )}
    </main>
  );
}
