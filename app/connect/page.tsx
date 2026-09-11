'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, searchConnectId, getOrCreateConversation, ConnectIdResult } from '@/lib/supabase';

export default function ConnectSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ConnectIdResult | null | undefined>(undefined); // undefined = not searched yet
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [messaging, setMessaging] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSearching(true);
    try {
      const found = await searchConnectId(query);
      setResult(found);
    } catch (err: any) {
      setError(err.message || 'Search failed, try again');
      setResult(undefined);
    }
    setSearching(false);
  }

  async function handleMessage() {
    if (!result) return;
    setMessaging(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    if (user.id === result.id) {
      setError("That's your own Connect ID");
      setMessaging(false);
      return;
    }
    try {
      const convo = await getOrCreateConversation(user.id, result.id);
      router.push(`/chats/${convo.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not start conversation');
      setMessaging(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} aria-label="Back" className="bg-transparent border-none p-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-bold text-lg">Find people</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter Connect ID (e.g. K24M8)"
          maxLength={5}
          className="flex-1 border border-neutral-300 rounded-lg px-4 py-2.5 uppercase tracking-wider"
        />
        <button
          type="submit"
          disabled={searching || query.trim().length !== 5}
          className="bg-brand text-white rounded-lg px-5 font-medium"
        >
          {searching ? '...' : 'Search'}
        </button>
      </form>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {result === null && <p className="text-sm text-neutral-400 text-center">No one found with that Connect ID.</p>}

      {result && (
        <div className="border border-neutral-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center flex-shrink-0">
            {result.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#BDBDBD">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15px] truncate">{result.display_name}</p>
            <p className="text-xs text-neutral-500">Connect ID: {result.connect_id}</p>
          </div>
          <button
            onClick={handleMessage}
            disabled={messaging}
            className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium flex-shrink-0"
          >
            {messaging ? '...' : 'Message'}
          </button>
        </div>
      )}
    </main>
  );
}

