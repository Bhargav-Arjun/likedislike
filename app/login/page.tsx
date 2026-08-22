'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-medium mb-6">sign in</h1>
      {sent ? (
        <p className="text-neutral-500 text-center">check your email for the login link.</p>
      ) : (
        <form onSubmit={handleLogin} className="w-full max-w-xs flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-neutral-300 rounded-lg px-4 py-2"
          />
          <button type="submit" className="bg-black text-white rounded-lg px-4 py-2 font-medium">
            send magic link
          </button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      )}
    </main>
  );
}
