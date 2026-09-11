'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Conversation, Message, exitConversation, blockUser, reportUser } from '@/lib/supabase';

export default function ChatThread({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [otherProfile, setOtherProfile] = useState<{ display_name: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      setCurrentUserId(user.id);

      const { data: c } = await supabase.from('conversations').select('*').eq('id', params.id).single();
      if (!c || (c.user_a !== user.id && c.user_b !== user.id)) {
        router.push('/chats');
        return;
      }
      setConvo(c);

      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const { data: other } = await supabase.from('profiles').select('display_name, username').eq('id', otherId).single();
      setOtherProfile(other);

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true });
      setMessages(msgs || []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`chat-${params.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${params.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${params.id}` },
        (payload) => setConvo(payload.new as Conversation)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const myMessageCount = messages.filter((m) => m.sender_id === currentUserId).length;
  const isInitiator = convo?.initiated_by === currentUserId;
  const limitReached = convo?.status === 'pending' && isInitiator && myMessageCount >= 5;
  const frozen = convo?.status === 'blocked' || convo?.status === 'reported' || convo?.status === 'exited';

  async function sendMessage() {
    if (!body.trim() || !currentUserId) return;
    const text = body.trim();
    setSendError('');
    const { error } = await supabase.from('messages').insert({ conversation_id: params.id, sender_id: currentUserId, body: text });
    if (error) {
      // Server-side trigger rejection (limit reached, blocked, rate limit...)
      setSendError(error.message.replace('new row for relation "messages" violates', '').trim() || error.message);
      return;
    }
    setBody('');
  }

  async function handleExit() {
    await exitConversation(params.id);
    router.push('/chats');
  }

  async function handleBlock() {
    if (!otherProfile || !convo || !currentUserId) return;
    const otherId = convo.user_a === currentUserId ? convo.user_b : convo.user_a;
    await blockUser(otherId);
    router.push('/chats');
  }

  async function handleReport() {
    if (!convo || !currentUserId || !reportReason.trim()) return;
    const otherId = convo.user_a === currentUserId ? convo.user_b : convo.user_a;
    await reportUser(otherId, convo.id, reportReason);
    setReportOpen(false);
    router.push('/chats');
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen flex flex-col px-5 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/chats')} aria-label="Back" className="bg-transparent border-none p-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="font-bold text-[15px]">{otherProfile?.display_name || 'Chat'}</p>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="More" className="bg-transparent border-none p-0 text-neutral-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-neutral-200 z-20 py-1 w-40">
                <button onClick={() => { setMenuOpen(false); setExitConfirm(true); }} className="w-full text-left px-3 py-2 text-[13px] bg-transparent border-none">
                  Exit conversation
                </button>
                <button onClick={() => { setMenuOpen(false); handleBlock(); }} className="w-full text-left px-3 py-2 text-[13px] text-red-500 bg-transparent border-none">
                  Block
                </button>
                <button onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="w-full text-left px-3 py-2 text-[13px] text-red-500 bg-transparent border-none">
                  Report
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {convo?.status === 'pending' && !frozen && (
        <p className="text-xs text-neutral-400 text-center mb-2">
          {isInitiator ? `Message ${Math.min(myMessageCount + (limitReached ? 0 : 1), 5)}/5 -- waits for a reply after 5` : 'Reply to unlock unlimited messaging'}
        </p>
      )}

      <div className="flex-1 flex flex-col gap-2 mb-4 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${m.sender_id === currentUserId ? 'bg-brand text-white self-end' : 'bg-neutral-100 self-start'}`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {frozen ? (
        <p className="text-center text-sm text-neutral-400 py-2">This conversation is no longer active.</p>
      ) : (
        <>
          {sendError && <p className="text-red-500 text-xs mb-2 text-center">{sendError}</p>}
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={limitReached}
              placeholder={limitReached ? 'Waiting for a reply...' : 'Message...'}
              className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 disabled:bg-neutral-100"
            />
            <button onClick={sendMessage} disabled={limitReached} className="bg-brand text-white rounded-lg px-4 py-2 disabled:opacity-50">
              Send
            </button>
          </div>
        </>
      )}

      {exitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-8" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setExitConfirm(false)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium mb-1">Exit conversation?</p>
            <p className="text-xs text-neutral-400 mb-4">This conversation will disappear after you leave.</p>
            <div className="flex gap-2">
              <button onClick={() => setExitConfirm(false)} className="flex-1 border border-neutral-300 rounded-lg py-2 text-sm">Cancel</button>
              <button onClick={handleExit} className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm">Exit</button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-8" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setReportOpen(false)}>
          <div className="bg-white rounded-xl p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium mb-2">Report this conversation</p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="What's wrong?"
              rows={3}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setReportOpen(false)} className="flex-1 border border-neutral-300 rounded-lg py-2 text-sm">Cancel</button>
              <button onClick={handleReport} disabled={!reportReason.trim()} className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm disabled:opacity-50">Report</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
