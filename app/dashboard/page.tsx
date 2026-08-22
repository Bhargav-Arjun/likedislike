'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// This route exists only as a post-auth redirect target. It looks up the
// logged-in user's username and forwards them to their own profile page,
// which doubles as both the public view and the owner's management view.
export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      router.push(profile ? `/${profile.username}` : '/');
    })();
  }, [router]);

  return <main className="min-h-screen flex items-center justify-center">loading...</main>;
}
