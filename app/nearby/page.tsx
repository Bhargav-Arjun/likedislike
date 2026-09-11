
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, toggleLocationSharing, updateMyLocation, findNearbyUsers, NearbyUser } from '@/lib/supabase';

export default function NearbyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

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
        .select('location_sharing_enabled')
        .eq('id', user.id)
        .single();
      setEnabled(!!profile?.location_sharing_enabled);
      setLoading(false);
      if (profile?.location_sharing_enabled) {
        refreshNearby();
      }
    })();
  }, [router]);

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Location is not available on this device'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
    });
  }

  async function refreshNearby() {
    setSearching(true);
    setError('');
    try {
      const pos = await getPosition();
      await updateMyLocation(pos.coords.latitude, pos.coords.longitude);
      const results = await findNearbyUsers(1);
      setNearby(results);
    } catch (err: any) {
      setError(err.message || 'Could not get your location');
    }
    setSearching(false);
  }

  async function handleEnable() {
    setError('');
    try {
      const pos = await getPosition();
      await toggleLocationSharing(true);
      await updateMyLocation(pos.coords.latitude, pos.coords.longitude);
      setEnabled(true);
      refreshNearby();
    } catch (err: any) {
      setError(err.message || 'Location permission is needed for this');
    }
  }

  async function handleDisable() {
    await toggleLocationSharing(false);
    setEnabled(false);
    setNearby([]);
  }

  function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)} m away`;
    return `${km.toFixed(1)} km away`;
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen px-5 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} aria-label="Back" className="bg-transparent border-none p-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-bold text-lg">Nearby</p>
      </div>

      {!enabled ? (
        <div className="flex flex-col items-center pt-10 text-center px-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1D9BF0" strokeWidth="1.6" className="mb-3">
            <path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <p className="text-sm font-medium mb-1">See who's within 1 km</p>
          <p className="text-xs text-neutral-400 mb-5 max-w-[260px]">
            Off by default. Turning this on shares your general location with the app only while you're using
            Nearby -- you can turn it off any time.
          </p>
          <button onClick={handleEnable} className="bg-brand text-white rounded-lg px-6 py-2.5 text-sm font-medium">
            Turn on Nearby
          </button>
          {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-neutral-400">Within 1 km, updated just now</p>
            <button onClick={handleDisable} className="text-xs text-red-500 bg-transparent border-none p-0">
              Turn off
            </button>
          </div>

          {searching ? (
            <p className="text-sm text-neutral-400 text-center pt-6">Looking around...</p>
          ) : error ? (
            <p className="text-red-500 text-sm text-center pt-6">{error}</p>
          ) : nearby.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center pt-6">No one else nearby with this on right now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {nearby.map((n) => (
                <button
                  key={n.id}
                  onClick={() => router.push(`/${n.username}`)}
                  className="flex items-center gap-3 border border-neutral-200 rounded-xl p-3 text-left bg-white"
                >
                  <div className="w-11 h-11 rounded-full bg-neutral-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {n.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#BDBDBD">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[14px] truncate">{n.display_name}</p>
                    <p className="text-xs text-neutral-400">{formatDistance(n.distance_km)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={refreshNearby}
            disabled={searching}
            className="w-full border border-neutral-300 rounded-lg py-2 text-sm text-neutral-600 mt-4"
          >
            Refresh
          </button>
        </>
      )}
    </main>
  );
}
