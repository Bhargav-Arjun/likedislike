'use client';

import { useRouter } from 'next/navigation';
import { Profile } from '@/lib/supabase';

export default function TopNav({
  profile,
  drawerOpen,
  onToggleDrawer,
}: {
  profile: Profile | null;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between px-4 py-2.5 sticky top-0 bg-white z-30 border-b border-neutral-100">
      <button onClick={onToggleDrawer} aria-label="Profile menu" className="bg-transparent border-none p-0">
        <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#BDBDBD">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          )}
        </div>
      </button>

      <p className="font-semibold text-lg tracking-tight">iSpace</p>

      <button onClick={() => router.push('/messages')} aria-label="Notifications" className="bg-transparent border-none p-0 w-8 h-8 flex items-center justify-center">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.8">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
      </button>
    </div>
  );
}

