'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, skip straight to their profile.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        router.replace(profile ? `/${profile.username}` : '/dashboard');
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push('/dashboard');
      } else {
        // Email confirmation is turned on in Supabase settings.
        setError('Check your email to confirm your account, then log in.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/dashboard');
    }
    setSubmitting(false);
  }

  if (checking) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-medium mb-1">Getmee</h1>
      <p className="text-neutral-400 text-sm mb-6">No need to ask. It's all right here.</p>

      <div className="flex gap-1 mb-6 bg-neutral-100 rounded-lg p-1">
        <button
          onClick={() => setMode('signup')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium ${mode === 'signup' ? 'bg-white shadow-sm' : 'text-neutral-400'}`}
        >
          Sign up
        </button>
        <button
          onClick={() => setMode('login')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium ${mode === 'login' ? 'bg-white shadow-sm' : 'text-neutral-400'}`}
        >
          Log in
        </button>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-neutral-300 rounded-lg px-4 py-2.5"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-neutral-300 rounded-lg px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-brand text-white rounded-lg px-4 py-2.5 font-medium mt-1"
        >
          {submitting ? '...' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </form>
    </main>
  );
}
