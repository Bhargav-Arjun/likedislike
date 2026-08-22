
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Message = { id: string; sender_id: string; body: string; created_at: string };

export default function ConversationThread({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUserId(user.id);

      const { data: convo } = await supabase
        .from('conversations')
        .select('item_id')
        .eq('id', params.id)
        .single();
      if (convo?.item_id) {
        const { data: item } = await supabase.from('items').select('title').eq('id', convo.item_id).single();
        setItemTitle(item?.title || null);
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`conversation-${params.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${params.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!body.trim() || !currentUserId) return;
    const text = body.trim();
    setBody('');
    await supabase.from('messages').insert({ conversation_id: params.id, sender_id: currentUserId, body: text });
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen flex flex-col px-5 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/messages')} aria-label="Back" className="bg-transparent border-none p-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="font-medium text-sm">Conversation</p>
          {itemTitle && <p className="text-xs text-neutral-400">about {itemTitle}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 mb-4 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
              m.sender_id === currentUserId ? 'bg-brand text-white self-end' : 'bg-neutral-100 self-start'
            }`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Message..."
          className="flex-1 border border-neutral-300 rounded-lg px-3 py-2"
        />
        <button onClick={sendMessage} className="bg-brand text-white rounded-lg px-4 py-2">
          Send
        </button>
      </div>
    </main>
  );
}
