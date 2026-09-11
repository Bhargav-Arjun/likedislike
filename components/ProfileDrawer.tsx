'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Profile, getMyConnectId } from '@/lib/supabase';
import SocialIcons from './SocialIcons';

export default function ProfileDrawer({
  profile,
  open,
  onClose,
}: {
  profile: Profile | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [myConnectId, setMyConnectId] = useState<string | null>(null);

  useEffect(() => {
    if (open && !myConnectId) {
      getMyConnectId().then(setMyConnectId);
    }
  }, [open, myConnectId]);

  if (!open || !profile) return null;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div
        className="w-[80%] max-w-xs h-full bg-white p-5 pt-8 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden mb-3">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#BDBDBD">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          )}
        </div>
        <p className="font-bold text-lg">{profile.display_name}</p>
        <p className="text-neutral-500 text-sm mb-3">@{profile.username}</p>

        {myConnectId && (
          <p className="text-[13px] text-neutral-500 mb-3">
            Connect ID: <span className="font-bold text-black">{myConnectId}</span>
          </p>
        )}

        <SocialIcons profile={profile} />

        <div className="h-px bg-neutral-100 my-4" />

        <button
          onClick={() => router.push('/edit-profile')}
          className="flex items-center gap-3 bg-transparent border-none p-0 mb-1"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
          <span className="font-bold text-base">Profile</span>
        </button>

        <button
          onClick={() => router.push('/connect')}
          className="flex items-center gap-3 bg-transparent border-none p-0 mb-1 mt-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <span className="font-bold text-base">Find people</span>
        </button>

        <button
          onClick={() => router.push('/chats')}
          className="flex items-center gap-3 bg-transparent border-none p-0 mt-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.8">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
          <span className="font-bold text-base">Chats</span>
        </button>

        <button
          onClick={() => router.push('/nearby')}
          className="flex items-center gap-3 bg-transparent border-none p-0 mt-3"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.8">
            <path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span className="font-bold text-base">Nearby</span>
        </button>
      </div>
      <div className="flex-1" />
    </div>
  );
}
