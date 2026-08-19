import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

const ACCENT_HEX: Record<string, string> = {
  blue: '#378ADD',
  teal: '#1D9E75',
  coral: '#D85A30',
  pink: '#D4537E',
  amber: '#BA7517',
  purple: '#7F77DD',
};

export const revalidate = 0;

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .single();

  if (!profile) notFound();

  const { data: categories } = await supabase
    .from('categories')
    .select('*, items(*)')
    .eq('profile_id', profile.id)
    .order('sort_order');

  const accent = ACCENT_HEX[profile.accent_color] || ACCENT_HEX.blue;

  return (
    <main className="min-h-screen max-w-md mx-auto px-5 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-medium text-white"
          style={{ background: accent }}
        >
          {profile.display_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-lg">{profile.display_name}</p>
          {profile.bio && <p className="text-sm text-neutral-500">{profile.bio}</p>}
        </div>
      </div>

      {(categories || []).map((cat: any) => (
        <section key={cat.id} className="mb-8">
          <p className="text-xs tracking-wide text-neutral-400 uppercase mb-2">{cat.name}</p>
          <div className="flex flex-col gap-3">
            {cat.items.map((item: any) => (
              <div
                key={item.id}
                className="border border-neutral-200 rounded-xl px-4 py-3"
              >
                <p className="font-medium">{item.title}</p>
                {item.subtitle && (
                  <p className="text-sm text-neutral-500">{item.subtitle}</p>
                )}
                {item.why_note && (
                  <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                    {item.why_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-center text-xs text-neutral-300 mt-10">made with likedislike</p>
    </main>
  );
}
