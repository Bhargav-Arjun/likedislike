'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, ConversationStatus } from '@/lib/supabase';

type ConvoRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: ConversationStatus;
  updated_at: string;
  other_profile: { username: string; display_name: string; avatar_url: string | null } | null;
};

export default function ChatsList() {
  const router = useRouter();
  const [convos, setConvos] = useState<ConvoRow[]>([]);
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
        .from('conversations')
        .select('id, user_a, user_b, status, updated_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .neq('status', 'exited')
        .order('updated_at', { ascending: false });

      const enriched = await Promise.all(
        (data || []).map(async (c) => {
          const otherId = c.user_a === user.id ? c.user_b : c.user_a;
          const { data: other } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', otherId)
            .single();
          return { ...c, other_profile: other };
        })
      );
      setConvos(enriched as ConvoRow[]);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <p className="font-bold text-lg">Chats</p>
        <button onClick={() => router.push('/connect')} aria-label="Find people" className="bg-transparent border-none p-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9BF0" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
      </div>

      {convos.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center pt-10">
          No conversations yet -- search a Connect ID to message someone.
        </p>
      ) : (
        <div className="flex flex-col">
          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/chats/${c.id}`)}
              className="flex items-center gap-3 py-3 border-b border-neutral-100 bg-transparent border-x-0 border-t-0 text-left"
            >
              <div className="w-11 h-11 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                {c.other_profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.other_profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#BDBDBD">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[14px] truncate">{c.other_profile?.display_name || 'Unknown'}</p>
                <p className="text-xs text-neutral-400">{c.status === 'pending' ? 'Pending' : 'Active'}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
