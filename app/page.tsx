'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, ensureProfile } from '@/lib/supabase';
import LoadingScreen from '@/components/LoadingScreen';

export default function AuthPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [profileError, setProfileError] = useState(false);
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
        const profile = await ensureProfile(user.id);
        if (profile) {
          router.replace('/home');
        } else {
          // Don't bounce to /dashboard here -- if profile creation keeps
          // failing, that would just loop back and forth forever.
          setProfileError(true);
          setChecking(false);
        }
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

  if (checking) return <LoadingScreen />;

  if (profileError) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium mb-2">Couldn't set up your profile</p>
        <p className="text-xs text-neutral-400 mb-4">
          You're logged in, but something's blocking profile creation. This is usually a Supabase permissions
          issue -- check that the RLS policies from schema.sql are applied.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-brand text-white rounded-lg px-5 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-medium mb-1">iSpace</h1>
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
