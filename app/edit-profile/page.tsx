'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Profile } from '@/lib/supabase';

const SOCIAL_FIELDS: { key: keyof Profile; label: string; placeholder: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', placeholder: 'phone number' },
  { key: 'youtube', label: 'YouTube', placeholder: 'channel link' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'profile link' },
  { key: 'facebook', label: 'Facebook', placeholder: 'profile link' },
  { key: 'gmail', label: 'Gmail', placeholder: 'you@gmail.com' },
  { key: 'telegram', label: 'Telegram', placeholder: 'username or link' },
  { key: 'phone', label: 'Phone', placeholder: 'phone number' },
];

export default function EditProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
      setAvatarPreview(data?.avatar_url || null);
      setLoading(false);
    })();
  }, [router]);

  function updateField(key: keyof Profile, value: string) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setError('');

    let avatarUrl = profile.avatar_url;
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true });
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      avatarUrl = `${pub.publicUrl}?t=${Date.now()}`;
    }

    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: avatarUrl,
        gender: profile.gender || null,
        whatsapp: profile.whatsapp || null,
        youtube: profile.youtube || null,
        snapchat: profile.snapchat || null,
        facebook: profile.facebook || null,
        gmail: profile.gmail || null,
        telegram: profile.telegram || null,
        phone: profile.phone || null,
      })
      .eq('id', profile.id);

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    router.push(`/${profile.username}`);
  }

  if (loading || !profile) return <main className="min-h-screen flex items-center justify-center">loading...</main>;

  return (
    <main className="min-h-screen px-5 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} aria-label="Back" className="bg-transparent border-none p-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-medium text-base">Edit profile</p>
      </div>

      <div className="flex flex-col items-center mb-6">
        <label className="cursor-pointer">
          <div className="w-18 h-18 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden" style={{ width: 72, height: 72 }}>
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="#BDBDBD">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </svg>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setAvatarFile(file);
                setAvatarPreview(URL.createObjectURL(file));
              }
            }}
          />
          <p className="text-center text-sm text-brand mt-2">Change photo</p>
        </label>
      </div>

      <label className="text-xs text-neutral-500">Name</label>
      <input
        value={profile.display_name}
        onChange={(e) => updateField('display_name', e.target.value)}
        className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-4"
      />

      <label className="text-xs text-neutral-500">Gender</label>
      <select
        value={profile.gender || ''}
        onChange={(e) => updateField('gender', e.target.value)}
        className="w-full border border-neutral-300 rounded-lg px-3 py-2 mt-1 mb-4"
      >
        <option value="">Prefer not to say</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
      </select>

      <p className="text-xs font-medium text-neutral-500 mb-2">SOCIAL LINKS</p>
      <div className="flex flex-col gap-2 mb-6">
        {SOCIAL_FIELDS.map((f) => (
          <div key={f.key} className="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2">
            <span className="text-xs text-neutral-500 w-20 flex-shrink-0">{f.label}</span>
            <input
              value={(profile[f.key] as string) || ''}
              onChange={(e) => updateField(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="flex-1 bg-transparent border-none text-sm outline-none"
            />
            {profile[f.key] && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-brand text-white rounded-lg py-2.5 font-medium flex items-center justify-center gap-2"
      >
        {saving && (
          <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin">
            <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="3" fill="none" opacity="0.3" />
            <path d="M21 12a9 9 0 00-9-9" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        )}
        Save
      </button>
      {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
    </main>
  );
}
