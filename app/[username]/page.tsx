'use client';

import { useEffect, useState, useCallback } from 'react';
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

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', params.username)
      .single();

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

    const { data: reactions } = allItemIds.length
      ? await supabase.from('item_reactions').select('item_id, reactor_id').in('item_id', allItemIds)
      : { data: [] };
    const { data: matches } = allItemIds.length
      ? await supabase.from('item_matches').select('source_item_id').in('source_item_id', allItemIds)
      : { data: [] };

    const withCounts = (cats || []).map((c: any) => ({
      ...c,
      items: c.items
        .sort((a: Item, b: Item) => a.sort_order - b.sort_order)
        .map((item: Item) => ({
          ...item,
          reaction_count: (reactions || []).filter((r) => r.item_id === item.id).length,
          match_count: (matches || []).filter((m) => m.source_item_id === item.id).length,
          user_reacted: (reactions || []).some((r) => r.item_id === item.id && r.reactor_id === user?.id),
        })),
    }));

    setCategories(withCounts);
    setLoading(false);
  }, [params.username]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = !!currentUserId && !!profile && currentUserId === profile.id;
  const canInteract = !!currentUserId;

  const totalLikes = categories.reduce((sum, c) => sum + c.items.filter((i) => i.stance === 'like').length, 0);
  const totalDislikes = categories.reduce((sum, c) => sum + c.items.filter((i) => i.stance === 'dislike').length, 0);

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
    if (currentUserId === profile.id) return; // can't DM yourself

    const [userA, userB] = [currentUserId, profile.id].sort();
    let { data: convo } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_a', userA)
      .eq('user_b', userB)
      .eq('item_id', item.id)
      .maybeSingle();

    if (!convo) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ user_a: userA, user_b: userB, item_id: item.id })
        .select('id')
        .single();
      convo = created;
    }
    if (convo) router.push(`/messages/${convo.id}`);
  }

  async function handleRatingChange(item: any, rating: number) {
    await supabase.from('items').update({ rating }).eq('id', item.id);
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
    <main className="min-h-screen px-5 py-6">
      <div className="flex items-center gap-4 mb-3">
        <div className="w-14 h-14 rounded-full bg-neutral-200 border-2 border-black flex items-center justify-center flex-shrink-0 overflow-hidden">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium text-base">{profile.display_name}</p>
          <div className="flex gap-4">
            <span className="text-sm">
              <b className="font-medium">{totalLikes}</b> <span className="text-neutral-400 text-xs">likes</span>
            </span>
            <span className="text-sm">
              <b className="font-medium">{totalDislikes}</b> <span className="text-neutral-400 text-xs">dislikes</span>
            </span>
          </div>
        </div>
      </div>

      <SocialIcons profile={profile} />

      {isOwner && (
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => router.push('/edit-profile')}
            className="flex-1 bg-brand text-white rounded-lg py-2 text-sm font-medium"
          >
            Edit profile
          </button>
          <button
            onClick={() => {
              setMatchContext(null);
              setSheetOpen(true);
            }}
            aria-label="Add item"
            className="w-10 bg-brand text-white rounded-lg flex items-center justify-center"
          >
            +
          </button>
        </div>
      )}

      {categories.map((cat) => (
        <section key={cat.id} className="mb-5">
          <div className="flex justify-between items-baseline mb-2">
            <p className="text-sm font-medium">{cat.name}</p>
            <p className="text-xs text-neutral-400">{cat.items.length}</p>
          </div>
          {cat.items.length === 0 ? (
            <p className="text-xs text-neutral-400">
              {cat.type === 'movies_series' && 'share your top rated movies and series'}
              {cat.type === 'songs' && 'share your top 15 songs'}
              {cat.type === 'food' && 'best food to try'}
              {cat.type === 'places' && 'best place to eat and go'}
              {cat.type === 'custom' && 'nothing added yet'}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {cat.items.map((item) => (
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
                />
              ))}
            </div>
          )}
        </section>
      ))}

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

      <p className="text-center text-[11px] text-neutral-300 mt-8">made with likedislike</p>
    </main>
  );
}
