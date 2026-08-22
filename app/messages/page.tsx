
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type ConvoRow = {
  id: string;
  user_a: string;
  user_b: string;
  item_id: string | null;
  other_profile: { username: string; display_name: string } | null;
  item_title: string | null;
};

export default function MessagesList() {
  const router = useRouter();
  const [convos, setConvos] = useState<ConvoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('conversations')
        .select('id, user_a, user_b, item_id')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const enriched = await Promise.all(
        (data || []).map(async (c) => {
          const otherId = c.user_a === user.id ? c.user_b : c.user_a;
          const { data: other } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('id', otherId)
            .single();
          let itemTitle: string | null = null;
          if (c.item_id) {
            const { data: item } = await supabase.from('items').select('title').eq('id', c.item_id).single();
            itemTitle = item?.title || null;
          }
          return { ...c, other_profile: other, item_title: itemTitle };
        })
      );
      setConvos(enriched);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen px-5 py-6">
      <p className="font-medium text-base mb-4">Messages</p>
      {convos.length === 0 ? (
        <p className="text-sm text-neutral-400">No conversations yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/messages/${c.id}`)}
              className="flex flex-col items-start bg-neutral-50 rounded-lg px-3 py-2.5 text-left"
            >
              <p className="text-sm font-medium">{c.other_profile?.display_name || 'Unknown'}</p>
              {c.item_title && <p className="text-xs text-neutral-400">about {c.item_title}</p>}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
