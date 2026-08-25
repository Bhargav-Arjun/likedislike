'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import EmptyIllustration from '@/components/EmptyIllustration';

type NotificationRow = {
  id: string;
  type: 'reaction' | 'match' | 'message';
  created_at: string;
  read: boolean;
  actor: { display_name: string; username: string } | null;
  item: { title: string; image_url: string | null } | null;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const enriched = await Promise.all(
        (data || []).map(async (n) => {
          const { data: actor } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', n.actor_id)
            .single();
          let item = null;
          if (n.item_id) {
            const { data: itemData } = await supabase.from('items').select('title, image_url').eq('id', n.item_id).single();
            item = itemData;
          }
          return { ...n, actor, item };
        })
      );

      setNotifications(enriched);
      setLoading(false);

      // Mark everything as read now that the person has opened this page.
      const unreadIds = (data || []).filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length) {
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
      }
    })();
  }, [router]);

  function describe(n: NotificationRow) {
    const name = n.actor?.display_name || 'Someone';
    if (n.type === 'reaction') return `${name} liked your "${n.item?.title || 'item'}"`;
    if (n.type === 'match') return `${name} added your "${n.item?.title || 'item'}" to their list too`;
    return `${name} sent a message`; // reserved for Phase 2
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen px-5 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} aria-label="Back" className="bg-transparent border-none p-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-medium text-base">Messages</p>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center pt-10">
          <EmptyIllustration size={100} />
          <p className="text-sm text-neutral-400 mt-4 text-center">
            Nothing yet -- when someone relates to or matches an item, it'll show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${n.read ? 'bg-neutral-50' : 'bg-blue-50'}`}
            >
              <div className="w-11 h-11 rounded-lg bg-neutral-200 flex-shrink-0 overflow-hidden">
                {n.item?.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.item.image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div>
                <p className="text-sm">{describe(n)}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
