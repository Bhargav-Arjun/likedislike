Another code file

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, ensureProfile } from '@/lib/supabase';
import LoadingScreen from '@/components/LoadingScreen';

// This route exists only as a post-auth redirect target. It looks up the
// logged-in user's username and forwards them to their own profile page,
// which doubles as both the public view and the owner's management view.
export default function Dashboard() {
const router = useRouter();
const [profileError, setProfileError] = useState(false);

useEffect(() => {
(async () => {
const {
data: { user },
} = await supabase.auth.getUser();
if (!user) {
router.push('/');
return;
}
const profile = await ensureProfile(user.id);
if (profile) {
router.push('/home');
} else {
// Don't bounce back to "/" here -- that's what caused the infinite
// "/" <-> "/dashboard" redirect loop when profile creation fails.
setProfileError(true);
}
})();
}, [router]);

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

return <LoadingScreen />;
}
